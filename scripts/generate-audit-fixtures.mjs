// Generates realistic PDFs/images for the tool audit tests (test-fixtures/audit).
// Usage: node scripts/generate-audit-fixtures.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import {
  PDFDocument, StandardFonts, rgb, grayscale, degrees,
  PDFName, PDFHexString, PDFDict, PDFArray, PDFRawStream, PDFString,
} from "pdf-lib";
import {
  encryptPDF, md5, RC4, bytesToHex,
  computeHash2B, aes256CbcEncryptNoPad, aes256EcbEncryptBlock,
} from "@pdfsmaller/pdf-encrypt";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "test-fixtures", "audit");

// Deterministic pseudo-random so fixtures are stable across runs.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

/** A photo-like RGBA buffer: smooth gradients plus mild noise (compresses like a real photo). */
function photoPixels(w, h) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = (rand() - 0.5) * 18;
      data[i] = Math.max(0, Math.min(255, 120 + 100 * Math.sin(x / 90) + n));
      data[i + 1] = Math.max(0, Math.min(255, 110 + 90 * Math.cos(y / 70) + n));
      data[i + 2] = Math.max(0, Math.min(255, 140 + 60 * Math.sin((x + y) / 130) + n));
      data[i + 3] = 255;
    }
  }
  return data;
}

function encodeJpeg(w, h, quality = 95) {
  return jpeg.encode({ data: photoPixels(w, h), width: w, height: h }, quality).data;
}

/** Insert an EXIF APP1 segment with the given Orientation tag right after SOI. */
function withExifOrientation(jpg, orientation) {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD at 8
    0x00, 0x01, // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation SHORT
    0x00, 0x00, 0x00, 0x00, // next IFD
  ]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const seg = Buffer.alloc(4);
  seg[0] = 0xff; seg[1] = 0xe1; seg.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpg.subarray(0, 2), seg, payload, jpg.subarray(2)]);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal PNG encoder (RGB, 8-bit). */
function encodePng(w, h, pixelFn) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function save(doc, name) {
  const bytes = await doc.save();
  await fs.writeFile(path.join(outDir, name), bytes);
  return bytes;
}

async function textPage(doc, font, bold, title, lines, size = [612, 792]) {
  const page = doc.addPage(size);
  page.drawText(title, { x: 54, y: size[1] - 72, size: 22, font: bold, color: rgb(0.1, 0.1, 0.1) });
  let y = size[1] - 110;
  for (const line of lines) {
    page.drawText(line, { x: 54, y, size: 11, font, color: grayscale(0.15) });
    y -= 15;
  }
  return page;
}

const LOREM = [
  "RizzPDF audit fixture paragraph one explains that this text must stay selectable",
  "after any tool that does not rasterize the page. The quick brown fox jumps over",
  "the lazy dog while the invoice total reads 1,234.56 USD for verification.",
];

// ---------------------------------------------------------------------------
// Hand-rolled PDF Standard Security Handler encryption (RC4-128 V2/R3,
// AES-128 V4/R4 via /CF /StdCF /CFM /AESV2, and AES-256 V5/R6). Mirrors
// what lib/pdf-decrypt.ts expects to read — PDF 32000-1 Algorithms 1/2/3/5
// for the classic scheme, ISO 32000-2 Algorithms 8/9/10 (via
// @pdfsmaller/pdf-encrypt's computeHash2B/aes256CbcEncryptNoPad/
// aes256EcbEncryptBlock) for AES-256. @pdfsmaller/pdf-encrypt's own
// encryptPDF() always writes strings as hex, so fixtures that need literal
// (parenthesized) strings with escaping-worthy bytes go through this path
// instead. Verified against pdf.js separately (see verify step in README).
// ---------------------------------------------------------------------------
const STD_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function randomBytesStd(count) {
  const b = new Uint8Array(count);
  for (let i = 0; i < count; i++) b[i] = Math.floor(rand() * 256);
  return b;
}

function padPasswordStd(password) {
  const pw = new TextEncoder().encode(password);
  const out = new Uint8Array(32);
  const n = Math.min(32, pw.length);
  out.set(pw.subarray(0, n));
  out.set(STD_PADDING.subarray(0, 32 - n), n);
  return out;
}

/** PDF 2.0 password prep for AES-256: UTF-8 bytes truncated to 127 bytes. */
function truncatePasswordStd(password) {
  const bytes = new TextEncoder().encode(password);
  return bytes.length > 127 ? bytes.slice(0, 127) : bytes;
}

function xorKeyStd(key, i) {
  const out = new Uint8Array(key.length);
  for (let k = 0; k < key.length; k++) out[k] = key[k] ^ i;
  return out;
}

function concatStd(...arrs) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

/** PDF 32000-1 7.3.4.2 literal-string escaping — the write side of the same
 * rules lib/pdf-decrypt.ts's escapeLiteralBytes implements, kept in sync by
 * hand since this script can't import a .ts module directly. */
function escapeLiteralBytesStd(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x5c) out += "\\\\";
    else if (b === 0x28) out += "\\(";
    else if (b === 0x29) out += "\\)";
    else if (b === 0x0d) out += "\\r";
    else if (b < 0x20 || b > 0x7e) out += "\\" + b.toString(8).padStart(3, "0");
    else out += String.fromCharCode(b);
  }
  return out;
}

/** Algorithm 3: compute /O from the owner (or, if absent, user) password (V1/V2/V4). */
function computeOEntryStd(ownerPassword, userPassword, n) {
  const paddedOwner = padPasswordStd(ownerPassword || userPassword);
  let hash = md5(paddedOwner);
  // 50 rounds hash the *full* 16-byte digest each time (unlike Algorithm 2) —
  // truncation to `n` bytes happens once, after the loop.
  for (let i = 0; i < 50; i++) hash = md5(hash);
  const ownerKey = hash.slice(0, n);
  let result = padPasswordStd(userPassword);
  for (let i = 0; i <= 19; i++) result = new RC4(xorKeyStd(ownerKey, i)).process(result);
  return result;
}

/** Algorithm 2: compute the file encryption key from the user password, /O, /P and /ID[0] (V1/V2/V4). */
function computeFileKeyStd(userPassword, O, P, id0, n) {
  const paddedUser = padPasswordStd(userPassword);
  const pBytes = new Uint8Array([P & 0xff, (P >> 8) & 0xff, (P >> 16) & 0xff, (P >> 24) & 0xff]);
  let hash = md5(concatStd(paddedUser, O, pBytes, id0));
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, n));
  return hash.slice(0, n);
}

/** Algorithm 5: compute /U from the file key and /ID[0] (V1/V2/V4, R>=3). */
function computeUEntryStd(fileKey, id0) {
  const hash = md5(concatStd(STD_PADDING, id0));
  let result = new RC4(fileKey).process(hash);
  for (let i = 1; i <= 19; i++) result = new RC4(xorKeyStd(fileKey, i)).process(result);
  const U = new Uint8Array(32);
  U.set(result, 0);
  U.set(randomBytesStd(16), 16);
  return U;
}

/** Algorithm 1: per-object key (V1/V2/V4 only — AES-256 uses the file key directly). */
function objectKeyStd(fileKey, objNum, genNum, isAES) {
  const extra = isAES ? 4 : 0;
  const input = new Uint8Array(fileKey.length + 5 + extra);
  input.set(fileKey, 0);
  let off = fileKey.length;
  input[off++] = objNum & 0xff;
  input[off++] = (objNum >> 8) & 0xff;
  input[off++] = (objNum >> 16) & 0xff;
  input[off++] = genNum & 0xff;
  input[off++] = (genNum >> 8) & 0xff;
  if (isAES) { input[off++] = 0x73; input[off++] = 0x41; input[off++] = 0x6c; input[off++] = 0x54; } // "sAlT"
  const hash = md5(input);
  return hash.slice(0, Math.min(fileKey.length + 5, 16));
}

async function aesCbcEncryptStd(key, iv, data) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-CBC", false, ["encrypt"]);
  const enc = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, data);
  return new Uint8Array(enc);
}

/** ISO 32000-2 Algorithms 8/9: compute /U, /UE, /O, /OE for AES-256 (V5/R6). */
async function computeV5Entries(userPassword, ownerPassword, fileKey, P, encryptMetadata) {
  const uPw = truncatePasswordStd(userPassword);
  const uValSalt = randomBytesStd(8);
  const uKeySalt = randomBytesStd(8);
  const uHash = await computeHash2B(uPw, uValSalt, new Uint8Array(0));
  const U = concatStd(uHash, uValSalt, uKeySalt);
  const ueKey = await computeHash2B(uPw, uKeySalt, new Uint8Array(0));
  const UE = await aes256CbcEncryptNoPad(fileKey, ueKey, new Uint8Array(16));

  const oPw = truncatePasswordStd(ownerPassword || userPassword);
  const oValSalt = randomBytesStd(8);
  const oKeySalt = randomBytesStd(8);
  const oHash = await computeHash2B(oPw, oValSalt, U);
  const O = concatStd(oHash, oValSalt, oKeySalt);
  const oeKey = await computeHash2B(oPw, oKeySalt, U);
  const OE = await aes256CbcEncryptNoPad(fileKey, oeKey, new Uint8Array(16));

  // Algorithm 10 (Perms) — optional for our own decrypter, but written correctly regardless.
  const permsPlain = new Uint8Array(16);
  permsPlain[0] = P & 0xff; permsPlain[1] = (P >> 8) & 0xff; permsPlain[2] = (P >> 16) & 0xff; permsPlain[3] = (P >> 24) & 0xff;
  permsPlain.set([0xff, 0xff, 0xff, 0xff], 4);
  permsPlain[8] = encryptMetadata ? 0x54 : 0x46; // 'T' / 'F'
  permsPlain.set([0x61, 0x64, 0x62], 9); // "adb"
  permsPlain.set(randomBytesStd(4), 12);
  const Perms = await aes256EcbEncryptBlock(permsPlain, fileKey);

  return { U, UE, O, OE, Perms };
}

function collectStringsStd(node, out) {
  if (!node) return;
  if (node instanceof PDFString || node instanceof PDFHexString) { out.push(node); return; }
  if (node instanceof PDFDict) {
    const t = node.get(PDFName.of("Type"));
    const sig = t instanceof PDFName && t.asString() === "/Sig";
    for (const [k, v] of node.entries()) {
      if (sig && k.asString() === "/Contents") continue;
      collectStringsStd(v, out);
    }
    return;
  }
  if (node instanceof PDFArray) {
    for (const v of node.asArray()) collectStringsStd(v, out);
  }
}

/** Preserves the original string's type: PDFHexString stays hex, PDFString gets properly escaped. */
function setStrValueStd(obj, bytes) {
  obj.value = obj instanceof PDFHexString ? bytesToHex(bytes) : escapeLiteralBytesStd(bytes);
}

/**
 * Encrypt a plain PDF's bytes with the PDF Standard Security Handler.
 * @param {"rc4" | "aes128" | "aes256"} algorithm
 */
async function encryptStandard(srcBytes, userPassword, ownerPassword, algorithm) {
  const doc = await PDFDocument.load(srcBytes);
  const context = doc.context;
  const P = -3904;
  const encryptMetadata = true;
  const id0 = randomBytesStd(16);

  let V, R, n, O, U, OE, UE, Perms, fileKey;
  const isAES = algorithm !== "rc4";

  if (algorithm === "aes256") {
    V = 5; R = 6; n = 32;
    fileKey = randomBytesStd(32);
    ({ U, UE, O, OE, Perms } = await computeV5Entries(userPassword, ownerPassword, fileKey, P, encryptMetadata));
  } else {
    V = algorithm === "rc4" ? 2 : 4;
    R = algorithm === "rc4" ? 3 : 4;
    n = 16;
    O = computeOEntryStd(ownerPassword, userPassword, n);
    fileKey = computeFileKeyStd(userPassword, O, P, id0, n);
    U = computeUEntryStd(fileKey, id0);
  }

  async function encryptBytesFor(objNum, genNum, bytes) {
    if (algorithm === "aes256") {
      const iv = randomBytesStd(16);
      return concatStd(iv, await aesCbcEncryptStd(fileKey, iv, bytes));
    }
    const key = objectKeyStd(fileKey, objNum, genNum, isAES);
    if (algorithm === "aes128") {
      const iv = randomBytesStd(16);
      return concatStd(iv, await aesCbcEncryptStd(key, iv, bytes));
    }
    return new RC4(key).process(bytes); // rc4 — no IV, stream cipher
  }

  const strJobs = [];
  const streamJobs = [];
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    const objNum = ref.objectNumber, genNum = ref.generationNumber;
    if (obj instanceof PDFRawStream) {
      const typeObj = obj.dict.get(PDFName.of("Type"));
      const typeName = typeObj instanceof PDFName ? typeObj.asString() : undefined;
      if (typeName === "/XRef" || typeName === "/ObjStm") continue;
      const found = [];
      collectStringsStd(obj.dict, found);
      for (const s of found) strJobs.push({ obj: s, objNum, genNum });
      streamJobs.push({ stream: obj, objNum, genNum });
    } else {
      const found = [];
      collectStringsStd(obj, found);
      for (const s of found) strJobs.push({ obj: s, objNum, genNum });
    }
  }

  for (const job of strJobs) {
    const bytes = job.obj.asBytes();
    if (bytes.length === 0) continue;
    setStrValueStd(job.obj, await encryptBytesFor(job.objNum, job.genNum, bytes));
  }
  for (const job of streamJobs) {
    const bytes = job.stream.getContents();
    job.stream.contents = await encryptBytesFor(job.objNum, job.genNum, bytes);
  }

  let encryptDict;
  if (algorithm === "aes256") {
    encryptDict = context.obj({
      Filter: "Standard", V, R, Length: 256,
      CF: context.obj({ StdCF: context.obj({ Type: "CryptFilter", CFM: "AESV3", AuthEvent: "DocOpen", Length: 32 }) }),
      StmF: "StdCF", StrF: "StdCF",
      O: PDFHexString.of(bytesToHex(O)), U: PDFHexString.of(bytesToHex(U)),
      OE: PDFHexString.of(bytesToHex(OE)), UE: PDFHexString.of(bytesToHex(UE)),
      Perms: PDFHexString.of(bytesToHex(Perms)),
      P, EncryptMetadata: encryptMetadata,
    });
  } else if (algorithm === "aes128") {
    encryptDict = context.obj({
      Filter: "Standard", V, R, Length: 128,
      CF: context.obj({ StdCF: context.obj({ Type: "CryptFilter", CFM: "AESV2", AuthEvent: "DocOpen", Length: 16 }) }),
      StmF: "StdCF", StrF: "StdCF",
      O: PDFHexString.of(bytesToHex(O)), U: PDFHexString.of(bytesToHex(U)), P,
    });
  } else {
    encryptDict = context.obj({
      Filter: "Standard", V, R, Length: 128,
      O: PDFHexString.of(bytesToHex(O)), U: PDFHexString.of(bytesToHex(U)), P,
    });
  }
  context.trailerInfo.Encrypt = context.register(encryptDict);
  context.trailerInfo.ID = context.obj([PDFHexString.of(bytesToHex(id0)), PDFHexString.of(bytesToHex(id0))]);

  return doc.save({ useObjectStreams: false });
}

/**
 * A small unencrypted source PDF whose Info /Title and a text field's /V are
 * literal (parenthesized) strings containing an unescaped backslash and
 * unbalanced parens — the exact bytes that corrupt PDF syntax if a decrypter
 * writes ciphertext/plaintext back into a PDFString without escaping.
 */
async function buildEdgeCaseSourceDoc() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  page.drawText("Quarterly Report", { x: 54, y: 720, size: 22, font: bold });
  page.drawText("Edge-case literal strings must survive decryption intact.", { x: 54, y: 690, size: 11, font });

  const titleText = "Report (Q1) \\ total) draft";
  const fieldText = "(555) 123\\4567)";

  const infoDict = doc.getInfoDict();
  infoDict.set(PDFName.of("Title"), PDFString.of(escapeLiteralBytesStd(new TextEncoder().encode(titleText))));

  const form = doc.getForm();
  const field = form.createTextField("edgeCase");
  field.setText(fieldText);
  field.addToPage(page, { x: 54, y: 640, width: 240, height: 20 });
  field.acroField.dict.set(PDFName.of("V"), PDFString.of(escapeLiteralBytesStd(new TextEncoder().encode(fieldText))));

  return { bytes: await doc.save({ useObjectStreams: false }), titleText, fieldText };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  // 1. Photo PDF: two pages, each a large q95 JPEG plus selectable text.
  {
    const doc = await PDFDocument.create();
    doc.setTitle("Photo Report");
    doc.setAuthor("Audit Generator");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    for (let p = 0; p < 2; p++) {
      const page = await textPage(doc, font, bold, `Photo page ${p + 1}`, LOREM);
      const img = await doc.embedJpg(encodeJpeg(2400, 1600, 95));
      page.drawImage(img, { x: 54, y: 180, width: 504, height: 336 });
    }
    await save(doc, "photo-jpeg.pdf");
  }

  // 2. Screenshot-style PDF: large Flate (PNG) image with flat UI colours.
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = await textPage(doc, font, bold, "Screenshot", LOREM);
    const png = encodePng(1800, 1200, (x, y) => {
      if (y < 80) return [34, 34, 60];
      if (x < 300) return [240, 240, 245];
      const stripe = Math.floor(y / 40) % 2 === 0;
      return stripe ? [255, 255, 255] : [228, 236, 250];
    });
    const img = await doc.embedPng(png);
    page.drawImage(img, { x: 54, y: 200, width: 504, height: 336 });
    await save(doc, "screenshot-png.pdf");
  }

  // 3. Scanned: image only, no text layer.
  {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const img = await doc.embedJpg(encodeJpeg(1275, 1650, 85));
    page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
    await save(doc, "scanned-no-text.pdf");
  }

  // 4. Structured document for PDF to Word: headings, wrapped paragraphs, bullets, 2 pages, Letter.
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([612, 792]);
    let y = 720;
    const draw = (t, f, s, x = 54) => { page.drawText(t, { x, y, size: s, font: f, color: grayscale(0.1) }); y -= s * 1.35; };
    draw("Quarterly Report", bold, 24);
    y -= 6;
    draw("Summary", bold, 16);
    draw("Revenue grew steadily across all regions this quarter, driven by strong", font, 11);
    draw("renewals and a successful product launch in the second month.", font, 11);
    y -= 10;
    draw("The team expects similar momentum next quarter as new partners onboard", font, 11);
    draw("and the pricing changes take effect for existing customers.", font, 11);
    y -= 6;
    draw("Highlights", bold, 16);
    draw("• Revenue up 18 percent", font, 11, 66);
    draw("• Churn down to 2.1 percent", font, 11, 66);
    const p2 = doc.addPage([612, 792]);
    p2.drawText("Appendix", { x: 54, y: 720, size: 16, font: bold });
    p2.drawText("Detailed tables are available on request.", { x: 54, y: 696, size: 11, font });
    await save(doc, "structured-doc.pdf");
  }

  // 5. Page with its own /Rotate 90 and an offset CropBox (common in scanned/landscape files).
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = await textPage(doc, font, bold, "Rotated page", LOREM);
    page.setRotation(degrees(90));
    page.setCropBox(36, 36, 540, 720);
    await textPage(doc, font, bold, "Normal page", LOREM);
    await save(doc, "rotated-cropped.pdf");
  }

  // 6. Form + metadata document.
  {
    const doc = await PDFDocument.create();
    doc.setTitle("Signup Form");
    doc.setAuthor("Audit Generator");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = await textPage(doc, font, bold, "Form page", ["Name:"]);
    await textPage(doc, font, bold, "Second page", ["Keep me."]);
    await textPage(doc, font, bold, "Third page", ["Delete me."]);
    const form = doc.getForm();
    const field = form.createTextField("fullName");
    field.setText("Jane Doe");
    field.addToPage(page, { x: 110, y: 660, width: 200, height: 20 });
    await save(doc, "form-metadata.pdf");
  }

  // 7. Encrypted variants of the structured doc.
  {
    const src = await fs.readFile(path.join(outDir, "structured-doc.pdf"));
    await fs.writeFile(path.join(outDir, "owner-restricted.pdf"),
      await encryptPDF(new Uint8Array(src), "", { ownerPassword: "owner123", algorithm: "AES-256", allowCopying: false, allowModifying: false }));
    await fs.writeFile(path.join(outDir, "user-password.pdf"),
      await encryptPDF(new Uint8Array(src), "rizz123", { ownerPassword: "owner123", algorithm: "AES-256" }));
  }

  // 8. Images for JPG to PDF.
  await fs.writeFile(path.join(outDir, "phone-photo-rotated.jpg"), withExifOrientation(encodeJpeg(1600, 1200, 90), 6));
  await fs.writeFile(path.join(outDir, "photo-landscape.jpg"), encodeJpeg(3000, 2000, 90));
  await fs.writeFile(path.join(outDir, "graphic.png"), encodePng(800, 600, (x, y) => [x % 256, y % 256, 128]));

  // 9. AES-128 (V4/R4, /CFM /AESV2) variants of the structured doc — see encryptStandard above.
  {
    const src = await fs.readFile(path.join(outDir, "structured-doc.pdf"));
    await fs.writeFile(path.join(outDir, "aes128-owner-restricted.pdf"),
      await encryptStandard(new Uint8Array(src), "", "owner123", "aes128"));
    await fs.writeFile(path.join(outDir, "aes128-user-password.pdf"),
      await encryptStandard(new Uint8Array(src), "rizz123", "owner123", "aes128"));
  }

  // 10. Literal-string edge cases (unescaped backslash + unbalanced parens inside
  // encrypted literal strings) across RC4-128, AES-128 and AES-256, each with an
  // empty user password (owner-restricted) and a "rizz123" user password variant.
  {
    const { bytes: edgeSrc, titleText, fieldText } = await buildEdgeCaseSourceDoc();
    console.log("edge-case plaintext:", JSON.stringify({ titleText, fieldText }));
    const variants = [
      ["rc4128", "rc4"],
      ["aes128", "aes128"],
      ["aes256", "aes256"],
    ];
    for (const [tag, algorithm] of variants) {
      await fs.writeFile(path.join(outDir, `strings-${tag}-owner-restricted.pdf`),
        await encryptStandard(edgeSrc, "", "owner123", algorithm));
      await fs.writeFile(path.join(outDir, `strings-${tag}-user-password.pdf`),
        await encryptStandard(edgeSrc, "rizz123", "owner123", algorithm));
    }
  }

  // 11. Table document for PDF to Word: a heading, a 3-column x 4-row grid (each
  // cell drawn as its own text run so columns are detectable by x-position), and
  // a trailing paragraph — checks that only the grid becomes a table.
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([612, 792]);
    const cols = [54, 250, 400];
    let y = 720;
    page.drawText("Order Summary", { x: 54, y, size: 18, font: bold });
    y -= 40;
    const row = (cells, f = font) => {
      cells.forEach((c, i) => page.drawText(c, { x: cols[i], y, size: 11, font: f }));
      y -= 20;
    };
    row(["Item", "Qty", "Price"], bold);
    row(["Widget", "3", "9.00"]);
    row(["Gadget", "1", "25.00"]);
    row(["Gizmo", "2", "14.50"]);
    y -= 10;
    page.drawText("Thank you for your order.", { x: 54, y, size: 11, font });
    await save(doc, "table-doc.pdf");
  }

  const files = await fs.readdir(outDir);
  for (const f of files) {
    const { size } = await fs.stat(path.join(outDir, f));
    console.log(f.padEnd(28), (size / 1024).toFixed(0).padStart(6), "KB");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

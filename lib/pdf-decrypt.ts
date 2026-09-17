/**
 * Lossless PDF decryption for every PDF Standard Security Handler variant
 * RizzPDF's Unlock PDF tool is expected to see:
 *   - Classic RC4 (V1/V2, R2/R3)
 *   - V4 crypt filters (/CF /StdCF): AES-128 (/CFM /AESV2) or RC4 (/CFM /V2)
 *   - AES-256 (V5, R5/R6)
 *
 * We used to hand RC4/AES-256 off to `@pdfsmaller/pdf-decrypt`'s decryptPDF,
 * but it writes decrypted literal strings back into PDFString.value without
 * PDF escaping — a decrypted byte that happens to be `(`, `)`, `\` or raw
 * control/high-bit binary corrupts the literal string's syntax on save (see
 * escapeLiteralBytes below). This module implements all three variants
 * itself (PDF 32000-1 Algorithms 1/2/6/7 for the classic scheme, ISO
 * 32000-2 Algorithms 2.A/8/9/11/12 for AES-256 — reusing
 * `@pdfsmaller/pdf-decrypt`'s md5/RC4/computeHash2B/AES-256 primitives) so
 * every write-back goes through one correctly-escaping code path, and text,
 * forms and images stay intact instead of falling back to rasterized pages.
 */
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFString,
} from "pdf-lib";
import {
  md5,
  RC4,
  bytesToHex,
  computeHash2B,
  aes256CbcDecryptNoPad,
  aes256CbcDecryptWithKey,
  importAES256DecryptKey,
} from "@pdfsmaller/pdf-decrypt";

// Standard PDF padding string (PDF 32000-1 Algorithm 2).
const PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

type FilterKind = "aes" | "rc4" | "identity";

export class WrongPasswordError extends Error {}

// ---------------------------------------------------------------------------
// PDF literal-string escaping (PDF 32000-1 7.3.4.2). pdf-lib's PDFString
// writes `.value` between `(` `)` with NO escaping of its own, so any
// decrypted byte we write back must already be escaped here.
// ---------------------------------------------------------------------------
export function escapeLiteralBytes(bytes: Uint8Array): string {
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

function padPassword(password: string): Uint8Array {
  const pw = new TextEncoder().encode(password);
  const out = new Uint8Array(32);
  const n = Math.min(32, pw.length);
  out.set(pw.subarray(0, n));
  out.set(PADDING.subarray(0, 32 - n), n);
  return out;
}

/** PDF 2.0 password prep: UTF-8 bytes truncated to 127 bytes (used for AES-256 only). */
function truncatePassword(password: string): Uint8Array {
  const bytes = new TextEncoder().encode(password);
  return bytes.length > 127 ? bytes.slice(0, 127) : bytes;
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  return new RC4(key).process(data);
}

function xorKey(key: Uint8Array, i: number): Uint8Array {
  const out = new Uint8Array(key.length);
  for (let k = 0; k < key.length; k++) out[k] = key[k] ^ i;
  return out;
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function eqBytes(a: Uint8Array, b: Uint8Array, len: number): boolean {
  if (a.length < len || b.length < len) return false;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return false;
  return true;
}

function numOf(obj: PDFObject | undefined, def = 0): number {
  return obj instanceof PDFNumber ? obj.asNumber() : def;
}

function strBytes(obj: PDFObject | undefined): Uint8Array | null {
  if (obj instanceof PDFHexString) return obj.asBytes();
  if (obj instanceof PDFString) return obj.asBytes();
  return null;
}

/** Bypass pdf-lib's `readonly`/`private` fields to write decrypted content back in place. */
function setStringValue(obj: PDFString | PDFHexString, bytes: Uint8Array, isHex: boolean) {
  (obj as unknown as { value: string }).value = isHex ? bytesToHex(bytes) : escapeLiteralBytes(bytes);
}
function setStreamContents(stream: PDFRawStream, bytes: Uint8Array) {
  (stream as unknown as { contents: Uint8Array }).contents = bytes;
}

// ---- Algorithm 2: compute the file encryption key from a (padded) password (V1/V2/V4) ----
function computeFileKeyFromPadded(
  paddedPw: Uint8Array,
  O: Uint8Array,
  P: number,
  id0: Uint8Array,
  R: number,
  n: number,
  encryptMetadata: boolean,
): Uint8Array {
  const extra = R >= 4 && !encryptMetadata ? 4 : 0;
  const input = new Uint8Array(32 + O.length + 4 + id0.length + extra);
  let off = 0;
  input.set(paddedPw, off);
  off += 32;
  input.set(O, off);
  off += O.length;
  input[off++] = P & 0xff;
  input[off++] = (P >> 8) & 0xff;
  input[off++] = (P >> 16) & 0xff;
  input[off++] = (P >> 24) & 0xff;
  input.set(id0, off);
  off += id0.length;
  if (extra) {
    input.fill(0xff, off, off + 4);
    off += 4;
  }
  let hash = md5(input);
  if (R >= 3) {
    for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, n));
  }
  return hash.slice(0, n);
}

// ---- Algorithm 6: validate a user password against /U (V1/V2/V4) ----
function validateUserPassword(fileKey: Uint8Array, U: Uint8Array, id0: Uint8Array, R: number): boolean {
  if (R === 2) {
    const computed = rc4(fileKey, PADDING);
    return eqBytes(computed, U, 32);
  }
  const hash = md5(concatBytes(PADDING, id0));
  let result = rc4(fileKey, hash);
  for (let i = 1; i <= 19; i++) result = rc4(xorKey(fileKey, i), result);
  return eqBytes(result, U, 16);
}

// ---- Algorithm 7: recover the padded user password from an owner password + /O (V1/V2/V4) ----
function recoverUserPasswordFromOwner(ownerPassword: string, O: Uint8Array, R: number, n: number): Uint8Array {
  const paddedOwner = padPassword(ownerPassword);
  let hash = md5(paddedOwner);
  if (R >= 3) {
    // Unlike Algorithm 2's key derivation, these 50 rounds hash the full
    // 16-byte digest each time — truncation to `n` bytes happens once, after.
    for (let i = 0; i < 50; i++) hash = md5(hash);
  }
  const ownerKey = hash.slice(0, n);
  if (R === 2) return rc4(ownerKey, O);
  let result = O.slice(0, 32);
  for (let i = 19; i >= 0; i--) result = new Uint8Array(rc4(xorKey(ownerKey, i), result));
  return result;
}

/** Classic (V1/V2/V4) key derivation: try the password as user, then as owner. */
function computeClassicFileKey(
  password: string,
  O: Uint8Array,
  U: Uint8Array,
  P: number,
  id0: Uint8Array,
  R: number,
  n: number,
  encryptMetadata: boolean,
): Uint8Array | null {
  const fileKey = computeFileKeyFromPadded(padPassword(password), O, P, id0, R, n, encryptMetadata);
  if (validateUserPassword(fileKey, U, id0, R)) return fileKey;

  const recoveredUserPw = recoverUserPasswordFromOwner(password, O, R, n);
  const ownerFileKey = computeFileKeyFromPadded(recoveredUserPw, O, P, id0, R, n, encryptMetadata);
  if (validateUserPassword(ownerFileKey, U, id0, R)) return ownerFileKey;

  return null;
}

// ---- AES-256 (V5/R5-6): ISO 32000-2 Algorithms 2.A / 8 / 9 / 11 / 12 ----
async function computeAES256FileKey(
  password: string,
  O: Uint8Array,
  U: Uint8Array,
  OE: Uint8Array,
  UE: Uint8Array,
): Promise<Uint8Array | null> {
  const pwBytes = truncatePassword(password);

  // Try as user password (Algorithm 11).
  const uValidationSalt = U.slice(32, 40);
  const uHash = await computeHash2B(pwBytes, uValidationSalt, new Uint8Array(0));
  if (eqBytes(uHash, U.slice(0, 32), 32)) {
    const uKeySalt = U.slice(40, 48);
    const ueKey = await computeHash2B(pwBytes, uKeySalt, new Uint8Array(0));
    return aes256CbcDecryptNoPad(UE, ueKey, new Uint8Array(16));
  }

  // Try as owner password (Algorithm 12) — hashed together with the full 48-byte /U.
  const oValidationSalt = O.slice(32, 40);
  const oHash = await computeHash2B(pwBytes, oValidationSalt, U.slice(0, 48));
  if (eqBytes(oHash, O.slice(0, 32), 32)) {
    const oKeySalt = O.slice(40, 48);
    const oeKey = await computeHash2B(pwBytes, oKeySalt, U.slice(0, 48));
    return aes256CbcDecryptNoPad(OE, oeKey, new Uint8Array(16));
  }

  return null;
}

// ---- Per-object key (PDF 32000-1 Algorithm 1) — V1/V2/V4 only; AES-256 uses the file key as-is ----
function objectKey(fileKey: Uint8Array, objNum: number, genNum: number, isAES: boolean): Uint8Array {
  const extra = isAES ? 4 : 0;
  const input = new Uint8Array(fileKey.length + 5 + extra);
  input.set(fileKey, 0);
  let off = fileKey.length;
  input[off++] = objNum & 0xff;
  input[off++] = (objNum >> 8) & 0xff;
  input[off++] = (objNum >> 16) & 0xff;
  input[off++] = genNum & 0xff;
  input[off++] = (genNum >> 8) & 0xff;
  if (isAES) {
    input[off++] = 0x73; // s
    input[off++] = 0x41; // A
    input[off++] = 0x6c; // l
    input[off++] = 0x54; // T
  }
  const hash = md5(input);
  return hash.slice(0, Math.min(fileKey.length + 5, 16));
}

type DecryptSpec =
  | { mode: "rc4"; key: Uint8Array }
  | { mode: "aes128"; key: Uint8Array }
  | { mode: "aes256"; cryptoKey: CryptoKey };

async function decryptWith(spec: DecryptSpec, data: Uint8Array): Promise<Uint8Array> {
  if (spec.mode === "rc4") return rc4(spec.key, data);
  if (data.length <= 16) return new Uint8Array(0);
  const iv = data.slice(0, 16);
  const ciphertext = data.slice(16);
  if (ciphertext.length % 16 !== 0) return data;
  if (spec.mode === "aes256") return aes256CbcDecryptWithKey(ciphertext, spec.cryptoKey, iv);
  const cryptoKey = await crypto.subtle.importKey("raw", spec.key as BufferSource, "AES-CBC", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: iv as BufferSource }, cryptoKey, ciphertext as BufferSource);
  return new Uint8Array(plain);
}

function resolveFilterKind(cf: PDFDict | undefined, filterName: PDFObject | undefined): FilterKind {
  if (!(filterName instanceof PDFName)) return "identity";
  if (filterName.asString() === "/Identity") return "identity";
  if (!cf) return "identity";
  const entry = cf.get(filterName);
  if (!(entry instanceof PDFDict)) return "identity";
  const cfm = entry.get(PDFName.of("CFM"));
  if (!(cfm instanceof PDFName)) return "identity";
  const s = cfm.asString();
  if (s === "/AESV2" || s === "/AESV3") return "aes";
  if (s === "/V2") return "rc4";
  return "identity"; // /None or unknown
}

/** Determine whether a stream's own /Filter chain overrides StmF via an explicit /Crypt filter. */
function streamCryptOverride(dict: PDFDict): { identity: true } | { identity: false; name?: PDFName } {
  const filterVal = dict.get(PDFName.of("Filter"));
  const filters: PDFObject[] = filterVal instanceof PDFArray ? filterVal.asArray() : filterVal ? [filterVal] : [];
  const idx = filters.findIndex((f) => f instanceof PDFName && f.asString() === "/Crypt");
  if (idx === -1) return { identity: false }; // no override — use StmF as-is
  const parmsVal = dict.get(PDFName.of("DecodeParms"));
  const parmsList: PDFObject[] = parmsVal instanceof PDFArray ? parmsVal.asArray() : parmsVal ? [parmsVal] : [];
  const parms = parmsList[idx];
  const nameVal = parms instanceof PDFDict ? parms.get(PDFName.of("Name")) : undefined;
  if (!nameVal || (nameVal instanceof PDFName && nameVal.asString() === "/Identity")) return { identity: true };
  if (nameVal instanceof PDFName) return { identity: false, name: nameVal };
  return { identity: true };
}

function isSigDict(dict: PDFDict): boolean {
  const t = dict.get(PDFName.of("Type"));
  return t instanceof PDFName && t.asString() === "/Sig";
}

interface StrItem {
  obj: PDFString | PDFHexString;
  isHex: boolean;
  spec: DecryptSpec;
}

function collectStrings(node: PDFObject | undefined, spec: DecryptSpec, out: StrItem[]): void {
  if (!node) return;
  if (node instanceof PDFString) {
    out.push({ obj: node, isHex: false, spec });
    return;
  }
  if (node instanceof PDFHexString) {
    out.push({ obj: node, isHex: true, spec });
    return;
  }
  if (node instanceof PDFDict) {
    const sig = isSigDict(node);
    for (const [k, v] of node.entries()) {
      if (sig && k.asString() === "/Contents") continue; // signature /Contents is never encrypted
      collectStrings(v, spec, out);
    }
    return;
  }
  if (node instanceof PDFArray) {
    for (const v of node.asArray()) collectStrings(v, spec, out);
  }
}

interface EncryptParams {
  V: number;
  R: number;
  n: number;
  O: Uint8Array;
  U: Uint8Array;
  OE?: Uint8Array;
  UE?: Uint8Array;
  P: number;
  id0: Uint8Array;
  encryptMetadata: boolean;
  streamKind: FilterKind;
  stringKind: FilterKind;
  cfDict: PDFDict | undefined;
  encryptRefNum: number | null;
}

function readParams(doc: PDFDocument): EncryptParams | null {
  const context = doc.context;
  let enc: PDFObject | undefined = context.trailerInfo.Encrypt;
  let encryptRefNum: number | null = null;
  if (enc instanceof PDFRef) {
    encryptRefNum = enc.objectNumber;
    enc = context.lookup(enc);
  }
  if (!(enc instanceof PDFDict)) return null;

  const filter = enc.get(PDFName.of("Filter"));
  if (!(filter instanceof PDFName) || filter.asString() !== "/Standard") return null;

  const V = numOf(enc.get(PDFName.of("V")));
  const R = numOf(enc.get(PDFName.of("R")));
  if (![1, 2, 4, 5].includes(V)) return null;
  if (V === 5 && R !== 5 && R !== 6) return null;

  const O = strBytes(enc.get(PDFName.of("O")));
  const U = strBytes(enc.get(PDFName.of("U")));
  if (!O || !U) return null;

  const P = numOf(enc.get(PDFName.of("P")));

  const idArr = context.trailerInfo.ID;
  let id0 = new Uint8Array(0);
  if (idArr instanceof PDFArray && idArr.size() > 0) {
    id0 = new Uint8Array(strBytes(idArr.lookup(0)) ?? new Uint8Array(0));
  }

  if (V === 5) {
    const OE = strBytes(enc.get(PDFName.of("OE")));
    const UE = strBytes(enc.get(PDFName.of("UE")));
    if (!OE || !UE) return null;
    const emObj = enc.get(PDFName.of("EncryptMetadata"));
    const encryptMetadata = emObj instanceof PDFBool ? emObj.asBoolean() : true;
    return {
      V, R, n: 32, O, U, OE, UE, P, id0, encryptMetadata,
      streamKind: "aes", stringKind: "aes", cfDict: undefined, encryptRefNum,
    };
  }

  if (V === 4) {
    const cfVal = enc.get(PDFName.of("CF"));
    const cfDict = cfVal instanceof PDFDict ? cfVal : undefined;
    const stmfName = enc.get(PDFName.of("StmF"));
    const strfName = enc.get(PDFName.of("StrF"));

    let keyLenBits = numOf(enc.get(PDFName.of("Length")));
    if (!keyLenBits && cfDict && stmfName instanceof PDFName) {
      const cfEntry = cfDict.get(stmfName);
      if (cfEntry instanceof PDFDict) {
        const len = numOf(cfEntry.get(PDFName.of("Length")));
        if (len) keyLenBits = len < 40 ? len * 8 : len;
      }
    }
    if (!keyLenBits) keyLenBits = 128;

    const emObj = enc.get(PDFName.of("EncryptMetadata"));
    const encryptMetadata = emObj instanceof PDFBool ? emObj.asBoolean() : true;

    return {
      V, R, n: Math.floor(keyLenBits / 8), O, U, P, id0, encryptMetadata,
      streamKind: resolveFilterKind(cfDict, stmfName),
      stringKind: resolveFilterKind(cfDict, strfName),
      cfDict, encryptRefNum,
    };
  }

  // V1/V2: classic RC4, no crypt filters. Missing /Length defaults to 40 bits.
  const keyLenBits = numOf(enc.get(PDFName.of("Length"))) || 40;
  return {
    V, R, n: Math.floor(keyLenBits / 8), O, U, P, id0, encryptMetadata: true,
    streamKind: "rc4", stringKind: "rc4", cfDict: undefined, encryptRefNum,
  };
}

/**
 * Decrypt a PDF Standard Security Handler file — classic RC4 (V1/V2), V4
 * crypt filters (AES-128 or RC4), or AES-256 (V5) — losslessly. Text, forms
 * and images are preserved instead of being rasterized.
 *
 * Throws an Error containing "Incorrect password" if the given password is
 * wrong, and "Unsupported encryption" if the file uses a security handler
 * this module doesn't implement (e.g. public-key security, or a V/R
 * combination outside 1-5/2-6).
 */
export async function decryptPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const context = doc.context;

  const params = readParams(doc);
  if (!params) throw new Error("Unsupported encryption");
  const { V, R, n, O, U, OE, UE, P, id0, encryptMetadata, streamKind, stringKind, cfDict, encryptRefNum } = params;

  let fileKey: Uint8Array;
  let aes256CryptoKey: CryptoKey | undefined;

  if (V === 5) {
    const key = await computeAES256FileKey(password, O, U, OE!, UE!);
    if (!key) throw new WrongPasswordError("Incorrect password");
    fileKey = key;
    aes256CryptoKey = await importAES256DecryptKey(fileKey);
  } else {
    const key = computeClassicFileKey(password, O, U, P, id0, R, n, encryptMetadata);
    if (!key) throw new WrongPasswordError("Incorrect password");
    fileKey = key;
  }

  const specFor = (objNum: number, genNum: number, kind: FilterKind): DecryptSpec | null => {
    if (kind === "identity") return null;
    if (V === 5) return { mode: "aes256", cryptoKey: aes256CryptoKey! };
    const key = objectKey(fileKey, objNum, genNum, kind === "aes");
    return kind === "aes" ? { mode: "aes128", key } : { mode: "rc4", key };
  };

  const strItems: StrItem[] = [];
  const streamItems: { stream: PDFRawStream; spec: DecryptSpec }[] = [];

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (encryptRefNum !== null && ref.objectNumber === encryptRefNum) continue;
    const objNum = ref.objectNumber;
    const genNum = ref.generationNumber;

    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      const typeObj = dict.get(PDFName.of("Type"));
      const typeName = typeObj instanceof PDFName ? typeObj.asString() : undefined;
      if (typeName === "/XRef" || typeName === "/ObjStm") continue; // structural streams are never encrypted
      const skipMetadata = typeName === "/Metadata" && !encryptMetadata;

      if (!skipMetadata) {
        const strSpec = specFor(objNum, genNum, stringKind);
        if (strSpec) collectStrings(dict, strSpec, strItems);
      }

      if (!skipMetadata) {
        const override = streamCryptOverride(dict);
        let kind: FilterKind;
        if (override.identity) kind = "identity";
        else if (override.name) kind = resolveFilterKind(cfDict, override.name);
        else kind = streamKind;
        const streamSpec = specFor(objNum, genNum, kind);
        if (streamSpec) streamItems.push({ stream: obj, spec: streamSpec });
      }
    } else {
      const strSpec = specFor(objNum, genNum, stringKind);
      if (strSpec) collectStrings(obj, strSpec, strItems);
    }
  }

  await Promise.all(
    strItems.map(async (item) => {
      const bytes = item.obj.asBytes();
      if (bytes.length === 0) return;
      const dec = await decryptWith(item.spec, bytes);
      setStringValue(item.obj, dec, item.isHex);
    }),
  );
  await Promise.all(
    streamItems.map(async (item) => {
      const raw = item.stream.getContents();
      const dec = await decryptWith(item.spec, raw);
      setStreamContents(item.stream, dec);
    }),
  );

  delete context.trailerInfo.Encrypt;

  return doc.save({ useObjectStreams: false });
}

// Generates realistic PDFs/images for the tool audit tests (test-fixtures/audit).
// Usage: node scripts/generate-audit-fixtures.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { PDFDocument, StandardFonts, rgb, grayscale, degrees } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

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

  const files = await fs.readdir(outDir);
  for (const f of files) {
    const { size } = await fs.stat(path.join(outDir, f));
    console.log(f.padEnd(28), (size / 1024).toFixed(0).padStart(6), "KB");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

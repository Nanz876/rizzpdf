import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb, grayscale } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "test-fixtures", "smoke");

const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2eSrsAAAAASUVORK5CYII=";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function savePdf(doc, filename) {
  const bytes = await doc.save();
  const fullPath = path.join(outDir, filename);
  await fs.writeFile(fullPath, Buffer.from(bytes));
  return new Uint8Array(bytes);
}

async function createBaseDoc(title, subtitle, bullets = []) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("Codex Smoke Fixture Generator");
  doc.setSubject("RizzPDF smoke test fixture");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);

  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.99, 0.98, 0.96) });
  page.drawRectangle({ x: 36, y: 724, width: 540, height: 44, color: rgb(0.9, 0.17, 0.12) });
  page.drawText(title, { x: 52, y: 738, size: 24, font: bold, color: rgb(1, 1, 1) });
  page.drawText(subtitle, { x: 52, y: 700, size: 13, font, color: grayscale(0.2) });

  let y = 648;
  bullets.forEach((bullet, index) => {
    page.drawText(`${index + 1}. ${bullet}`, { x: 60, y, size: 13, font, color: grayscale(0.15) });
    y -= 28;
  });

  page.drawText("RizzPDF smoke fixture", { x: 52, y: 60, size: 10, font, color: grayscale(0.45) });
  return doc;
}

async function createPlainTextPdf() {
  const doc = await createBaseDoc("Plain Text Fixture", "Use for Protect, Compress, Watermark, and Repair sanity checks.", [
    "Selectable body text should remain selectable after non-raster tools.",
    "This file contains only vector text and simple shapes.",
    "Expected result: no password, no corruption, 1 page.",
  ]);
  await savePdf(doc, "plain-text.pdf");
}

async function createMultiPagePdf() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= 6; i += 1) {
    const page = doc.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: i % 2 ? rgb(0.97, 0.98, 1) : rgb(1, 0.98, 0.95) });
    page.drawText("Multi-page Fixture", { x: 56, y: 730, size: 26, font: bold, color: rgb(0.12, 0.12, 0.2) });
    page.drawText(`Page ${i} of 6`, { x: 56, y: 690, size: 18, font: bold, color: rgb(0.82, 0.18, 0.14) });
    page.drawText("This page exists to test split, batch, page numbers, rotate, and organize flows.", {
      x: 56,
      y: 646,
      size: 13,
      font: regular,
      color: grayscale(0.18),
    });
    page.drawText(`Marker: SMOKE-PAGE-${i}`, { x: 56, y: 620, size: 13, font: regular, color: grayscale(0.18) });
  }

  await savePdf(doc, "multi-page.pdf");
}

async function createImageHeavyPdf() {
  const doc = await PDFDocument.create();
  const labelFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const png = await doc.embedPng(Buffer.from(SAMPLE_PNG_BASE64, "base64"));

  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const page = doc.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.98, 0.98, 0.98) });
    page.drawText(`Image Heavy Fixture ${pageIndex + 1}/3`, {
      x: 48,
      y: 748,
      size: 20,
      font: labelFont,
      color: rgb(0.16, 0.16, 0.16),
    });

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const x = 48 + col * 258;
        const y = 520 - row * 182;
        page.drawImage(png, { x, y, width: 240, height: 150 });
      }
    }
  }

  await savePdf(doc, "image-heavy.pdf");
}

async function createProtectedFixtures() {
  const baseDoc = await createBaseDoc(
    "Protected Fixture",
    "User password: rizz123. Owner password: owner123.",
    [
      "Use this to verify the Unlock and Protect tools.",
      "Expected viewer password prompt on the protected variant.",
      "The restricted variant should open without a prompt but remain restricted.",
    ]
  );
  const bytes = await savePdf(baseDoc, "protected-source.pdf");

  const userProtected = await encryptPDF(bytes, "rizz123", {
    ownerPassword: "owner123",
    algorithm: "AES-256",
    allowPrinting: true,
    allowHighQualityPrint: true,
    allowModifying: false,
    allowCopying: false,
    allowAnnotating: false,
    allowFillingForms: true,
    allowExtraction: false,
    allowAssembly: false,
  });
  await fs.writeFile(path.join(outDir, "protected-user-password.pdf"), Buffer.from(userProtected));

  const restrictedOnly = await encryptPDF(bytes, "", {
    ownerPassword: "owner123",
    algorithm: "AES-256",
    allowPrinting: false,
    allowHighQualityPrint: false,
    allowModifying: false,
    allowCopying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowExtraction: false,
    allowAssembly: false,
  });
  await fs.writeFile(path.join(outDir, "restricted-no-open-password.pdf"), Buffer.from(restrictedOnly));
}

async function createMalformedPdf() {
  const doc = await createBaseDoc("Malformed Fixture", "Valid PDF with extra trailing junk for repair tolerance tests.", [
    "Many viewers still open this file normally.",
    "A tolerant repair pipeline should be able to normalize it.",
    "The extra bytes are appended after %%EOF.",
  ]);
  const bytes = await savePdf(doc, "malformed-source.pdf");
  const malformed = Buffer.concat([
    Buffer.from(bytes),
    Buffer.from("\n% RizzPDF malformed smoke tail\nTHIS_IS_TRAILING_GARBAGE_BUT_COMMONLY_TOLERATED\n", "utf8"),
  ]);
  await fs.writeFile(path.join(outDir, "mildly-malformed.pdf"), malformed);
}

async function main() {
  await ensureDir(outDir);
  await createPlainTextPdf();
  await createMultiPagePdf();
  await createImageHeavyPdf();
  await createProtectedFixtures();
  await createMalformedPdf();
  console.log(`Generated smoke fixtures in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

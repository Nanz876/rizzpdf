// @vitest-environment node
// The Unicode-font rollout: Watermark, Sign text stamps and Excel to PDF should
// render Cyrillic/Greek/Vietnamese (via the embedded DejaVu fallback) instead of
// rejecting it, while still reporting scripts DejaVu can't draw (CJK). The font
// is fetched from /fonts in the browser; here we read it off disk.
import { describe, it, expect, beforeAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { watermarkPDF, signPDFMulti } from "@/lib/pdf-tools";
import { excelToPdf } from "@/lib/tools/excel-to-pdf";
import { setUnicodeFontLoader } from "@/lib/tools/pdf-font";

beforeAll(() => {
  setUnicodeFontLoader(async (bold) =>
    new Uint8Array(fs.readFileSync(path.resolve(__dirname, `../../public/fonts/DejaVuSans${bold ? "-Bold" : ""}.ttf`)))
  );
});

const FIX = path.resolve(__dirname, "../../test-fixtures");
const plainPdf = () => new File([fs.readFileSync(path.join(FIX, "smoke/plain-text.pdf"))], "p.pdf", { type: "application/pdf" });

async function pdfText(blob: Blob): Promise<string> {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await real.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, verbosity: 0 }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + " ";
  }
  return out;
}

describe("Watermark — Unicode", () => {
  it("renders a Cyrillic watermark (was rejected before)", async () => {
    const r = await watermarkPDF(plainPdf(), { text: "Секрет" });
    expect(r.success).toBe(true);
    expect(await pdfText(r.blob!)).toContain("Секрет");
  });
  it("still reports CJK as unsupported", async () => {
    const r = await watermarkPDF(plainPdf(), { text: "机密" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/can't draw yet|Chinese/i);
  });
});

describe("Sign — Unicode text stamp", () => {
  it("places a Greek text stamp", async () => {
    const r = await signPDFMulti(plainPdf(), [
      { page: 1, kind: "text", text: "Υπογραφή", x: 0.1, yFromTop: 0.1, fontSizeRatio: 0.03 },
    ]);
    expect(r.success).toBe(true);
    expect(await pdfText(r.blob!)).toContain("Υπογραφή");
  });
});

describe("Excel to PDF — Unicode", () => {
  async function xlsxWith(value: string): Promise<File> {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.getCell("A1").value = value;
    const buf = await wb.xlsx.writeBuffer();
    return new File([buf], "s.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  it("renders Cyrillic cell text (was rejected before)", async () => {
    const r = await excelToPdf(await xlsxWith("Привет"));
    expect(r.success).toBe(true);
    expect(await pdfText(r.blob!)).toContain("Привет");
  });
  it("reports CJK cell text as unsupported", async () => {
    const r = await excelToPdf(await xlsxWith("你好"));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/can't draw yet|Chinese/i);
  });
});

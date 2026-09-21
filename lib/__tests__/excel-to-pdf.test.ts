// @vitest-environment node
// Excel to PDF: pagination is the hard part here, so most of these tests read
// the produced PDF back with pdf.js (one string per page) and check which
// page which text landed on, rather than just checking the PDF "has text".
// pdfjs mock/helpers copied from batch3.test.ts / pdf-to-word.test.ts.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { excelToPdf, readWorkbook } from "@/lib/tools/excel-to-pdf";

const FIX = path.resolve(__dirname, "../../test-fixtures");
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: MIME[path.extname(rel)] });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function openPdfjs(bytes: Uint8Array) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return real.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

/** One joined text string per page of the produced PDF. */
async function pageTexts(blob: Blob): Promise<string[]> {
  const doc = await openPdfjs(await bytesOf(blob));
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

const WORKBOOK = "audit/financials.xlsx";

describe("readWorkbook", () => {
  it("lists sheets with their used row/column counts", async () => {
    const { sheets } = await readWorkbook(await fixture(WORKBOOK));
    const byName = Object.fromEntries(sheets.map((s) => [s.name, s]));
    expect(byName.Data).toEqual({ name: "Data", rows: 4, cols: 5 });
    expect(byName.Empty).toEqual({ name: "Empty", rows: 0, cols: 0 });
    expect(byName.Wide.cols).toBe(20);
  });
});

describe("excelToPdf: value fidelity", () => {
  it("shows cell values, a formatted date (not a serial number), and a formula's cached result", async () => {
    const r = await excelToPdf(await fixture(WORKBOOK), { sheets: ["Data"] });
    expect(r.success).toBe(true);
    const [text] = await pageTexts(r.blob!);

    // Plain string values.
    expect(text).toContain("Widget");
    expect(text).toContain("Gadget");

    // The "Purchased On" cell (Jan 15 2026, numFmt "m/d/yyyy") must read as a
    // date, not the raw Excel serial number that's actually stored on disk.
    expect(text).toContain("1/15/2026");
    expect(text).not.toMatch(/46037/);

    // The "Total" formula cell (=B2*1.1, cached result 132.55, numFmt
    // currency) must show the cached result, never the formula text.
    expect(text).toContain("132.55");
    expect(text).not.toMatch(/B2\*1\.1/);
  });

  it("gives a clear message for a file that isn't a valid .xlsx", async () => {
    const r = await excelToPdf(await fixture("audit/structured-doc.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/excel|workbook|xlsx/i);
  });
});

describe("excelToPdf: pagination", () => {
  it("splits a wide sheet across pages by column group, repeating the first column", async () => {
    const r = await excelToPdf(await fixture(WORKBOOK), { sheets: ["Wide"] });
    expect(r.success).toBe(true);
    const texts = await pageTexts(r.blob!);

    expect(texts.length).toBeGreaterThan(1);
    // The first column ("Row1", the row-identifying value) must appear on
    // every page produced for this sheet — that's the whole point.
    for (const t of texts) expect(t).toContain("Row1");
    // The last column only exists on the page that reaches that far right;
    // it must not appear on the very first page, or nothing actually split.
    expect(texts[texts.length - 1]).toContain("R1C20");
    expect(texts[0]).not.toContain("R1C20");
  });

  it("repeats the header row on page 2 of a long sheet", async () => {
    const r = await excelToPdf(await fixture(WORKBOOK), { sheets: ["Tall"] });
    expect(r.success).toBe(true);
    const texts = await pageTexts(r.blob!);

    expect(texts.length).toBeGreaterThan(1);
    expect(texts[0]).toContain("Header");
    expect(texts[0]).toContain("Row 1");
    expect(texts[1]).toContain("Header"); // repeated
    expect(texts.join(" ")).toContain("Row 79"); // the tail of the sheet made it onto some page
  });

  it("starts each sheet on its own new page", async () => {
    const r = await excelToPdf(await fixture(WORKBOOK), { sheets: ["Data", "Wide"] });
    expect(r.success).toBe(true);
    const texts = await pageTexts(r.blob!);

    // "Data" is small and fits on a single page; "Wide" then starts fresh.
    expect(texts[0]).toContain("Widget");
    expect(texts[0]).not.toContain("Row1");
    expect(texts[1]).toContain("Row1");
    expect(texts[1]).not.toContain("Widget");
  });

  it("doesn't crash on an empty sheet", async () => {
    const r = await excelToPdf(await fixture(WORKBOOK), { sheets: ["Empty"] });
    expect(r.success).toBe(true);
    const texts = await pageTexts(r.blob!);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("Empty");
  });
});

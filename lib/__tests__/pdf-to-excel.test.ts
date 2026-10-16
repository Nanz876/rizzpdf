// @vitest-environment node
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

import { pdfToExcel, parseCell, NO_TEXT_FOR_EXCEL } from "@/lib/tools/pdf-to-excel";

const FIX = path.resolve(__dirname, "../../test-fixtures");
async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

// Read the first worksheet's cells back out of the produced .xlsx.
async function firstSheet(blob: Blob) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  const ws = wb.worksheets[0];
  const rows: unknown[][] = [];
  ws.eachRow((row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (c) => cells.push(c.value));
    rows.push(cells);
  });
  return rows;
}

describe("parseCell", () => {
  it("keeps plain text as text", () => {
    expect(parseCell("Widget")).toBe("Widget");
    expect(parseCell("Q1 2024")).toBe("Q1 2024");
  });
  it("parses numbers, currency, thousands and percentages", () => {
    expect(parseCell("9.00")).toBe(9);
    expect(parseCell("$1,250.50")).toBe(1250.5);
    expect(parseCell("(1,000)")).toBe(-1000);
    expect(parseCell("18%")).toBeCloseTo(0.18);
  });
  it("leaves ambiguous strings alone", () => {
    expect(parseCell("12-34-56")).toBe("12-34-56");
    expect(parseCell("")).toBe("");
  });
  it("keeps identifiers that only look numeric as text", () => {
    expect(parseCell("02139")).toBe("02139"); // ZIP with a leading zero
    expect(parseCell("007")).toBe("007");
    expect(parseCell("1234567890123456")).toBe("1234567890123456"); // 16-digit card number
    // Genuine numbers still parse.
    expect(parseCell("2024")).toBe(2024);
    expect(parseCell("0")).toBe(0);
    expect(parseCell("0.5")).toBe(0.5);
  });
});

describe("pdfToExcel", () => {
  it("writes a table's cells into real columns with numeric values", async () => {
    const r = await pdfToExcel(await fixture("audit/table-doc.pdf"));
    expect(r.success).toBe(true);
    expect(r.filename).toBe("table-doc.xlsx");
    expect(r.blob!.type).toContain("spreadsheetml");
    const rows = await firstSheet(r.blob!);
    const flat = rows.map((r) => r.map(String).join("|"));
    expect(flat.some((l) => /Item\|Qty\|Price/.test(l))).toBe(true);
    // Numbers came through as numbers, not strings.
    const widget = rows.find((r) => r[0] === "Widget");
    expect(widget).toBeTruthy();
    expect(widget!.some((c) => c === 3)).toBe(true);
    expect(widget!.some((c) => c === 9)).toBe(true);
  });

  it("points scanned PDFs at OCR", async () => {
    const r = await pdfToExcel(await fixture("audit/scanned-no-text.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toBe(NO_TEXT_FOR_EXCEL);
  });

  it("asks for an unlock on password-protected files", async () => {
    const r = await pdfToExcel(await fixture("audit/user-password.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password-protected/);
  });
});

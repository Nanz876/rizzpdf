// PDF to Excel: pulls tabular data out of a PDF's text layer and writes a real
// .xlsx workbook (one sheet per page). Tables are found the same way PDF to
// Markdown finds them — rows that share column positions (see detectTableRuns).
// Rows that aren't part of a table are written one-cell-per-row so nothing is
// lost. Numbers and currency/percent values are written as real numbers so
// they're usable in Excel. Runs entirely client-side.
//
// exceljs ships separate Node and browser builds; we only ever `await
// import("exceljs")` from inside an async function so the bundler resolves the
// browser build for the client and it's never evaluated during SSR. See the
// note in lib/tools/excel-to-pdf.ts for the full explanation.
import { toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";
import { extractPageText, hasText, rowSegments, detectTableRuns, tableGrid, type PageText } from "@/lib/tools/pdf-text";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const NO_TEXT_FOR_EXCEL =
  "This PDF has no selectable text — it looks like a scanned document. Run it through OCR PDF first, then convert the result.";

export type CellValue = string | number;

/** Parse a cell string as a number when it unambiguously is one (incl. $, %, thousands separators, parenthesised negatives). */
export function parseCell(text: string): CellValue {
  const t = text.trim();
  if (!t) return "";
  // Must contain a digit and only number-ish characters.
  if (!/\d/.test(t) || !/^[\s$€£¥()+\-%,.\d]+$/.test(t)) return t;
  const negative = /^\(.*\)$/.test(t);
  const percent = /%\s*$/.test(t);
  let body = t.replace(/[()$€£¥%\s]/g, "");
  // Thousands separators: commas with groups of 3 digits. Strip them; keep the decimal point.
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(body)) body = body.replace(/,/g, "");
  if (!/^[+-]?\d*\.?\d+$/.test(body)) return t;
  let n = parseFloat(body);
  if (Number.isNaN(n)) return t;
  if (negative) n = -n;
  if (percent) n = n / 100;
  return n;
}

/** Turn one page's extracted text into a grid of rows. Tables keep their columns; other lines become a single cell. */
export function pageToGrid(page: PageText): CellValue[][] {
  const segRows = page.rows.map((r) => rowSegments(r));
  const runs = detectTableRuns(segRows);
  const runAt = new Map<number, number>();
  runs.forEach((run, ri) => {
    for (let i = run.start; i <= run.end; i++) runAt.set(i, ri);
  });

  const grid: CellValue[][] = [];
  for (let i = 0; i < page.rows.length; i++) {
    const ri = runAt.get(i);
    if (ri !== undefined) {
      const run = runs[ri];
      for (const cells of tableGrid(segRows.slice(run.start, run.end + 1), run.cols)) {
        grid.push(cells.map(parseCell));
      }
      i = run.end;
      continue;
    }
    // Non-table line: preserve each gap-separated segment as its own cell so
    // loose columns still line up, but keep at least the whole line.
    const segs = segRows[i];
    if (segs.length) grid.push(segs.map((s) => parseCell(s.text)));
  }
  return grid;
}

/** Sheet names must be ≤31 chars and free of []:*?/\\, and unique within the book. */
function sheetName(index: number, used: Set<string>): string {
  let base = `Page ${index + 1}`.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    base = `Page ${index + 1}`.slice(0, 28);
    name = `${base} (${n++})`;
  }
  used.add(name.toLowerCase());
  return name;
}

async function buildWorkbook(pages: PageText[]): Promise<Any> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "RizzPDF";
  wb.created = new Date();
  const used = new Set<string>();

  pages.forEach((page, i) => {
    const ws = wb.addWorksheet(sheetName(i, used));
    const grid = pageToGrid(page);
    const widths: number[] = [];
    for (const row of grid) {
      const added = ws.addRow(row);
      row.forEach((v, c) => {
        if (typeof v === "number") added.getCell(c + 1).numFmt = Number.isInteger(v) ? "#,##0" : "#,##0.00";
        widths[c] = Math.max(widths[c] ?? 0, String(v).length);
      });
    }
    widths.forEach((w, c) => {
      ws.getColumn(c + 1).width = Math.min(60, Math.max(8, w + 2));
    });
  });

  // exceljs needs at least one sheet.
  if (!wb.worksheets.length) wb.addWorksheet("Page 1");
  return wb;
}

export async function pdfToExcel(file: File): Promise<ToolResult> {
  try {
    const pages = await extractPageText(file);
    if (!hasText(pages)) return { success: false, error: NO_TEXT_FOR_EXCEL };
    const wb = await buildWorkbook(pages);
    const buffer = await wb.xlsx.writeBuffer();
    return {
      success: true,
      blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename: file.name.replace(/\.pdf$/i, "") + ".xlsx",
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Conversion failed. Make sure the file is a valid PDF.") };
  }
}

// Excel to PDF: renders an .xlsx workbook as a real, selectable-text PDF table.
// Runs entirely client-side (exceljs decodes the workbook; pdf-lib draws pages
// — neither ever touches the network or a server).
//
// The hard part of spreadsheets is that they are the wrong shape for a page:
// this file's job is column-width measurement, column-group pagination for
// wide sheets, and row-height/wrap pagination for tall ones. See
// `planColumnGroups` and `renderSheet` for the pagination logic.
//
// exceljs ships two builds: a Node one (package.json "main", which touches
// `process.versions.node` at module scope and would crash instantly in a
// browser bundle) and a browser one (package.json "browser" field, a UMD
// bundle with no Node dependencies). We only ever `await import("exceljs")`
// from inside an async function — never at module top level — so bundlers
// resolve it per compilation target (browser field for the client bundle)
// and it's never evaluated during server-side rendering either. pdf-lib has
// no such split and is imported normally, matching the rest of lib/.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Cell, Worksheet } from "exceljs";
import { toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

export const NOT_XLSX_MESSAGE =
  "Couldn't read this as an Excel workbook. Make sure it's a valid, unprotected .xlsx file.";

export interface SheetInfo {
  name: string;
  rows: number;
  cols: number;
}

export interface ExcelToPdfOptions {
  /** Sheet names to include, in workbook order if omitted. Default: all sheets. */
  sheets?: string[];
  orientation?: "portrait" | "landscape" | "auto";
  pageSize?: "A4" | "Letter";
  /** Repeat the first (header) row of each sheet at the top of every page. Default true. */
  repeatHeader?: boolean;
  /** Draw thin borders around every cell. Default true. */
  gridlines?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function loadWorkbook(file: File): Promise<Any> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook;
}

/** Used range of a worksheet, 1-indexed and inclusive on all sides (exceljs convention). Null for a genuinely empty sheet. */
interface UsedRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

function usedRange(ws: Worksheet): UsedRange | null {
  try {
    const d = ws.dimensions as Any;
    if (!d || typeof d.top !== "number" || d.bottom < d.top || d.right < d.left) return null;
    const range = { top: d.top, left: d.left, bottom: d.bottom, right: d.right };
    // A round-tripped .xlsx often stores <dimension ref="A1"/> even for a
    // sheet nobody ever wrote a cell in, so exceljs reports a phantom 1x1
    // range instead of an empty one. Confirm there's real content before
    // trusting it, so a genuinely empty sheet still gets treated as empty.
    for (let r = range.top; r <= range.bottom; r++) {
      const row = ws.getRow(r);
      for (let c = range.left; c <= range.right; c++) {
        if (formatCellText(row.getCell(c))) return range;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function readWorkbook(file: File): Promise<{ sheets: SheetInfo[] }> {
  let workbook: Any;
  try {
    workbook = await loadWorkbook(file);
  } catch {
    throw new Error(NOT_XLSX_MESSAGE);
  }
  const sheets: SheetInfo[] = workbook.worksheets.map((ws: Worksheet) => {
    const range = usedRange(ws);
    return {
      name: ws.name,
      rows: range ? range.bottom - range.top + 1 : 0,
      cols: range ? range.right - range.left + 1 : 0,
    };
  });
  return { sheets };
}

// ─── Cell value formatting ──────────────────────────────────────────────────
// exceljs's own `cell.text` just calls `.toString()` on the raw value (a Date
// becomes "Wed Sep 20 2026 00:00:00 GMT+...", a formula becomes "[object
// Object]"), and never applies the cell's number format. We format from
// `cell.value` (drilling into `.result` for formulas) and `cell.numFmt`
// ourselves so dates, percentages, currency and thousands separators read
// the way they do in Excel.

// exceljs's ValueType enum, inlined so this module has no runtime dependency
// on the dynamically-imported exceljs module (Null=0, Merge=1, Number=2,
// String=3, Date=4, Hyperlink=5, Formula=6, SharedString=7, RichText=8,
// Boolean=9, Error=10).
const VT = { Number: 2, Date: 4, Formula: 6, Boolean: 9 } as const;

function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569); // 25569 = days between 1899-12-30 and 1970-01-01
  const fractionalDay = serial - Math.floor(serial);
  const ms = utcDays * 86400 * 1000 + Math.round(fractionalDay * 86400 * 1000);
  return new Date(ms);
}

function isDateNumFmt(fmt?: string): boolean {
  if (!fmt || /^general$/i.test(fmt)) return false;
  const stripped = fmt.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  return /[hmsyd]/i.test(stripped);
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATE_TOKEN_RE = /^(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm|a\/p)/i;

/** Is the "m" token at `idx` in `fmt` minutes (adjacent to h/s) rather than month? */
function isMinuteToken(fmt: string, idx: number): boolean {
  const before = fmt.slice(0, idx).toLowerCase();
  const after = fmt.slice(idx).toLowerCase();
  if (/^mm?:?ss/.test(after)) return true;
  const lastH = before.lastIndexOf("h");
  const lastD = before.lastIndexOf("d");
  return lastH > lastD;
}

/** Format a JS Date using an Excel number-format string (or a sensible default when there isn't one). */
function formatDateValue(date: Date, fmt?: string): string {
  const pattern = !fmt || /^general$/i.test(fmt) ? "m/d/yyyy" : fmt.split(";")[0];
  const Y = date.getUTCFullYear();
  const Mo = date.getUTCMonth();
  const D = date.getUTCDate();
  const H24 = date.getUTCHours();
  const Mi = date.getUTCMinutes();
  const S = date.getUTCSeconds();
  const hasAMPM = /am\/pm|a\/p/i.test(pattern);
  const H12 = ((H24 + 11) % 12) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");

  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '"') {
      const end = pattern.indexOf('"', i + 1);
      out += pattern.slice(i + 1, end === -1 ? pattern.length : end);
      i = end === -1 ? pattern.length : end + 1;
      continue;
    }
    if (ch === "[") {
      const end = pattern.indexOf("]", i + 1);
      i = end === -1 ? pattern.length : end + 1;
      continue;
    }
    const m = pattern.slice(i).match(DATE_TOKEN_RE);
    if (m) {
      const tok = m[0];
      const lower = tok.toLowerCase();
      if (lower === "yyyy") out += String(Y);
      else if (lower === "yy") out += pad(Y % 100);
      else if (lower === "mmmm") out += MONTHS_LONG[Mo];
      else if (lower === "mmm") out += MONTHS_SHORT[Mo];
      else if (lower === "mm") out += isMinuteToken(pattern, i) ? pad(Mi) : pad(Mo + 1);
      else if (lower === "m") out += isMinuteToken(pattern, i) ? String(Mi) : String(Mo + 1);
      else if (lower === "dddd") out += DAYS_LONG[date.getUTCDay()];
      else if (lower === "ddd") out += DAYS_SHORT[date.getUTCDay()];
      else if (lower === "dd") out += pad(D);
      else if (lower === "d") out += String(D);
      else if (lower === "hh") out += pad(hasAMPM ? H12 : H24);
      else if (lower === "h") out += String(hasAMPM ? H12 : H24);
      else if (lower === "ss") out += pad(S);
      else if (lower === "s") out += String(S);
      else if (lower === "am/pm") out += H24 < 12 ? "AM" : "PM";
      else if (lower === "a/p") out += H24 < 12 ? "A" : "P";
      i += tok.length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function countDecimalPlaces(fmt: string): number {
  const positive = fmt.split(";")[0].replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  const m = positive.match(/\.([0#]+)/);
  return m ? m[1].length : 0;
}

/** Excel's "General" display: integers as-is, decimals trimmed of trailing zeros, no thousands separators. */
function formatGeneralNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const s = value.toPrecision(15);
  if (/e/i.test(s)) return String(value);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatNumberValue(value: number, fmt?: string): string {
  if (!fmt || /^general$/i.test(fmt)) return formatGeneralNumber(value);
  const positive = fmt.split(";")[0];
  if (positive.includes("%")) {
    const decimals = countDecimalPlaces(positive);
    return `${(value * 100).toFixed(decimals)}%`;
  }
  const decimals = countDecimalPlaces(positive);
  const hasThousands = /#,#|0,0/.test(positive);
  const currencyMatch = positive.match(/[$€£¥]/);
  const currency = currencyMatch ? currencyMatch[0] : "";
  const abs = Math.abs(value);
  const numStr = hasThousands
    ? abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : abs.toFixed(decimals);
  const body = `${currency}${numStr}`;
  if (value >= 0) return body;
  return /\(.*\)/.test(fmt) ? `(${body})` : `-${body}`;
}

/** The cell's value formatted the way Excel would display it: dates as dates, formulas as their cached result, etc. */
function formatCellText(cell: Cell): string {
  // `cell.type` is the raw type (Formula included); `cell.effectiveType` has
  // already resolved through formulas to the result's own type, which is
  // handy for alignment (see `cellAlign`) but means it can't be used here to
  // *detect* a formula cell in the first place.
  const rawType = cell.type as number;
  const raw: unknown = rawType === VT.Formula ? (cell as unknown as { result?: unknown }).result : cell.value;
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return formatDateValue(raw, cell.numFmt);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.richText)) return (obj.richText as { text: string }[]).map((t) => t.text).join("");
    if (typeof obj.text === "string" && typeof obj.hyperlink === "string") return obj.text;
    if (typeof obj.error === "string") return obj.error;
    return "";
  }
  if (typeof raw === "number") {
    return isDateNumFmt(cell.numFmt) ? formatDateValue(excelSerialToDate(raw), cell.numFmt) : formatNumberValue(raw, cell.numFmt);
  }
  if (typeof raw === "boolean") return raw ? "TRUE" : "FALSE";
  return String(raw);
}

function cellAlign(cell: Cell): "left" | "right" | "center" {
  const h = cell.alignment?.horizontal;
  if (h === "right" || h === "left" || h === "center") return h;
  const type = cell.effectiveType as number;
  if (type === VT.Number || type === VT.Date) return "right";
  if (type === VT.Boolean) return "center";
  return "left";
}

// ─── Text measurement / wrapping ────────────────────────────────────────────
// pdf-lib's standard fonts measure with `widthOfTextAtSize` — never a
// character-count guess, per the spreadsheet-to-PDF spec this file follows.

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const ellipsis = "…";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(text.slice(0, mid) + ellipsis, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
}

/**
 * Word-wraps `text` to fit `maxWidth`. Every cell wraps regardless of the
 * source's wrapText style — in a bordered table there's no adjacent cell for
 * overflow to spill into, so wrapping (and growing the row) is the only way
 * to never cut content off. A single unbroken token that still doesn't fit
 * on its own line is the one case truncated with an ellipsis.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r\n|\r|\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
      } else {
        // `word` alone doesn't fit even on its own line — the one case that truncates.
        lines.push(truncateToWidth(word, font, size, maxWidth));
        current = "";
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

// ─── Encoding check ──────────────────────────────────────────────────────────
// pdf-lib's standard fonts are WinAnsi-only. Rather than let pdf-lib throw a
// raw "WinAnsi cannot encode..." error (or silently drop characters), scan
// up front and fail with a clear message naming the offending character.

function findUnencodableChar(sheets: Worksheet[], font: PDFFont): string | null {
  for (const ws of sheets) {
    const range = usedRange(ws);
    if (!range) continue;
    for (let r = range.top; r <= range.bottom; r++) {
      const row = ws.getRow(r);
      for (let c = range.left; c <= range.right; c++) {
        const text = formatCellText(row.getCell(c));
        if (!text) continue;
        try {
          font.encodeText(text);
        } catch {
          for (const ch of text) {
            try {
              font.encodeText(ch);
            } catch {
              return ch;
            }
          }
          return text[0] ?? "?";
        }
      }
    }
  }
  return null;
}

// ─── Merged cells ────────────────────────────────────────────────────────────

interface MergeSpan {
  rowspan: number;
  colspan: number;
}

function colLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Master-cell spans, keyed "row:col", plus the set of "row:col" cells covered (and thus skipped) by a merge. */
function collectMerges(ws: Worksheet): { merges: Map<string, MergeSpan>; covered: Set<string> } {
  const merges = new Map<string, MergeSpan>();
  const covered = new Set<string>();
  const raw: string[] = (ws.model as Any)?.merges ?? [];
  for (const rangeStr of raw) {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rangeStr);
    if (!m) continue;
    const c1 = colLettersToNumber(m[1]);
    const r1 = parseInt(m[2], 10);
    const c2 = colLettersToNumber(m[3]);
    const r2 = parseInt(m[4], 10);
    merges.set(`${r1}:${c1}`, { rowspan: r2 - r1 + 1, colspan: c2 - c1 + 1 });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        covered.add(`${r}:${c}`);
      }
    }
  }
  return { merges, covered };
}

/**
 * Width (and column span actually present in `g`) of a cell starting at
 * position `pos` in the column group `g`. A merge that crosses a column-group
 * boundary is capped to however much of it landed in this group — the rest
 * of its columns are on a different page, so there's nothing to span into.
 * Row-spanning merges are rendered as a single row tall (see `drawRow`):
 * the value still appears exactly once (never duplicated), just without the
 * taller box: a reasonable trade-off given a spreadsheet-to-PDF table already
 * disclaims pixel-perfect layout.
 */
function spanWidthAt(g: number[], widths: number[], pos: number, colIdx: number, colspan: number): number {
  let width = widths[pos];
  for (let k = 1; k < colspan; k++) {
    if (g[pos + k] === colIdx + k) width += widths[pos + k];
    else break;
  }
  return width;
}

// ─── Column widths & pagination ─────────────────────────────────────────────

const MARGIN = 36;
const BODY_SIZE = 9;
const LINE_HEIGHT = BODY_SIZE * 1.25;
const PAD_X = 4;
const PAD_Y = 3;
const DEFAULT_ROW_HEIGHT = 15;
const MIN_COL_WIDTH = 30;
const MAX_AUTO_COL_WIDTH = 220;
const TITLE_SIZE = 16;
const TITLE_SPACE = 30;

const PAGE_SIZES: Record<"A4" | "Letter", { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

/** Excel column width (characters, Calibri-11-ish) to points. Approximate — Excel itself doesn't guarantee pixel-exact widths across fonts either. */
function excelWidthToPt(width: number): number {
  const px = width * 7 + 5;
  return px * 0.75;
}

function columnNaturalWidths(
  ws: Worksheet,
  range: UsedRange,
  merges: Map<string, MergeSpan>,
  covered: Set<string>,
  font: PDFFont,
  boldFont: PDFFont
): number[] {
  const numCols = range.right - range.left + 1;
  const widths = new Array<number>(numCols).fill(MIN_COL_WIDTH);
  for (let ci = 0; ci < numCols; ci++) {
    const c = range.left + ci;
    const col = ws.getColumn(c);
    if (col.width) {
      widths[ci] = Math.max(MIN_COL_WIDTH, excelWidthToPt(col.width));
      continue;
    }
    let maxW = MIN_COL_WIDTH;
    for (let r = range.top; r <= range.bottom; r++) {
      const key = `${r}:${c}`;
      if (covered.has(key)) continue;
      const span = merges.get(key);
      if (span && span.colspan > 1) continue; // a wide merged title shouldn't blow out one column
      const text = formatCellText(ws.getRow(r).getCell(c));
      if (!text) continue;
      const w = (r === range.top ? boldFont : font).widthOfTextAtSize(text, BODY_SIZE) + PAD_X * 2;
      if (w > maxW) maxW = Math.min(w, MAX_AUTO_COL_WIDTH);
    }
    widths[ci] = maxW;
  }
  return widths;
}

/** Scale widths proportionally so they sum to exactly `target` (shrinking wide sheets, filling narrow ones). */
function scaleToFit(widths: number[], target: number): number[] {
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const scale = target / total;
  return widths.map((w) => w * scale);
}

/**
 * Splits column indices [0..n) into groups that each fit `availWidth`. Every
 * group after the first repeats column 0 first so a row can still be
 * identified on continuation pages — the requirement this tool is built
 * around. A single column wider than `availWidth` still gets its own group
 * (never dropped); it's shrunk to fit by `scaleToFit` afterwards.
 */
function planColumnGroups(widths: number[], availWidth: number, repeatFirst: boolean): number[][] {
  const total = widths.reduce((a, b) => a + b, 0);
  if (widths.length <= 1 || total <= availWidth) return [widths.map((_, i) => i)];

  const firstWidth = widths[0];
  const groups: number[][] = [];
  let i = 0;
  let isFirstGroup = true;
  while (i < widths.length) {
    const group: number[] = [];
    let used = 0;
    if (!isFirstGroup && repeatFirst) {
      group.push(0);
      used += firstWidth;
    }
    let addedNew = false;
    while (i < widths.length) {
      if (!isFirstGroup && repeatFirst && i === 0) {
        i++;
        continue;
      }
      const w = widths[i];
      if (addedNew && used + w > availWidth) break;
      group.push(i);
      used += w;
      addedNew = true;
      i++;
    }
    groups.push(group);
    isFirstGroup = false;
  }
  return groups;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

interface RenderCtx {
  font: PDFFont;
  boldFont: PDFFont;
  pageSize: { width: number; height: number };
  repeatHeader: boolean;
  gridlines: boolean;
  orientationOpt: "portrait" | "landscape" | "auto";
}

function drawTitle(page: PDFPage, name: string, ctx: RenderCtx, pageH: number) {
  const maxWidth = page.getWidth() - MARGIN * 2;
  const line = wrapText(name, ctx.boldFont, TITLE_SIZE, maxWidth)[0] ?? name;
  page.drawText(line, { x: MARGIN, y: pageH - MARGIN - TITLE_SIZE * 0.8, size: TITLE_SIZE, font: ctx.boldFont, color: rgb(0.1, 0.1, 0.1) });
}

function drawRow(
  page: PDFPage,
  ws: Worksheet,
  range: UsedRange,
  g: number[],
  widths: number[],
  ri: number,
  rh: number,
  yTop: number,
  ctx: RenderCtx,
  merges: Map<string, MergeSpan>,
  covered: Set<string>,
  isHeader: boolean
) {
  const r = range.top + ri;
  const rowTotalWidth = widths.reduce((a, b) => a + b, 0);
  if (isHeader) {
    page.drawRectangle({ x: MARGIN, y: yTop - rh, width: rowTotalWidth, height: rh, color: rgb(0.93, 0.93, 0.95) });
  }
  let x = MARGIN;
  for (let pos = 0; pos < g.length; pos++) {
    const colIdx = g[pos];
    const c = range.left + colIdx;
    const key = `${r}:${c}`;
    const cellW = widths[pos];
    if (covered.has(key)) {
      x += cellW;
      continue;
    }
    const span = merges.get(key);
    const boxW = span && span.colspan > 1 ? spanWidthAt(g, widths, pos, colIdx, span.colspan) : cellW;

    if (ctx.gridlines) {
      page.drawRectangle({ x, y: yTop - rh, width: boxW, height: rh, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.5 });
    }
    const cell = ws.getRow(r).getCell(c);
    const text = formatCellText(cell);
    if (text) {
      const font = isHeader || cell.font?.bold ? ctx.boldFont : ctx.font;
      const align = cellAlign(cell);
      const lines = wrapText(text, ctx.font, BODY_SIZE, Math.max(4, boxW - PAD_X * 2));
      let ly = yTop - PAD_Y - BODY_SIZE * 0.85;
      for (const line of lines) {
        if (ly < yTop - rh) break; // overflowed this row's box (extreme case) — stop rather than bleed into the next row
        const lineWidth = font.widthOfTextAtSize(line, BODY_SIZE);
        let lx = x + PAD_X;
        if (align === "right") lx = x + boxW - PAD_X - lineWidth;
        else if (align === "center") lx = x + (boxW - lineWidth) / 2;
        page.drawText(line, { x: lx, y: ly, size: BODY_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
        ly -= LINE_HEIGHT;
      }
    }
    x += boxW;
  }
}

function renderSheet(pdf: PDFDocument, ws: Worksheet, ctx: RenderCtx) {
  const range = usedRange(ws);
  const portraitContent = ctx.pageSize.width - MARGIN * 2;

  if (!range) {
    const pageW = ctx.orientationOpt === "landscape" ? ctx.pageSize.height : ctx.pageSize.width;
    const pageH = ctx.orientationOpt === "landscape" ? ctx.pageSize.width : ctx.pageSize.height;
    const page = pdf.addPage([pageW, pageH]);
    drawTitle(page, ws.name, ctx, pageH);
    page.drawText("This sheet is empty.", {
      x: MARGIN,
      y: pageH - MARGIN - TITLE_SPACE - 14,
      size: 10,
      font: ctx.font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return;
  }

  const { merges, covered } = collectMerges(ws);
  const naturalWidths = columnNaturalWidths(ws, range, merges, covered, ctx.font, ctx.boldFont);
  const naturalTotal = naturalWidths.reduce((a, b) => a + b, 0);
  const landscape = ctx.orientationOpt === "landscape" || (ctx.orientationOpt === "auto" && naturalTotal > portraitContent);
  const pageW = landscape ? ctx.pageSize.height : ctx.pageSize.width;
  const pageH = landscape ? ctx.pageSize.width : ctx.pageSize.height;
  const contentW = pageW - MARGIN * 2;

  const groups = planColumnGroups(naturalWidths, contentW, true);
  const groupWidths = groups.map((g) => scaleToFit(g.map((i) => naturalWidths[i]), contentW));

  const numRows = range.bottom - range.top + 1;
  const rowHeights = new Array<number>(numRows).fill(DEFAULT_ROW_HEIGHT);
  groups.forEach((g, gi) => {
    const widths = groupWidths[gi];
    for (let ri = 0; ri < numRows; ri++) {
      const r = range.top + ri;
      const explicitHeight = ws.getRow(r).height;
      let h = explicitHeight && explicitHeight > 0 ? explicitHeight : DEFAULT_ROW_HEIGHT;
      g.forEach((colIdx, pos) => {
        const c = range.left + colIdx;
        const key = `${r}:${c}`;
        if (covered.has(key)) return;
        const span = merges.get(key);
        const cellWidth = span && span.colspan > 1 ? spanWidthAt(g, widths, pos, colIdx, span.colspan) : widths[pos];
        const text = formatCellText(ws.getRow(r).getCell(c));
        if (!text) return;
        const lines = wrapText(text, ctx.font, BODY_SIZE, Math.max(4, cellWidth - PAD_X * 2));
        const needed = lines.length * LINE_HEIGHT + PAD_Y * 2;
        if (needed > h) h = needed;
      });
      if (h > rowHeights[ri]) rowHeights[ri] = h;
    }
  });

  let firstPageOfSheet = true;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const widths = groupWidths[gi];
    let ri = 0;
    while (ri < numRows) {
      const page = pdf.addPage([pageW, pageH]);
      let y = pageH - MARGIN;
      if (firstPageOfSheet) {
        drawTitle(page, ws.name, ctx, pageH);
        y -= TITLE_SPACE;
      }
      const startRi = ri;

      if (ctx.repeatHeader && startRi > 0) {
        drawRow(page, ws, range, g, widths, 0, rowHeights[0], y, ctx, merges, covered, true);
        y -= rowHeights[0];
      }

      while (ri < numRows) {
        const rh = rowHeights[ri];
        if (y - rh < MARGIN && ri > startRi) break; // always place at least one row so we can't loop forever
        drawRow(page, ws, range, g, widths, ri, rh, y, ctx, merges, covered, ri === 0);
        y -= rh;
        ri++;
      }
      firstPageOfSheet = false;
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function excelToPdf(file: File, opts: ExcelToPdfOptions = {}): Promise<ToolResult> {
  try {
    let workbook: Any;
    try {
      workbook = await loadWorkbook(file);
    } catch {
      return { success: false, error: NOT_XLSX_MESSAGE };
    }

    let sheets: Worksheet[] = workbook.worksheets;
    if (!sheets.length) return { success: false, error: "This workbook has no sheets to convert." };
    if (opts.sheets && opts.sheets.length) {
      const wanted = new Set(opts.sheets);
      sheets = sheets.filter((ws) => wanted.has(ws.name));
      if (!sheets.length) return { success: false, error: "None of the selected sheets were found in this workbook." };
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    const badChar = findUnencodableChar(sheets, font);
    if (badChar) {
      return {
        success: false,
        error: `This spreadsheet has a character standard PDF fonts can't display ("${badChar}"). Replace it with plain text and convert again.`,
      };
    }

    const ctx: RenderCtx = {
      font,
      boldFont,
      pageSize: PAGE_SIZES[opts.pageSize ?? "A4"],
      repeatHeader: opts.repeatHeader ?? true,
      gridlines: opts.gridlines ?? true,
      orientationOpt: opts.orientation ?? "auto",
    };

    for (const ws of sheets) renderSheet(pdf, ws, ctx);

    const bytes = await pdf.save();
    return {
      success: true,
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
      filename: file.name.replace(/\.xlsx$/i, ".pdf"),
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Couldn't convert this spreadsheet. Make sure it's a valid .xlsx file.") };
  }
}

// Shared text-layout extraction for the text-based converters (PDF to Markdown,
// PDF to Excel, Compare PDF). pdf.js gives positioned text runs; this groups
// them into visual rows in reading order, in the page's displayed (top-left,
// y-down) coordinate space. No DOM access, but pdf.js itself must be loaded on
// the main thread like everywhere else in the app.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type TextItem = { str: string; x: number; y: number; w: number; size: number; bold: boolean; italic: boolean };
/** One baseline's worth of text, items sorted left to right. */
export type TextRow = { y: number; size: number; items: TextItem[] };
export interface PageText {
  width: number;
  height: number;
  rows: TextRow[];
}

export async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

/** Group items into rows by shared baseline, top to bottom, each row left to right. */
export function groupRows(items: TextItem[]): TextRow[] {
  const sorted = [...items].sort((p, q) => p.y - q.y || p.x - q.x);
  const rows: TextItem[][] = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= Math.max(2, it.size * 0.4));
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows
    .map((r) => {
      r.sort((p, q) => p.x - q.x);
      return { y: r[0].y, size: Math.max(...r.map((i) => i.size)), items: r };
    })
    .sort((p, q) => p.y - q.y);
}

/** Join a row's items into one string, inserting a space where there's a visible gap. */
export function rowText(row: TextRow): string {
  let text = "";
  let prevEnd = -Infinity;
  for (const it of row.items) {
    const gap = it.x - prevEnd;
    if (text && gap > it.size * 0.15 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
    text += it.str;
    prevEnd = it.x + it.w;
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

/** A run of text in a row that's separated from its neighbours by a wide gap (a likely table cell). */
export type Segment = { x: number; end: number; text: string };

/** Split a row into segments wherever the gap between items exceeds `gapFactor` × font size. */
export function rowSegments(row: TextRow, gapFactor = 2): Segment[] {
  const segs: { x: number; end: number; items: TextItem[] }[] = [];
  for (const it of row.items) {
    const last = segs[segs.length - 1];
    if (last && it.x - last.end <= it.size * gapFactor) {
      last.items.push(it);
      last.end = Math.max(last.end, it.x + it.w);
    } else {
      segs.push({ x: it.x, end: it.x + it.w, items: [it] });
    }
  }
  return segs.map((s) => ({ x: s.x, end: s.end, text: rowText({ y: row.y, size: row.size, items: s.items }) }));
}

const COL_TOL = 4; // pt — segments closer than this are treated as one occupied band
const MIN_SEP = 4; // pt — a column separator must be at least this wide
const ROW_SPLIT_FACTOR = 1.8; // a vertical gap this many × the median row pitch starts a new table

/**
 * A run of consecutive rows (inclusive indices) that form a table.
 * `cols` holds the column separators (cut lines) as ascending x-positions; the
 * table has `cols.length + 1` columns. Cells are assigned by their horizontal
 * centre, so columns of any alignment — left, right or centred — line up.
 */
export interface TableRun {
  start: number;
  end: number;
  cols: number[];
}

type Interval = [number, number];

/**
 * Column separators for a block of rows: the vertical whitespace stripes that run
 * through the WHOLE block (no row has any text in them). Computed from the union of
 * every segment's x-span, not a per-row intersection — so a sparse row (a lone
 * "SUBTOTAL … 18,500") or a wrapped header can't collapse the columns, and each
 * value still lands in its own column. Returns the gap midpoints, ascending.
 */
function columnCuts(rows: Segment[][]): number[] {
  const spans: Interval[] = [];
  for (const segs of rows) for (const s of segs) if (s.end > s.x) spans.push([s.x, s.end]);
  if (spans.length < 2) return [];
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [[spans[0][0], spans[0][1]]];
  for (let k = 1; k < spans.length; k++) {
    const last = merged[merged.length - 1];
    if (spans[k][0] <= last[1] + COL_TOL) last[1] = Math.max(last[1], spans[k][1]);
    else merged.push([spans[k][0], spans[k][1]]);
  }
  const cuts: number[] = [];
  for (let k = 1; k < merged.length; k++) {
    if (merged[k][0] - merged[k - 1][1] >= MIN_SEP) cuts.push((merged[k - 1][1] + merged[k][0]) / 2);
  }
  return cuts;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Split a contiguous block of row indices wherever the vertical gap between two rows
 * is an outlier (> ROW_SPLIT_FACTOR × the median gap) — a blank line that separates
 * two stacked tables, so they don't merge into one mis-columned block. `ys` is each
 * row's baseline (top-down); without it the block stays whole.
 */
function splitByRowGap(indices: number[], ys?: number[]): number[][] {
  if (!ys || indices.length < 3) return [indices];
  const gaps: number[] = [];
  for (let k = 1; k < indices.length; k++) gaps.push(Math.abs(ys[indices[k]] - ys[indices[k - 1]]));
  const med = median(gaps.filter((g) => g > 0));
  if (!med) return [indices];
  const groups: number[][] = [];
  let cur = [indices[0]];
  for (let k = 1; k < indices.length; k++) {
    if (Math.abs(ys[indices[k]] - ys[indices[k - 1]]) > ROW_SPLIT_FACTOR * med) {
      groups.push(cur);
      cur = [indices[k]];
    } else cur.push(indices[k]);
  }
  groups.push(cur);
  return groups;
}

/**
 * Find table-like runs: maximal spans of consecutive rows that each have ≥2 segments
 * (ordinary prose is one segment per row, so it never qualifies), split on blank-line
 * boundaries, each needing ≥2 rows and ≥1 column separator. Under-detects on purpose;
 * a missed table just reads as text. Pass `ys` (row baselines) to separate stacked
 * tables.
 */
export function detectTableRuns(segRows: Segment[][], ys?: number[]): TableRun[] {
  const runs: TableRun[] = [];
  const n = segRows.length;
  let i = 0;
  while (i < n) {
    if (segRows[i].length < 2) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && segRows[j].length >= 2) j++;
    const block = Array.from({ length: j - i }, (_, k) => i + k);
    for (const grp of splitByRowGap(block, ys)) {
      if (grp.length < 2) continue;
      const cuts = columnCuts(grp.map((k) => segRows[k]));
      if (cuts.length >= 1) runs.push({ start: grp[0], end: grp[grp.length - 1], cols: cuts });
    }
    i = j;
  }
  return runs;
}

/** Index of the column a centre x falls into, given ascending cut lines. */
export function columnIndex(cuts: number[], center: number): number {
  let idx = 0;
  for (const c of cuts) {
    if (center >= c) idx++;
    else break;
  }
  return idx;
}

/** Lay a run of segment rows onto its columns, joining segments that land in one cell. */
export function tableGrid(segRows: Segment[][], cuts: number[]): string[][] {
  const nCols = cuts.length + 1;
  return segRows.map((segs) => {
    const cells: string[][] = Array.from({ length: nCols }, () => []);
    for (const s of segs) cells[columnIndex(cuts, (s.x + s.end) / 2)].push(s.text);
    return cells.map((parts) => parts.join(" ").trim());
  });
}

/** A cell that reads as a number (so a row holding one is data, not a wrapped header). */
const NUMERIC_CELL = /\d/;
function isNumericCell(s: string): boolean {
  return NUMERIC_CELL.test(s) && /^[\s$€£¥()+\-%,.\d]+$/.test(s.trim());
}

/**
 * Merge a table's leading wrapped-header rows into one. A column header that wraps
 * onto two or three lines ("DESCRIPTION OF" / "SERVICE") arrives as separate rows;
 * join the leading rows that contain no numeric cell, per column, so the header is a
 * single row above the data. Only runs while every leading row is non-numeric and at
 * least two of them are, so a normal one-line header or the first data row is left
 * alone.
 */
export function mergeWrappedHeaderRows(grid: string[][]): string[][] {
  let h = 0;
  while (h < grid.length && grid[h].every((c) => !isNumericCell(c))) h++;
  if (h < 2) return grid;
  const cols = grid[0].length;
  const header = Array.from({ length: cols }, (_, c) =>
    grid.slice(0, h).map((r) => r[c] ?? "").filter(Boolean).join(" ").trim()
  );
  return [header, ...grid.slice(h)];
}

/**
 * Extract every page's text as rows. `withStyles` also resolves real font names
 * (for bold/italic), which costs an operator-list pass per page.
 */
export async function extractPageText(
  input: File | Uint8Array,
  opts: { withStyles?: boolean } = {}
): Promise<PageText[]> {
  const pdfjsLib = await getPdfjsLib();
  const data = input instanceof Uint8Array ? input.slice() : new Uint8Array(await input.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: PageText[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const fontNames = new Map<string, string>();
      if (opts.withStyles) {
        try {
          await page.getOperatorList();
          for (const id of Object.keys(content.styles)) {
            const font = page.commonObjs.has(id) ? (page.commonObjs.get(id) as Any) : null;
            if (font?.name) fontNames.set(id, String(font.name));
          }
        } catch {
          // Styling is best-effort.
        }
      }
      const items: TextItem[] = [];
      for (const raw of content.items as Any[]) {
        if (!("str" in raw) || !raw.str.trim()) continue;
        const [a, b, , , e, f] = pdfjsLib.Util.transform(viewport.transform, raw.transform);
        const name = fontNames.get(raw.fontName) ?? content.styles[raw.fontName]?.fontFamily ?? "";
        items.push({
          str: raw.str,
          x: e,
          y: f,
          w: raw.width,
          size: Math.round(Math.hypot(a, b) * 2) / 2,
          bold: /bold|black|heavy|semibold/i.test(name),
          italic: /italic|oblique/i.test(name),
        });
      }
      pages.push({ width: viewport.width, height: viewport.height, rows: groupRows(items) });
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
}

export function hasText(pages: PageText[]): boolean {
  return pages.some((p) => p.rows.length > 0);
}

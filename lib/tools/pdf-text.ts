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

const COL_TOL = 4; // pt
const MIN_GUTTER = 3; // pt — a column separator must survive a gap at least this wide in every row

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

/** The internal gaps of a row: the whitespace bands that sit between two of its segments. */
function rowGaps(segs: Segment[]): Interval[] {
  const gaps: Interval[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const lo = segs[i].end;
    const hi = segs[i + 1].x;
    if (hi - lo > COL_TOL) gaps.push([lo, hi]);
  }
  return gaps;
}

/** Intersect two sets of ascending, disjoint intervals into the bands common to both. */
function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi - lo > COL_TOL) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return out;
}

/** Cut lines (gutter midpoints) wide enough to act as column separators. */
function cutsFrom(gutters: Interval[]): number[] {
  return gutters.filter(([lo, hi]) => hi - lo >= MIN_GUTTER).map(([lo, hi]) => (lo + hi) / 2);
}

/**
 * Find table-like runs: two or more consecutive rows that share at least one vertical
 * gutter — a band of whitespace that every row in the run leaves open between its
 * segments. Columns are the bands between those gutters, so right-aligned numeric
 * columns and centred columns are detected as readily as left-aligned ones. Ordinary
 * prose has a single segment (and so no internal gap) per row, so it never qualifies.
 * Under-detects on purpose; a missed table just reads as text.
 */
export function detectTableRuns(segRows: Segment[][]): TableRun[] {
  const runs: TableRun[] = [];
  if (!segRows.length) return runs;
  const gaps = segRows.map(rowGaps);

  let runStart = 0;
  let common = gaps[0];
  const flush = (endExclusive: number) => {
    const cuts = cutsFrom(common);
    if (endExclusive - runStart >= 2 && cuts.length >= 1) {
      runs.push({ start: runStart, end: endExclusive - 1, cols: cuts });
    }
  };
  for (let i = 1; i <= gaps.length; i++) {
    const next = i < gaps.length && common.length ? intersectIntervals(common, gaps[i]) : [];
    if (i < gaps.length && cutsFrom(next).length >= 1) {
      common = next;
      continue;
    }
    flush(i);
    runStart = i;
    common = i < gaps.length ? gaps[i] : [];
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

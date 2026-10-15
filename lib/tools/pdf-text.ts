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

/** A run of consecutive rows (inclusive indices) that share ≥2 column start positions. */
export interface TableRun {
  start: number;
  end: number;
  cols: number[];
}

/**
 * Find table-like runs: two or more consecutive rows whose segments start at two or
 * more shared x-positions. Ordinary prose has a single segment per row, so it never
 * qualifies. Under-detects on purpose; a missed table just reads as text.
 */
export function detectTableRuns(segRows: Segment[][]): TableRun[] {
  const runs: TableRun[] = [];
  if (!segRows.length) return runs;
  const starts = segRows.map((s) => s.map((g) => g.x));
  const intersect = (a: number[], b: number[]) => a.filter((x) => b.some((y) => Math.abs(x - y) <= COL_TOL));
  let runStart = 0;
  let common = starts[0];
  for (let i = 1; i <= starts.length; i++) {
    const next = i < starts.length ? intersect(common, starts[i]) : [];
    if (i < starts.length && next.length >= 2) {
      common = next;
      continue;
    }
    if (i - runStart >= 2 && common.length >= 2) runs.push({ start: runStart, end: i - 1, cols: common });
    runStart = i;
    common = i < starts.length ? starts[i] : [];
  }
  return runs;
}

/** Index of the column a segment starting at `x` belongs to, given ascending column starts. */
export function columnIndex(cols: number[], x: number): number {
  let idx = 0;
  for (let c = 0; c < cols.length; c++) if (x + COL_TOL >= cols[c]) idx = c;
  return idx;
}

/** Lay a run of segment rows onto its shared columns, joining segments that land in one cell. */
export function tableGrid(segRows: Segment[][], cols: number[]): string[][] {
  return segRows.map((segs) => {
    const cells: string[][] = cols.map(() => []);
    for (const s of segs) cells[columnIndex(cols, s.x)].push(s.text);
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

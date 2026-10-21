// PDF to Word: converts selectable text into a real .docx, preserving images
// and simple grid tables in place. Runs entirely client-side (pdf.js decodes
// the PDF and extracts images; the "canvas" step below only ever runs in the
// browser — see imageObjectToPng).
import { toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";
import {
  rowSegments,
  detectTableRuns,
  tableGrid,
  mergeWrappedHeaderRows,
  type Segment,
  type TableRun,
} from "@/lib/tools/pdf-text";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const NO_TEXT_MESSAGE =
  "This PDF has no selectable text — it looks like a scanned document. RizzPDF can't read text from images yet (no OCR).";

const DASH_RE = /^[-–]\s+/;
const BULLET_RE = /^[•●▪◦‣∙·\-–]\s+/;
const BULLET_GLYPH_RE = /^[•●▪◦‣∙·]\s+/;

type TextItem = { str: string; x: number; y: number; w: number; size: number; bold: boolean; italic: boolean };
type Line = { text: string; x: number; y: number; size: number; bold: boolean; italic: boolean };
/** One baseline's worth of raw items, kept (unmerged) so table columns can be detected. */
type Row = { y: number; size: number; items: TextItem[] };
type Para = { lines: Line[]; bullet: boolean };
type ImageBlock = { y: number; widthPt: number; heightPt: number; png: Uint8Array };
type Block =
  | { y: number; kind: "para"; para: Para }
  | { y: number; kind: "table"; run: TableRun }
  | { y: number; kind: "image"; img: ImageBlock };

async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

// ─── Table detection ────────────────────────────────────────────────────────
// Detection, grid assignment and wrapped-header merging are shared with PDF to
// Excel / Markdown via lib/tools/pdf-text.ts, so all three tools reconstruct
// tables the same way: columns are the vertical whitespace stripes running
// through the whole table block (robust to right-aligned numbers, sparse rows
// like a lone SUBTOTAL, and headers wrapped onto several lines). Here we only add
// the .docx-specific column widths derived from those column cut lines.

/** Proportional column widths (in twips) from the run's cut lines, summing to the content width. */
function columnWidthsTwips(blockSegRows: Segment[][], cuts: number[], contentWidthPt: number): number[] {
  let left = Infinity;
  let right = -Infinity;
  for (const segs of blockSegRows)
    for (const s of segs) {
      left = Math.min(left, s.x);
      right = Math.max(right, s.end);
    }
  if (!Number.isFinite(left) || right <= left) return cuts.map(() => 0).concat(Math.round(contentWidthPt * 20));
  const edges = [left, ...cuts, right];
  const raw = edges.slice(1).map((e, i) => Math.max(20, e - edges[i]));
  const total = raw.reduce((s, w) => s + w, 0) || 1;
  return raw.map((w) => Math.round((w / total) * contentWidthPt * 20));
}

// ─── Image extraction ───────────────────────────────────────────────────────
// Walks the page's operator list, tracking the CTM through save/restore/transform
// so each paintImageXObject can be placed in the same top-left, y-down display
// space the text items use (viewport.transform ∘ ctm applied to the unit square).

function applyMatrix(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

async function imageObjectToPng(obj: Any): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return null; // never touch the DOM off the main thread
  const canvas = document.createElement("canvas");
  let width: number;
  let height: number;
  const bitmap = obj?.bitmap as ImageBitmap | undefined;
  if (bitmap) {
    width = bitmap.width;
    height = bitmap.height;
    if (!width || !height) return null;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
  } else if (obj?.data && obj.width && obj.height) {
    width = obj.width;
    height = obj.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.createImageData(width, height);
    if (!fillRGBA(imageData.data, obj.data, obj.kind, width, height)) return null;
    ctx.putImageData(imageData, 0, 0);
  } else {
    return null;
  }
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

/** RGB (kind 2) or RGBA (kind 3) → RGBA. 1bpp grayscale masks are skipped — they're almost always stencils, not photos. */
function fillRGBA(dst: Uint8ClampedArray, src: Uint8ClampedArray | Uint8Array, kind: number, w: number, h: number): boolean {
  const n = w * h;
  if (kind === 3 && src.length >= n * 4) {
    dst.set(src.subarray(0, n * 4));
    return true;
  }
  if (kind === 2 && src.length >= n * 3) {
    for (let i = 0; i < n; i++) {
      dst[i * 4] = src[i * 3];
      dst[i * 4 + 1] = src[i * 3 + 1];
      dst[i * 4 + 2] = src[i * 3 + 2];
      dst[i * 4 + 3] = 255;
    }
    return true;
  }
  return false;
}

async function extractPageImages(
  page: Any,
  pdfjsLib: Any,
  viewport: Any,
  opList: { fnArray: number[]; argsArray: Any[] } | null,
  cache: Map<string, Promise<Uint8Array | null>>
): Promise<ImageBlock[]> {
  if (!opList) return [];
  const OPS = pdfjsLib.OPS;
  const images: ImageBlock[] = [];
  const stack: number[][] = [];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.transform) {
      ctm = pdfjsLib.Util.transform(ctm, opList.argsArray[i]);
    } else if (fn === OPS.paintImageXObject) {
      const objId = opList.argsArray[i]?.[0];
      if (typeof objId !== "string" || !page.objs.has(objId)) continue;
      const disp = pdfjsLib.Util.transform(viewport.transform, ctm);
      const corners = [
        applyMatrix(disp, 0, 0),
        applyMatrix(disp, 1, 0),
        applyMatrix(disp, 0, 1),
        applyMatrix(disp, 1, 1),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...xs) - x;
      const h = Math.max(...ys) - y;
      if (w < 16 || h < 16) continue; // bullets/rules, not real content images
      if (!cache.has(objId)) cache.set(objId, imageObjectToPng(page.objs.get(objId)));
      const png = await cache.get(objId)!;
      if (png) images.push({ y, widthPt: w, heightPt: h, png });
    }
  }
  return images;
}

// ─── Line / paragraph building (unchanged from the text-only converter) ───────

function mergeRow(items: TextItem[]): Line {
  let text = "";
  let prevEnd = -Infinity;
  for (const it of items) {
    const gap = it.x - prevEnd;
    if (text) text += gap > it.size * 2 ? "\t" : gap > it.size * 0.15 && !text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
    text += it.str;
    prevEnd = it.x + it.w;
  }
  return {
    text: text.replace(/ {2,}/g, " ").trim(),
    x: items[0].x,
    y: items[0].y,
    size: Math.max(...items.map((i) => i.size)),
    bold: items.every((i) => i.bold),
    italic: items.every((i) => i.italic),
  };
}

async function buildDoc(file: File, docx: Any, pdfjsLib: Any, onProgress?: (done: number, total: number) => void) {
  const { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  const children: Any[] = [];
  let totalChars = 0;
  let pageWidthPt = 612;
  let pageHeightPt = 792;
  const imageCache = new Map<string, Promise<Uint8Array | null>>();

  const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: "999999" };
  const tableBorders = {
    top: cellBorder,
    bottom: cellBorder,
    left: cellBorder,
    right: cellBorder,
    insideHorizontal: cellBorder,
    insideVertical: cellBorder,
  };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    if (pageNum === 1) {
      pageWidthPt = viewport.width;
      pageHeightPt = viewport.height;
    }
    const content = await page.getTextContent();

    // Font names (for bold/italic) and the operator list (for images) both need
    // getOperatorList() to have run first.
    const fontNames = new Map<string, string>();
    let opList: { fnArray: number[]; argsArray: Any[] } | null = null;
    try {
      opList = await page.getOperatorList();
      for (const id of Object.keys(content.styles)) {
        const font = page.commonObjs.has(id) ? (page.commonObjs.get(id) as Any) : null;
        if (font?.name) fontNames.set(id, String(font.name));
      }
    } catch {
      // Styling/images are best-effort.
    }

    // 1. Items in displayed (viewport) coordinates, top-left origin.
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      const [a, b, , , e, f] = pdfjsLib.Util.transform(viewport.transform, raw.transform);
      const size = Math.hypot(a, b);
      const name = fontNames.get(raw.fontName) ?? content.styles[raw.fontName]?.fontFamily ?? "";
      items.push({
        str: raw.str,
        x: e,
        y: f,
        w: raw.width,
        size: Math.round(size * 2) / 2,
        bold: /bold|black|heavy|semibold/i.test(name),
        italic: /italic|oblique/i.test(name),
      });
    }
    totalChars += items.reduce((n, it) => n + it.str.trim().length, 0);

    const images = await extractPageImages(page, pdfjsLib, viewport, opList, imageCache);
    if (!items.length && !images.length) continue;

    // 2. Group into rows by baseline, then order left to right.
    items.sort((p, q) => p.y - q.y || p.x - q.x);
    const rawRows: TextItem[][] = [];
    for (const it of items) {
      const row = rawRows.find((r) => Math.abs(r[0].y - it.y) <= Math.max(2, it.size * 0.4));
      if (row) row.push(it);
      else rawRows.push([it]);
    }
    const rows: Row[] = rawRows
      .map((r) => {
        r.sort((p, q) => p.x - q.x);
        return { y: r[0].y, size: Math.max(...r.map((i) => i.size)), items: r };
      })
      .sort((p, q) => p.y - q.y);
    const lines: Line[] = rows.map((r) => mergeRow(r.items));
    const keep = lines.map((l) => l.text.length > 0);
    const filteredRows = rows.filter((_, i) => keep[i]);
    const filteredLines = lines.filter((_, i) => keep[i]);

    if (!filteredLines.length && !images.length) continue;

    // 3. Detect tables with the shared whole-block-column engine; the rest reads as
    // plain paragraphs. segRows is 1:1 with filteredRows, so run indices match.
    const segRows: Segment[][] = filteredRows.map((r) => rowSegments(r));
    const tableRuns = detectTableRuns(segRows, filteredRows.map((r) => r.y));
    const consumed = new Set<number>();
    for (const run of tableRuns) for (let i = run.start; i <= run.end; i++) consumed.add(i);
    const proseLines = filteredLines.filter((_, i) => !consumed.has(i));

    // 4. Body size = most common line size (weighted by characters), among prose only.
    let body = 11;
    let leftMargin = 0;
    if (proseLines.length) {
      const weight = new Map<number, number>();
      for (const l of proseLines) weight.set(l.size, (weight.get(l.size) ?? 0) + l.text.length);
      body = [...weight.entries()].sort((p, q) => q[1] - p[1])[0][0];
      leftMargin = Math.min(...proseLines.map((l) => l.x));
    }

    // 5. Merge wrapped lines into paragraphs.
    const dashIndents = proseLines.filter((l) => DASH_RE.test(l.text)).map((l) => l.x);
    const isListLine = (l: Line) =>
      BULLET_GLYPH_RE.test(l.text) ||
      (DASH_RE.test(l.text) && dashIndents.filter((x) => Math.abs(x - l.x) <= 2).length >= 2);
    const paras: Para[] = [];
    for (const line of proseLines) {
      const prev = paras[paras.length - 1];
      const last = prev?.lines[prev.lines.length - 1];
      const isBullet = isListLine(line);
      const heading = line.size >= body * 1.2;
      const continues =
        !!last &&
        !isBullet &&
        Math.abs(line.size - last.size) <= 0.5 &&
        line.bold === last.bold &&
        line.y - last.y > 0 &&
        line.y - last.y <= line.size * 1.75 &&
        Math.abs(line.x - (prev.bullet && prev.lines.length === 1 ? line.x : prev.lines[prev.lines.length - 1].x)) <= line.size * 2 &&
        !/\t/.test(line.text) &&
        !/\t/.test(last.text) &&
        (!heading || prev.lines.every((l) => l.size === line.size));
      if (continues) prev.lines.push(line);
      else paras.push({ lines: [line], bullet: isBullet });
    }

    // 6. Order paragraphs, tables and images by vertical position and emit.
    const blocks: Block[] = [
      ...paras.map((para): Block => ({ y: para.lines[0].y, kind: "para", para })),
      ...tableRuns.map((run): Block => ({ y: filteredRows[run.start].y, kind: "table", run })),
      ...images.map((img): Block => ({ y: img.y, kind: "image", img })),
    ].sort((a, b) => a.y - b.y);

    const contentWidthPt = pageWidthPt - 108; // 1080-twip margins on each side, see section below
    const pxPerPt = 96 / 72;

    blocks.forEach((block, idx) => {
      const pageBreakBefore = idx === 0 && pageNum > 1 && children.length > 0;
      if (block.kind === "para") {
        const p = block.para;
        const first = p.lines[0];
        const text = p.lines
          .map((l) => l.text)
          .reduce((acc, t) => (acc.endsWith("-") && !acc.endsWith(" -") ? acc.slice(0, -1) + t : acc ? `${acc} ${t}` : t), "")
          .replace(p.bullet ? BULLET_RE : /^$/, "");
        const size = first.size;
        const heading = size >= body * 1.5 ? HeadingLevel.HEADING_1 : size >= body * 1.2 ? HeadingLevel.HEADING_2 : undefined;
        const indentPt = Math.max(0, first.x - leftMargin);
        children.push(
          new Paragraph({
            heading,
            bullet: p.bullet ? { level: 0 } : undefined,
            indent: !p.bullet && indentPt > body ? { left: Math.round(indentPt * 20) } : undefined,
            spacing: { after: Math.round(body * 6) },
            pageBreakBefore,
            children: [
              new TextRun({ text, bold: first.bold || !!heading, italics: first.italic, size: Math.round(size * 2) }),
            ],
          })
        );
      } else if (block.kind === "table") {
        const blockSegRows = segRows.slice(block.run.start, block.run.end + 1);
        const grid = mergeWrappedHeaderRows(tableGrid(blockSegRows, block.run.cols));
        const colWidths = columnWidthsTwips(blockSegRows, block.run.cols, contentWidthPt);
        if (pageBreakBefore) children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
        children.push(
          new Table({
            width: { size: colWidths.reduce((a, w) => a + w, 0), type: WidthType.DXA },
            borders: tableBorders,
            rows: grid.map(
              (cells) =>
                new TableRow({
                  children: cells.map(
                    (text, i) =>
                      new TableCell({
                        width: { size: colWidths[i], type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text, size: Math.round(body * 2) })] })],
                      })
                  ),
                })
            ),
          })
        );
      } else {
        let widthPx = block.img.widthPt * pxPerPt;
        let heightPx = block.img.heightPt * pxPerPt;
        const maxWidthPx = Math.max(50, contentWidthPt * pxPerPt);
        if (widthPx > maxWidthPx) {
          const k = maxWidthPx / widthPx;
          widthPx *= k;
          heightPx *= k;
        }
        children.push(
          new Paragraph({
            pageBreakBefore,
            spacing: { after: Math.round(body * 6) },
            children: [
              new ImageRun({
                type: "png",
                data: block.img.png,
                transformation: { width: Math.round(widthPx), height: Math.round(heightPx) },
              }),
            ],
          })
        );
      }
    });
    onProgress?.(pageNum, pdf.numPages);
  }

  if (totalChars === 0) return { doc: null, empty: true as const };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(pageWidthPt * 20), height: Math.round(pageHeightPt * 20) },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });
  return { doc, empty: false as const };
}

export async function pdfToWord(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<ToolResult> {
  try {
    const pdfjsLib = await getPdfjsLib();
    const docx = await import("docx");
    const { doc, empty } = await buildDoc(file, docx, pdfjsLib, onProgress);
    if (empty || !doc) return { success: false, error: NO_TEXT_MESSAGE };
    return { success: true, blob: await docx.Packer.toBlob(doc), filename: file.name.replace(/\.pdf$/i, ".docx") };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Conversion failed. Make sure the file is a valid PDF.") };
  }
}

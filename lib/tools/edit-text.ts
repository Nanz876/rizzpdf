import {
  PDFFont,
  PDFArray,
  PDFName,
  PDFPage,
  PDFRawStream,
  PDFStream,
  StandardFonts,
  decodePDFRawStream,
  degrees,
  rgb,
} from "pdf-lib";
import type { PDFPageProxy } from "pdfjs-dist";
import { loadPdf, saveToBlob, toolErrorMessage, displayedPage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

/**
 * Edit PDF text — honest, cover-and-redraw editing.
 *
 * True in-place, font-level editing is not possible in a browser: a PDF's fonts
 * are usually subsetted, so the glyphs for the letters you type simply aren't in
 * the file. What this module does instead:
 *
 *  - `findEditableText` lists the text lines on each page (box, size, best guess
 *    at bold/italic, family and fill colour) so the UI can make them clickable.
 *  - `applyTextEdits` deletes the show-text operators that sit inside the box from
 *    the page's content stream, paints a rectangle in the page's background colour
 *    over it, and draws your text on top in the closest standard font (Helvetica /
 *    Times / Courier, with bold and oblique variants), shrinking the size if the
 *    new text is wider than the box.
 *
 * So: the original line disappears, the replacement is real, selectable text, and
 * the font is a close match rather than the original typeface.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Rgb {
  /** 0–1 */
  r: number;
  g: number;
  b: number;
}

/** Fractions of the DISPLAYED page (after /Rotate and crop), top-left origin. */
export interface TextRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TextFamily = "sans" | "serif" | "mono";

export interface EditableTextLine {
  /** Stable within one `findEditableText` call: `p<page>-l<index>`. */
  id: string;
  /** 1-based page number. */
  page: number;
  /** The line as pdf.js extracts it. */
  text: string;
  box: TextRect;
  /** Points on the displayed page. */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  family: TextFamily;
  color: Rgb;
}

export interface TextEdit {
  /** 1-based page number. */
  page: number;
  box: TextRect;
  /** Replacement text. Empty just covers the original line. */
  text: string;
  /** Points on the displayed page. Defaults to what fits the box height. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  family?: TextFamily;
  /** Text colour, default black. */
  color?: Rgb;
  /** Colour painted over the original text, default white. */
  background?: Rgb;
  /** Paint the background rectangle at all. Default true; pass false for an added box. */
  cover?: boolean;
}

export const NO_EDITS_MESSAGE = "Replace or add some text first.";
export const UNSUPPORTED_TEXT_MESSAGE =
  "Replacement text can use Latin letters, numbers and common symbols only.";
export const MISSING_PAGE_MESSAGE = "One of the edits is on a page that doesn't exist.";

const WHITE: Rgb = { r: 1, g: 1, b: 1 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const MIN_FONT_SIZE = 4;
/** Box padding around a detected line, as a fraction of its font size. */
const PAD_X = 0.06;
const PAD_ABOVE = 1;
const PAD_BELOW = 0.28;

// ─── pdf.js ─────────────────────────────────────────────────────────────────

async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

async function openPdfjs(bytes: Uint8Array) {
  const pdfjsLib = await getPdfjs();
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  return pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

// ─── Font / colour detection ────────────────────────────────────────────────

interface FontStyle {
  bold: boolean;
  italic: boolean;
  family?: TextFamily;
  color?: Rgb;
}

function familyFromName(name: string | undefined): TextFamily | undefined {
  if (!name) return undefined;
  if (/mono|courier|consol/i.test(name)) return "mono";
  if (/serif/i.test(name) && !/sans[-\s]?serif/i.test(name)) return "serif";
  if (/times|georgia|garamond|roman|book|cambria|palatino|minion/i.test(name)) return "serif";
  if (/sans|arial|helvetica|verdana|calibri|tahoma|segoe|roboto/i.test(name)) return "sans";
  return undefined;
}

/** pdf.js hands colours to the main thread as CSS hex; older builds used 0–255 triples. */
function parseFillColor(arg: unknown): Rgb | null {
  if (typeof arg === "string") {
    const m = /^#?([0-9a-f]{6})$/i.exec(arg.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }
  if (Array.isArray(arg) && arg.length >= 3 && arg.every((v) => typeof v === "number")) {
    const [r, g, b] = arg as number[];
    const scale = r > 1 || g > 1 || b > 1 ? 255 : 1;
    return { r: r / scale, g: g / scale, b: b / scale };
  }
  return null;
}

/**
 * Walk the page's operator list to learn, per font, whether it is bold/italic,
 * which family it is closest to, and the fill colour it was first painted with.
 * Everything here is best-effort: anything we can't read falls back to black,
 * regular, sans.
 */
async function collectFontStyles(page: PDFPageProxy): Promise<Map<string, FontStyle>> {
  const styles = new Map<string, FontStyle>();
  let ops: { fnArray: number[]; argsArray: unknown[] } | null = null;
  try {
    const list = await page.getOperatorList();
    ops = { fnArray: Array.from(list.fnArray), argsArray: list.argsArray as unknown[] };
  } catch {
    return styles;
  }
  const { OPS } = await getPdfjs();

  const entry = (name: string) => {
    let s = styles.get(name);
    if (!s) {
      s = { bold: false, italic: false };
      styles.set(name, s);
    }
    return s;
  };

  let fill: Rgb = BLACK;
  const stack: Rgb[] = [];
  let current: string | null = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) {
      stack.push(fill);
    } else if (fn === OPS.restore) {
      fill = stack.pop() ?? fill;
    } else if (fn === OPS.setFillRGBColor || fn === OPS.setFillGray || fn === OPS.setFillCMYKColor) {
      const list = args as unknown[];
      fill = parseFillColor(list?.length === 1 ? list[0] : list) ?? fill;
    } else if (fn === OPS.setFont) {
      const name = (args as unknown[])?.[0];
      current = typeof name === "string" ? name : null;
      if (current) entry(current);
    } else if (
      current &&
      (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText)
    ) {
      const s = entry(current);
      if (!s.color) s.color = fill;
    }
  }

  // Font objects reach the main thread through commonObjs once the operator list
  // has resolved; they carry pdf.js's own bold/italic detection and the font name.
  const objs = (page as unknown as { commonObjs?: { has(id: string): boolean; get(id: string): unknown } }).commonObjs;
  for (const [name, style] of styles) {
    try {
      if (!objs?.has(name)) continue;
      const font = objs.get(name) as { bold?: boolean; italic?: boolean; name?: string; fallbackName?: string };
      style.bold = !!font?.bold;
      style.italic = !!font?.italic;
      style.family = familyFromName(font?.name) ?? familyFromName(font?.fallbackName);
    } catch {
      /* font data unavailable: keep the defaults */
    }
  }
  return styles;
}

// ─── Line detection ─────────────────────────────────────────────────────────

/**
 * pdf.js splits text into items without always marking where a line ends. Join
 * items that continue each other; otherwise a space (same line, visible gap) or a
 * newline (a different line) — the same reasoning the redact tool uses.
 */
function separatorBetween(prev: TextItemLike, next: TextItemLike): string {
  const [a, b, , , e, f] = prev.transform;
  const ulen = Math.hypot(a, b);
  if (!ulen) return "\n";
  const ux = a / ulen,
    uy = b / ulen;
  const size = Math.max(Math.hypot(prev.transform[2], prev.transform[3]), prev.height, 1);
  const endX = e + ux * prev.width,
    endY = f + uy * prev.width;
  const dx = next.transform[4] - endX,
    dy = next.transform[5] - endY;
  const along = dx * ux + dy * uy;
  const across = Math.abs(-dx * uy + dy * ux);
  if (across > size * 0.5 || along < -size * 0.5 || along > size * 3) return "\n";
  if (along > size * 0.15) return prev.str.endsWith(" ") || next.str.startsWith(" ") ? "" : " ";
  return "";
}

type Viewport = { width: number; height: number; convertToViewportPoint(x: number, y: number): number[] };

interface ItemGeometry {
  corners: number[][];
  fontSize: number;
}

/** The item's glyph box (plus padding) in viewport coordinates. */
function itemGeometry(item: TextItemLike, viewport: Viewport): ItemGeometry | null {
  const [a, b, c, d, e, f] = item.transform;
  const ulen = Math.hypot(a, b);
  if (!ulen || !item.str.length) return null;
  const vlen = Math.hypot(c, d);
  const ux = a / ulen,
    uy = b / ulen;
  const vx = vlen ? c / vlen : -uy,
    vy = vlen ? d / vlen : ux;
  const fontSize = vlen || item.height || ulen;
  const width = item.width > 0 ? item.width : item.str.length * fontSize * 0.5;

  const x0 = -PAD_X * fontSize;
  const x1 = width + PAD_X * fontSize;
  const y0 = -PAD_BELOW * fontSize;
  const y1 = PAD_ABOVE * fontSize;
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ].map(([lx, ly]) => viewport.convertToViewportPoint(e + ux * lx + vx * ly, f + uy * lx + vy * ly));
  return { corners, fontSize };
}

/**
 * Every text line in the document, with the geometry and styling needed to cover
 * it and redraw it. Lines are returned in reading order, page by page.
 */
export async function findEditableText(file: File): Promise<EditableTextLine[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await openPdfjs(bytes);
  const lines: EditableTextLine[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 }) as unknown as Viewport;
      const styles = await collectFontStyles(page);
      const content = await page.getTextContent();
      const items = content.items.filter((it): it is TextItemLike & typeof it => "str" in it) as TextItemLike[];

      let text = "";
      let group: TextItemLike[] = [];
      let prev: TextItemLike | null = null;

      const flush = () => {
        const trimmed = text.trim();
        if (trimmed && group.length) {
          const line = buildLine(p, lines.length, trimmed, text, group, viewport, styles, content.styles);
          if (line) lines.push(line);
        }
        text = "";
        group = [];
        prev = null;
      };

      for (const item of items) {
        if (!item.str) {
          if (item.hasEOL) flush();
          continue;
        }
        if (prev) {
          const sep = prev.hasEOL ? "\n" : separatorBetween(prev, item);
          if (sep === "\n") flush();
          else text += sep;
        }
        group.push(item);
        text += item.str;
        prev = item;
        if (item.hasEOL) flush();
      }
      flush();
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return lines;
}

type PdfjsStyles = Record<string, { fontFamily?: string } | undefined>;

function buildLine(
  page: number,
  index: number,
  trimmed: string,
  raw: string,
  group: TextItemLike[],
  viewport: Viewport,
  styles: Map<string, FontStyle>,
  pdfjsStyles: PdfjsStyles
): EditableTextLine | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let fontSize = 0;
  let widest: TextItemLike | null = null;
  for (const item of group) {
    const geo = itemGeometry(item, viewport);
    if (!geo) continue;
    for (const [x, y] of geo.corners) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    fontSize = Math.max(fontSize, geo.fontSize);
    if (!widest || item.str.length > widest.str.length) widest = item;
  }
  if (!widest || !Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;

  const x = Math.max(0, minX / viewport.width);
  const y = Math.max(0, minY / viewport.height);
  const width = Math.min(1, maxX / viewport.width) - x;
  const height = Math.min(1, maxY / viewport.height) - y;
  if (width <= 0 || height <= 0) return null;

  const style = styles.get(widest.fontName);
  const generic = pdfjsStyles?.[widest.fontName]?.fontFamily;
  const family: TextFamily =
    style?.family ??
    (generic === "monospace" ? "mono" : generic === "serif" ? "serif" : familyFromName(generic)) ??
    "sans";

  // The raw line keeps the leading whitespace pdf.js reported; the trimmed text is
  // what the user edits, so shift the box to where the trimmed text starts.
  const lead = raw.length - raw.trimStart().length;
  const shift = lead && raw.length ? (lead / raw.length) * width : 0;

  return {
    id: `p${page}-l${index}`,
    page,
    text: trimmed,
    box: { x: x + shift, y, width: width - shift, height },
    fontSize,
    bold: !!style?.bold,
    italic: !!style?.italic,
    family,
    color: style?.color ?? BLACK,
  };
}

// ─── Background sampling ────────────────────────────────────────────────────

interface PixelReader {
  width: number;
  height: number;
  getContext(type: "2d", options?: { willReadFrequently?: boolean }): {
    getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray | Uint8Array };
  } | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Read the rendered page just outside `box` and return the colour to paint over the
 * original text, so a coloured or off-white background is covered convincingly.
 * `box` is in fractions of the canvas. Anything unreadable falls back to white.
 */
export function sampleBackgroundColor(canvas: HTMLCanvasElement, box: TextRect, opts: { margin?: number } = {}): Rgb {
  const source = canvas as unknown as PixelReader;
  const width = Math.floor(source?.width ?? 0);
  const height = Math.floor(source?.height ?? 0);
  if (!(width > 0 && height > 0)) return WHITE;

  let ctx: ReturnType<PixelReader["getContext"]> = null;
  try {
    ctx = source.getContext("2d", { willReadFrequently: true });
  } catch {
    return WHITE;
  }
  if (!ctx) return WHITE;

  const x0 = clamp(Math.round(box.x * width), 0, width);
  const y0 = clamp(Math.round(box.y * height), 0, height);
  const x1 = clamp(Math.round((box.x + box.width) * width), 0, width);
  const y1 = clamp(Math.round((box.y + box.height) * height), 0, height);
  const margin = Math.max(2, Math.round(opts.margin ?? Math.max(3, (y1 - y0) * 0.4)));
  const rx0 = clamp(x0 - margin, 0, width);
  const ry0 = clamp(y0 - margin, 0, height);
  const rx1 = clamp(x1 + margin, 0, width);
  const ry1 = clamp(y1 + margin, 0, height);
  if (rx1 <= rx0 || ry1 <= ry0) return WHITE;

  let img: { data: Uint8ClampedArray | Uint8Array };
  try {
    img = ctx.getImageData(rx0, ry0, rx1 - rx0, ry1 - ry0);
  } catch {
    return WHITE; // tainted canvas, or a surface the browser wouldn't allocate
  }
  const data = img.data;
  const w = rx1 - rx0;

  // Most common colour in the ring around the box, so neighbouring glyphs (a few
  // dark pixels) can't drag the answer away from the page background.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let py = ry0; py < ry1; py++) {
    for (let px = rx0; px < rx1; px++) {
      if (px >= x0 && px < x1 && py >= y0 && py < y1) continue; // the text itself
      const i = ((py - ry0) * w + (px - rx0)) * 4;
      const a = data[i + 3] / 255;
      // Flatten onto white, the way an unpainted PDF page reads.
      const r = data[i] * a + 255 * (1 - a);
      const g = data[i + 1] * a + 255 * (1 - a);
      const b = data[i + 2] * a + 255 * (1 - a);
      const key = (Math.round(r / 8) << 16) | (Math.round(g / 8) << 8) | Math.round(b / 8);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.n++;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        buckets.set(key, { n: 1, r, g, b });
      }
    }
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  if (!best) return WHITE;
  return {
    r: clamp(best.r / best.n / 255, 0, 1),
    g: clamp(best.g / best.n / 255, 0, 1),
    b: clamp(best.b / best.n / 255, 0, 1),
  };
}

// ─── Removing the original text ─────────────────────────────────────────────

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Inverse of `displayedPage().toUser`: user space → displayed-page fractions, top-left origin. */
function displayedFraction(view: ReturnType<typeof displayedPage>) {
  const o = view.toUser(0, 0);
  const ex = view.toUser(1, 0);
  const ey = view.toUser(0, 1);
  const ax = ex.x - o.x,
    ay = ex.y - o.y,
    bx = ey.x - o.x,
    by = ey.y - o.y;
  const det = ax * by - ay * bx;
  return (x: number, y: number) => {
    if (!det) return { x: 0, y: 0 };
    const rx = x - o.x,
      ry = y - o.y;
    const dx = (rx * by - ry * bx) / det;
    const dy = (ax * ry - ay * rx) / det;
    return { x: dx / view.width, y: 1 - dy / view.height };
  };
}

const isWhitespace = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const isDelimiter = (c: number) => "()<>[]{}/%".includes(String.fromCharCode(c));

/** End index (exclusive) of a literal `(...)` string starting at `i`. */
function endOfString(s: string, i: number): number {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === "\\") {
      k++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return k + 1;
  }
  return s.length;
}

/** End index (exclusive) of a bracketed token (`[...]` or `<<...>>`) starting at `i`. */
function endOfBracket(s: string, i: number, open: string, close: string): number {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === "(") {
      k = endOfString(s, k) - 1;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return k + 1;
  }
  return s.length;
}

interface StripBox extends TextRect {
  /** Baseline band of the box, as a fraction of the page height. */
  top: number;
  bottom: number;
}

/**
 * Blank out every show-text operator whose baseline origin falls inside one of the
 * boxes, so the replaced line is really gone rather than merely hidden.
 *
 * Positions come from the stream's own text and transformation matrices, which are
 * exact. A show operator with no positioning of its own (the rest of a line split
 * across several operators) is removed only when the operator before it on the same
 * line was — that keeps neighbouring cells that share a baseline intact.
 *
 * Text drawn inside form XObjects is not descended into: it stays covered by the
 * rectangle but keeps its text.
 */
function stripShowText(
  source: string,
  boxes: StripBox[],
  toFraction: (x: number, y: number) => { x: number; y: number }
): string | null {
  const cuts: { start: number; end: number; with: string }[] = [];
  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let leading = 0;
  let rise = 0;
  let positioned = false; // the current point came from Tm/Td/TD/T*, not from an advance
  let lastRemoved = false;
  const operands: { start: number; end: number; text: string }[] = [];

  const numeric = (t: string) => {
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  };

  const showAt = () => {
    const p = applyMatrix(mul(tm, ctm), 0, rise);
    return p;
  };

  const shouldRemove = (fx: number, fy: number) => {
    for (const b of boxes) {
      if (fy < b.top || fy > b.bottom) continue;
      if (positioned) {
        if (fx >= b.x - 0.01 && fx <= b.x + b.width) return true;
      } else if (lastRemoved) {
        return true;
      }
    }
    return false;
  };

  let i = 0;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (isWhitespace(code)) {
      i++;
      continue;
    }
    const ch = source[i];
    if (ch === "%") {
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++;
      continue;
    }
    if (ch === "(") {
      const end = endOfString(source, i);
      operands.push({ start: i, end, text: "" });
      i = end;
      continue;
    }
    if (ch === "[") {
      const end = endOfBracket(source, i, "[", "]");
      operands.push({ start: i, end, text: "" });
      i = end;
      continue;
    }
    if (ch === "<") {
      const end = source[i + 1] === "<" ? endOfBracket(source, i, "<", ">") : source.indexOf(">", i) + 1 || source.length;
      operands.push({ start: i, end, text: "" });
      i = end;
      continue;
    }
    if (ch === "/" || ch === ")" || ch === "]" || ch === ">" || ch === "{" || ch === "}") {
      let k = i + 1;
      while (k < source.length && !isWhitespace(source.charCodeAt(k)) && !isDelimiter(source.charCodeAt(k))) k++;
      operands.push({ start: i, end: k, text: source.slice(i, k) });
      i = k;
      continue;
    }

    let k = i;
    while (k < source.length && !isWhitespace(source.charCodeAt(k)) && !isDelimiter(source.charCodeAt(k))) k++;
    if (k === i) k++;
    const token = source.slice(i, k);
    const start = i;
    i = k;

    if (/^[+-.\d]/.test(token)) {
      operands.push({ start, end: k, text: token });
      continue;
    }

    switch (token) {
      case "BI": {
        // Inline image: skip the binary data so it can't be mistaken for operators.
        const id = source.indexOf("ID", i);
        if (id < 0) return null;
        const ei = source.indexOf("EI", id + 2);
        i = ei < 0 ? source.length : ei + 2;
        break;
      }
      case "q":
        stack.push(ctm);
        break;
      case "Q":
        ctm = stack.pop() ?? ctm;
        break;
      case "cm":
        if (operands.length >= 6) {
          ctm = mul(operands.slice(-6).map((o) => numeric(o.text)) as Matrix, ctm);
        }
        break;
      case "BT":
        tm = IDENTITY;
        tlm = IDENTITY;
        positioned = true;
        lastRemoved = false;
        break;
      case "Tm":
        if (operands.length >= 6) {
          tlm = operands.slice(-6).map((o) => numeric(o.text)) as Matrix;
          tm = tlm;
        }
        positioned = true;
        lastRemoved = false;
        break;
      case "TD":
        if (operands.length >= 2) leading = -numeric(operands[operands.length - 1].text);
      // falls through
      case "Td":
        if (operands.length >= 2) {
          const tx = numeric(operands[operands.length - 2].text);
          const ty = numeric(operands[operands.length - 1].text);
          tlm = mul([1, 0, 0, 1, tx, ty], tlm);
          tm = tlm;
        }
        positioned = true;
        lastRemoved = false;
        break;
      case "TL":
        if (operands.length) leading = numeric(operands[operands.length - 1].text);
        break;
      case "Ts":
        if (operands.length) rise = numeric(operands[operands.length - 1].text);
        break;
      case "T*":
        tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
        tm = tlm;
        positioned = true;
        lastRemoved = false;
        break;
      case "Tj":
      case "TJ":
      case "'":
      case '"': {
        if (token === "'" || token === '"') {
          tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
          tm = tlm;
          positioned = true;
          lastRemoved = false;
        }
        const operand = operands[operands.length - 1];
        const p = showAt();
        const f = toFraction(p.x, p.y);
        const remove = !!operand && shouldRemove(f.x, f.y);
        if (remove) {
          cuts.push({ start: operand.start, end: operand.end, with: source[operand.start] === "[" ? "[]" : "()" });
        }
        lastRemoved = remove;
        positioned = false;
        break;
      }
      default:
        break;
    }
    operands.length = 0;
  }

  if (!cuts.length) return null;
  let out = "";
  let at = 0;
  for (const cut of cuts) {
    out += source.slice(at, cut.start) + cut.with;
    at = cut.end;
  }
  return out + source.slice(at);
}

/** Rewrite a page's content so the text inside `boxes` is gone. Returns true if anything changed. */
function removeTextInBoxes(page: PDFPage, boxes: TextRect[]): boolean {
  if (!boxes.length) return false;
  const ctx = page.doc.context;
  const contents = ctx.lookup(page.node.get(PDFName.of("Contents")));
  const streams: PDFStream[] = [];
  if (contents instanceof PDFArray) contents.asArray().forEach((r) => {
    const s = ctx.lookup(r);
    if (s instanceof PDFStream) streams.push(s);
  });
  else if (contents instanceof PDFStream) streams.push(contents);
  if (!streams.length) return false;

  let source = "";
  for (const stream of streams) {
    if (!(stream instanceof PDFRawStream)) return false;
    let bytes: Uint8Array;
    try {
      bytes = decodePDFRawStream(stream).decode();
    } catch {
      return false; // a filter we can't undo: the cover rectangle still hides the text
    }
    for (let i = 0; i < bytes.length; i += 8192) source += String.fromCharCode(...bytes.subarray(i, i + 8192));
    source += "\n";
  }

  const view = displayedPage(page);
  const toFraction = displayedFraction(view);
  const strips: StripBox[] = boxes.map((b) => ({
    ...b,
    top: b.y + 0.2 * b.height,
    bottom: b.y + 1.15 * b.height,
  }));

  let edited: string | null;
  try {
    edited = stripShowText(source, strips, toFraction);
  } catch {
    return false;
  }
  if (edited === null) return false;

  const bytes = new Uint8Array(edited.length);
  for (let i = 0; i < edited.length; i++) bytes[i] = edited.charCodeAt(i) & 0xff;
  page.node.set(PDFName.of("Contents"), ctx.register(ctx.flateStream(bytes)));
  return true;
}

// ─── Applying edits ─────────────────────────────────────────────────────────

const STANDARD_FONTS: Record<TextFamily, Record<"regular" | "bold" | "italic" | "boldItalic", StandardFonts>> = {
  sans: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
  },
  serif: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic,
  },
  mono: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique,
  },
};

/** The standard font we substitute for a detected style. */
export function closestStandardFont(family: TextFamily = "sans", bold = false, italic = false): StandardFonts {
  const set = STANDARD_FONTS[family] ?? STANDARD_FONTS.sans;
  if (bold && italic) return set.boldItalic;
  if (bold) return set.bold;
  if (italic) return set.italic;
  return set.regular;
}

/** Shrink `size` until `text` fits `maxWidth`, never below 4pt. */
function fitFontSize(font: PDFFont, text: string, size: number, maxWidth: number): number {
  if (!text || !(maxWidth > 0)) return size;
  const width = font.widthOfTextAtSize(text, size);
  if (!(width > maxWidth)) return size;
  return Math.max(MIN_FONT_SIZE, (size * maxWidth) / width);
}

const color = (c: Rgb) => rgb(clamp(c.r, 0, 1), clamp(c.g, 0, 1), clamp(c.b, 0, 1));

/**
 * Cover each edit's box in the page background colour and draw the replacement in
 * the closest standard font. Boxes that cover no original text (added text boxes)
 * work the same way — pass `cover: false` so nothing underneath is painted over.
 */
export async function applyTextEdits(file: File, edits: TextEdit[]): Promise<ToolResult> {
  if (!edits?.length) return { success: false, error: NO_EDITS_MESSAGE };
  try {
    const doc = await loadPdf(file); // decrypts restriction-only files, rejects password-locked ones
    const pageCount = doc.getPageCount();
    const fonts = new Map<StandardFonts, PDFFont>();
    const embed = async (name: StandardFonts) => {
      let font = fonts.get(name);
      if (!font) {
        font = await doc.embedFont(name);
        fonts.set(name, font);
      }
      return font;
    };

    for (const edit of edits) {
      const index = Math.round(edit.page) - 1;
      if (!Number.isFinite(index) || index < 0 || index >= pageCount) {
        return { success: false, error: MISSING_PAGE_MESSAGE };
      }
    }

    // Delete the original text first: pdf-lib appends its own content stream when
    // it draws, and rewriting /Contents afterwards would throw that away.
    const toStrip = new Map<number, TextRect[]>();
    for (const edit of edits) {
      if (edit.cover === false || !edit.box) continue;
      const index = Math.round(edit.page) - 1;
      toStrip.set(index, [...(toStrip.get(index) ?? []), edit.box]);
    }
    for (const [index, boxes] of toStrip) removeTextInBoxes(doc.getPage(index), boxes);

    for (const edit of edits) {
      const index = Math.round(edit.page) - 1;
      const page = doc.getPage(index);
      const view = displayedPage(page);

      const bx = clamp(edit.box?.x ?? 0, 0, 1) * view.width;
      const byTop = clamp(edit.box?.y ?? 0, 0, 1) * view.height;
      const bw = Math.max(0, clamp(edit.box?.width ?? 0, 0, 1)) * view.width;
      const bh = Math.max(0, clamp(edit.box?.height ?? 0, 0, 1)) * view.height;

      if (edit.cover !== false && bw > 0 && bh > 0) {
        const corner = view.toUser(bx, view.height - byTop - bh);
        page.drawRectangle({
          x: corner.x,
          y: corner.y,
          width: bw,
          height: bh,
          color: color(edit.background ?? WHITE),
          rotate: degrees(view.rotation),
          borderWidth: 0,
        });
      }

      const text = edit.text ?? "";
      if (!text.trim()) continue; // covering only: the line is simply removed

      const font = await embed(closestStandardFont(edit.family, edit.bold, edit.italic));
      try {
        font.encodeText(text);
      } catch {
        return { success: false, error: UNSUPPORTED_TEXT_MESSAGE };
      }

      const requested = edit.fontSize && edit.fontSize > 0 ? edit.fontSize : bh > 0 ? bh / (PAD_ABOVE + PAD_BELOW) : 12;
      const size = fitFontSize(font, text, requested, bw);
      const ascent = font.heightAtSize(size, { descender: false });
      const descent = Math.max(0, font.heightAtSize(size) - ascent);
      // Sit on the original baseline (box bottom minus the descender), but never
      // let shrunken text drop out of the top of the box.
      const baselineFromTop = bh > 0 ? byTop + Math.max(ascent, bh - descent) : byTop + ascent;
      const pos = view.toUser(bx, view.height - baselineFromTop);
      page.drawText(text, {
        x: pos.x,
        y: pos.y,
        size,
        font,
        color: color(edit.color ?? BLACK),
        rotate: degrees(view.rotation),
      });
    }

    return {
      success: true,
      blob: await saveToBlob(doc),
      filename: `${file.name.replace(/\.pdf$/i, "")}_edited.pdf`,
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to edit this PDF. Make sure it's a valid PDF.") };
  }
}

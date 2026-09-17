import {
  PDFDocument,
  PDFPage,
  PDFName,
  PDFDict,
  PDFArray,
  PDFStream,
  PDFRawStream,
  PDFRef,
  PDFObject,
  PDFContext,
  decodePDFRawStream,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  drawObject,
} from "pdf-lib";
import type { PDFPageProxy } from "pdfjs-dist";
import { loadPdf, saveToBlob, toolErrorMessage, displayedPage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

/**
 * Redact PDF — true redaction, not cosmetic black boxes.
 *
 * Every page with at least one box is rasterised (pdf.js), the boxes are painted
 * solid black into the pixels, and the page is replaced by that image on a fresh
 * page. Nothing from the original page (text, fonts, images, annotations, form
 * fields) is carried over for those pages. Pages without boxes are copied as-is
 * into a brand-new document after removing anything that could drag content of
 * other pages along (cross-page links, form field parents, shared resources the
 * page doesn't use). Document metadata, outline, AcroForm, attachments and
 * JavaScript are never copied.
 */

export interface RedactBox {
  /** 1-based page number. */
  page: number;
  /** Fractions of the DISPLAYED page (after /Rotate and crop), top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** RGBA pixels of a rendered page (4 bytes per pixel, row-major, top row first). */
export interface RenderedPage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export type PageRenderer = (page: PDFPageProxy, scale: number) => Promise<RenderedPage>;

export interface RedactOptions {
  /** Rasterisation resolution for redacted pages. Default 200; never below scale 2 (144 DPI). */
  dpi?: number;
  /** Injected renderer (tests). Defaults to a DOM canvas. */
  renderPage?: PageRenderer;
}

export const EMPTY_BOXES_MESSAGE = "Mark at least one area to redact.";

/** Regex presets. Built with the RegExp constructor so older TS targets accept lookbehind. */
export const REDACT_PRESETS = {
  emails: () => new RegExp("[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\\.[A-Z0-9-]+)*\\.[A-Z]{2,}", "gi"),
  phones: () =>
    new RegExp(
      // Digit groups must not continue on either side, so card numbers don't match.
      "(?<![\\w+]|\\d[\\s.-])(?:\\+\\d{1,3}[\\s.-]?)?(?:\\(\\d{2,4}\\)[\\s.-]?|\\d{2,4}[\\s.-])\\d{3,4}[\\s.-]\\d{3,4}(?![\\w]|[\\s.-]\\d)",
      "g"
    ),
  cards: () => new RegExp("(?<!\\d)\\d(?:[ -]?\\d){12,18}(?!\\d)", "g"),
} as const;

export type RedactPreset = keyof typeof REDACT_PRESETS;

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

// ─── Text search ────────────────────────────────────────────────────────────

// Helvetica advance widths (1/1000 em) for ASCII 32..126. Used only as relative
// weights to place a match inside a text item whose total width pdf.js reports.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];

function charWeight(ch: string, monospace: boolean): number {
  if (monospace) return 600;
  const code = ch.codePointAt(0) ?? 32;
  if (code >= 32 && code <= 126) return HELVETICA_WIDTHS[code - 32];
  if (code >= 0x2e80) return 1000; // CJK and wider scripts
  return 556;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(query: string | RegExp, wholeWord: boolean): RegExp | null {
  if (query instanceof RegExp) {
    const flags = query.flags.includes("g") ? query.flags : query.flags + "g";
    return new RegExp(query.source, flags);
  }
  const trimmed = query.trim();
  if (!trimmed) return null;
  // Any run of whitespace in the query matches any run of whitespace in the page.
  const source = trimmed.split(/\s+/).map(escapeRegExp).join("\\s+");
  if (wholeWord) return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`, "giu");
  return new RegExp(source, "gi");
}

/**
 * Find every match of `query` and return one box per text item the match touches.
 * Strings are matched case-insensitively; RegExp queries are used as given (global).
 */
export async function findTextBoxes(
  file: File,
  query: string | RegExp,
  opts: { wholeWord?: boolean } = {}
): Promise<RedactBox[]> {
  const regex = buildRegex(query, !!opts.wholeWord);
  if (!regex) return [];
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await openPdfjs(bytes);
  const boxes: RedactBox[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter((it): it is TextItemLike & typeof it => "str" in it) as TextItemLike[];

      // Concatenate the page text, remembering which item each character came from.
      let text = "";
      const owner: { item: number; offset: number }[] = [];
      items.forEach((it, idx) => {
        const sep = idx > 0 && !items[idx - 1].hasEOL ? separatorBetween(items[idx - 1], it) : "";
        if (sep) {
          text += sep;
          owner.push({ item: -1, offset: 0 });
        }
        for (let k = 0; k < it.str.length; k++) {
          text += it.str[k];
          owner.push({ item: idx, offset: k });
        }
        if (it.hasEOL) {
          text += "\n";
          owner.push({ item: -1, offset: 0 });
        }
      });

      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text))) {
        if (m[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        // Split the match into per-item character ranges.
        const ranges = new Map<number, { start: number; end: number }>();
        for (let c = m.index; c < m.index + m[0].length; c++) {
          const o = owner[c];
          if (!o || o.item < 0) continue;
          const r = ranges.get(o.item);
          if (r) r.end = Math.max(r.end, o.offset + 1);
          else ranges.set(o.item, { start: o.offset, end: o.offset + 1 });
        }
        for (const [idx, r] of ranges) {
          const style = content.styles[items[idx].fontName];
          const box = itemRangeBox(items[idx], r.start, r.end, viewport, style?.fontFamily === "monospace", style?.fontFamily === "serif");
          if (box) boxes.push({ page: p, ...box });
        }
      }
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return boxes;
}

/**
 * pdf.js splits text into items without always marking where one line or phrase
 * ends. Join items that continue each other directly; otherwise insert a space
 * (same line, visible gap) or a newline (elsewhere) so matches can't bridge them.
 */
function separatorBetween(prev: TextItemLike, next: TextItemLike): string {
  const [a, b, , , e, f] = prev.transform;
  const ulen = Math.hypot(a, b);
  if (!ulen) return "\n";
  const ux = a / ulen, uy = b / ulen;
  const size = Math.max(Math.hypot(prev.transform[2], prev.transform[3]), prev.height, 1);
  const endX = e + ux * prev.width, endY = f + uy * prev.width;
  const dx = next.transform[4] - endX, dy = next.transform[5] - endY;
  const along = dx * ux + dy * uy;
  const across = Math.abs(-dx * uy + dy * ux);
  if (across > size * 0.5 || along < -size * 0.5 || along > size * 3) return "\n";
  if (along > size * 0.15) return prev.str.endsWith(" ") || next.str.startsWith(" ") ? "" : " ";
  return "";
}

type Viewport = { width: number; height: number; convertToViewportPoint(x: number, y: number): number[] };

/** Box (fractions of the displayed page) covering characters [start, end) of a text item. */
function itemRangeBox(
  item: TextItemLike,
  start: number,
  end: number,
  viewport: Viewport,
  monospace: boolean,
  serif: boolean
): Omit<RedactBox, "page"> | null {
  const [a, b, c, d, e, f] = item.transform;
  const ulen = Math.hypot(a, b);
  const vlen = Math.hypot(c, d);
  if (!ulen || !item.str.length) return null;
  const ux = a / ulen, uy = b / ulen;
  // "Up" direction of the glyphs; fall back to perpendicular of u.
  const vx = vlen ? c / vlen : -uy, vy = vlen ? d / vlen : ux;
  const fontSize = vlen || item.height || ulen;

  const weights = Array.from(item.str, (ch) => charWeight(ch, monospace));
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const width = item.width > 0 ? item.width : (total / 1000) * fontSize;
  const before = weights.slice(0, start).reduce((s, w) => s + w, 0);
  const inside = weights.slice(start, end).reduce((s, w) => s + w, 0);
  let x0 = (before / total) * width;
  let x1 = ((before + inside) / total) * width;

  // Glyph widths are estimated, so widen by an error margin that grows with the
  // distance to the nearest item edge (where the estimate is exact), plus padding.
  const uncertainty = monospace ? 0.03 : serif ? 0.12 : 0.05;
  const pad = fontSize * 0.2;
  const err0 = Math.min(x0, width - x0) * uncertainty;
  const err1 = Math.min(x1, width - x1) * uncertainty;
  x0 = x0 - err0 - pad;
  x1 = x1 + err1 + pad;
  const yBottom = -0.3 * fontSize;
  const yTop = 1.05 * fontSize;

  const corners = [
    [x0, yBottom],
    [x1, yBottom],
    [x0, yTop],
    [x1, yTop],
  ].map(([lx, ly]) => viewport.convertToViewportPoint(e + ux * lx + vx * ly, f + uy * lx + vy * ly));
  const xs = corners.map((pt) => pt[0]);
  const ys = corners.map((pt) => pt[1]);
  const left = Math.max(0, Math.min(...xs) / viewport.width);
  const top = Math.max(0, Math.min(...ys) / viewport.height);
  const right = Math.min(1, Math.max(...xs) / viewport.width);
  const bottom = Math.min(1, Math.max(...ys) / viewport.height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// ─── Rasterising ────────────────────────────────────────────────────────────

const MIN_SCALE = 2;
const MAX_SIDE_PX = 14000;
const MAX_AREA_PX = 50_000_000;

const canvasRenderer: PageRenderer = async (page, scale) => {
  const pdfjsLib = await getPdfjs();
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  await page.render({
    canvasContext: ctx,
    canvas,
    viewport,
    background: "#ffffff",
    // Bake every visible annotation (including filled form fields) into the pixels.
    annotationMode: pdfjsLib.AnnotationMode.ENABLE,
  }).promise;
  const { data } = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;
  return { data, width, height };
};

function clampBox(b: RedactBox): RedactBox | null {
  const vals = [b.page, b.x, b.y, b.w, b.h];
  if (vals.some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  const x0 = Math.max(0, Math.min(1, b.x));
  const y0 = Math.max(0, Math.min(1, b.y));
  const x1 = Math.max(0, Math.min(1, b.x + b.w));
  const y1 = Math.max(0, Math.min(1, b.y + b.h));
  if (x1 <= x0 || y1 <= y0) return null;
  return { page: Math.round(b.page), x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Paint boxes solid black into RGBA pixels and flatten to opaque RGB. */
export function paintBoxesToRgb(img: RenderedPage, boxes: RedactBox[]): Uint8Array {
  const { data, width, height } = img;
  if (!(width > 0 && height > 0) || data.length !== width * height * 4) {
    throw new Error("Rendered page has an unexpected size.");
  }
  // A canvas the browser couldn't allocate comes back fully transparent even though
  // we filled it white first. Refuse rather than emit a blank page.
  if (data[3] !== 255 && data[data.length - 1] !== 255) throw new Error("This page is too large to redact in the browser.");

  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    const alpha = data[i + 3];
    const inv = 255 - alpha;
    rgb[j] = (data[i] * alpha + 255 * inv) / 255;
    rgb[j + 1] = (data[i + 1] * alpha + 255 * inv) / 255;
    rgb[j + 2] = (data[i + 2] * alpha + 255 * inv) / 255;
  }
  for (const b of boxes) {
    // floor/ceil so partially covered edge pixels are fully black.
    const px0 = Math.max(0, Math.floor(b.x * width));
    const py0 = Math.max(0, Math.floor(b.y * height));
    const px1 = Math.min(width, Math.ceil((b.x + b.w) * width));
    const py1 = Math.min(height, Math.ceil((b.y + b.h) * height));
    for (let y = py0; y < py1; y++) {
      rgb.fill(0, (y * width + px0) * 3, (y * width + px1) * 3);
    }
  }
  return rgb;
}

// ─── Sanitising pages that are copied untouched ─────────────────────────────

const N = (s: string) => PDFName.of(s);

function decodeName(raw: string): string {
  return raw.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Every /Name token in the given content streams, or null if one can't be decoded. */
function namesInStreams(ctx: PDFContext, obj: PDFObject | undefined): Set<string> | null {
  const names = new Set<string>();
  const streams: PDFObject[] = [];
  const resolved = obj instanceof PDFRef ? ctx.lookup(obj) : obj;
  if (resolved instanceof PDFArray) resolved.asArray().forEach((o) => streams.push(ctx.lookup(o) ?? o));
  else if (resolved) streams.push(resolved);
  for (const s of streams) {
    if (!(s instanceof PDFRawStream)) return null;
    let bytes: Uint8Array;
    try {
      bytes = decodePDFRawStream(s).decode();
    } catch {
      return null;
    }
    let text = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    for (const m of text.matchAll(/\/([^\s/<>[\]()%{}]*)/g)) names.add(decodeName(m[1]));
  }
  return names;
}

class ResourcePruner {
  private visited = new Set<PDFObject>();
  constructor(private ctx: PDFContext) {}

  /** Return a copy of `res` keeping only entries whose names the content uses. */
  prune(res: PDFDict, used: Set<string>): PDFDict {
    const out = this.ctx.obj({});
    for (const [category, value] of res.entries()) {
      const dict = this.ctx.lookup(value);
      if (!(dict instanceof PDFDict) || category.decodeText() === "ProcSet") {
        out.set(category, value);
        continue;
      }
      const filtered = this.ctx.obj({});
      for (const [name, entry] of dict.entries()) {
        if (!used.has(name.decodeText())) continue;
        filtered.set(name, entry);
        this.visitResource(this.ctx.lookup(entry));
      }
      out.set(category, filtered);
    }
    return out;
  }

  /** Prune a content-bearing stream (form XObject, tiling pattern, appearance stream) in place. */
  pruneStream(stream: PDFObject | undefined, inheritedUsed?: Set<string>) {
    if (!(stream instanceof PDFStream) || this.visited.has(stream)) return;
    this.visited.add(stream);
    const res = this.ctx.lookup(stream.dict.get(N("Resources")));
    if (!(res instanceof PDFDict)) {
      // Uses its parent's resources: make sure the parent keeps what it needs.
      if (inheritedUsed) {
        const names = namesInStreams(this.ctx, stream);
        if (names) names.forEach((n) => inheritedUsed.add(n));
      }
      return;
    }
    const used = namesInStreams(this.ctx, stream);
    if (!used) return; // can't read the stream: leave it untouched
    stream.dict.set(N("Resources"), this.prune(res, used));
  }

  private visitResource(obj: PDFObject | undefined) {
    if (obj instanceof PDFStream) {
      this.pruneStream(obj);
    } else if (obj instanceof PDFDict) {
      const smask = this.ctx.lookup(obj.get(N("SMask")));
      if (smask instanceof PDFDict) this.pruneStream(this.ctx.lookup(smask.get(N("G"))));
    }
  }
}

function sanitizeAnnotations(ctx: PDFContext, page: PDFPage, pruner: ResourcePruner) {
  const annots = ctx.lookup(page.node.get(N("Annots")));
  if (!(annots instanceof PDFArray)) {
    page.node.delete(N("Annots"));
    return;
  }
  const own = new Set(annots.asArray().map((a) => ctx.lookup(a)));
  const kept = ctx.obj([]);
  for (const entry of annots.asArray()) {
    const annot = ctx.lookup(entry);
    if (!(annot instanceof PDFDict)) continue;
    // Links out of this page's dictionary (other pages, field trees, reply chains).
    for (const key of ["P", "Parent", "Kids", "IRT", "AA", "Dest"]) annot.delete(N(key));
    const action = ctx.lookup(annot.get(N("A")));
    if (action instanceof PDFDict) {
      const kind = ctx.lookup(action.get(N("S")));
      const uri = ctx.lookup(action.get(N("URI")));
      if (kind instanceof PDFName && kind.decodeText() === "URI" && uri) {
        annot.set(N("A"), ctx.obj({ S: "URI", URI: uri }));
      } else {
        annot.delete(N("A"));
      }
    } else {
      annot.delete(N("A"));
    }
    const popup = ctx.lookup(annot.get(N("Popup")));
    if (popup && !own.has(popup)) annot.delete(N("Popup"));

    const ap = ctx.lookup(annot.get(N("AP")));
    if (ap instanceof PDFDict) {
      for (const [, state] of ap.entries()) {
        const s = ctx.lookup(state);
        if (s instanceof PDFStream) pruner.pruneStream(s);
        else if (s instanceof PDFDict) s.entries().forEach(([, v]) => pruner.pruneStream(ctx.lookup(v)));
      }
    }
    kept.push(entry);
  }
  page.node.set(N("Annots"), kept);
}

function sanitizeKeptPage(ctx: PDFContext, page: PDFPage, pruner: ResourcePruner) {
  for (const key of ["AA", "B", "PieceInfo"]) page.node.delete(N(key));
  sanitizeAnnotations(ctx, page, pruner);

  const res = ctx.lookup(page.node.getInheritableAttribute(N("Resources")));
  if (!(res instanceof PDFDict)) return;
  const used = namesInStreams(ctx, page.node.get(N("Contents")));
  if (!used) return;
  // Forms without their own /Resources draw from the page's: include their names.
  const xobjects = ctx.lookup(res.get(N("XObject")));
  if (xobjects instanceof PDFDict) {
    for (const [name, v] of xobjects.entries()) {
      if (!used.has(name.decodeText())) continue;
      const s = ctx.lookup(v);
      if (s instanceof PDFStream && !s.dict.get(N("Resources"))) {
        const inner = namesInStreams(ctx, s);
        if (inner) inner.forEach((n) => used.add(n));
      }
    }
  }
  page.node.set(N("Resources"), pruner.prune(res, used));
}

/** Delete every indirect object the saved file wouldn't reference. */
function dropUnreachable(doc: PDFDocument) {
  const ctx = doc.context;
  const seen = new Set<string>();
  const stack: PDFObject[] = [];
  if (ctx.trailerInfo.Root) stack.push(ctx.trailerInfo.Root);
  if (ctx.trailerInfo.Info) stack.push(ctx.trailerInfo.Info);
  while (stack.length) {
    const obj = stack.pop()!;
    if (obj instanceof PDFRef) {
      if (seen.has(obj.tag)) continue;
      seen.add(obj.tag);
      const target = ctx.lookup(obj);
      if (target) stack.push(target);
    } else if (obj instanceof PDFDict) {
      obj.entries().forEach(([, v]) => stack.push(v));
    } else if (obj instanceof PDFArray) {
      obj.asArray().forEach((v) => stack.push(v));
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict);
    }
  }
  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!seen.has(ref.tag)) ctx.delete(ref);
  }
}

// ─── Redact ─────────────────────────────────────────────────────────────────

export async function redactPDF(file: File, boxes: RedactBox[], opts: RedactOptions = {}): Promise<ToolResult> {
  if (!boxes?.length) return { success: false, error: EMPTY_BOXES_MESSAGE };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = await loadPdf(bytes); // decrypts restriction-only files, rejects password-locked ones
    const total = src.getPageCount();

    const byPage = new Map<number, RedactBox[]>();
    for (const raw of boxes) {
      const b = clampBox(raw);
      if (!b) continue;
      if (b.page < 1 || b.page > total) return { success: false, error: "A redaction box is on a page that doesn't exist." };
      byPage.set(b.page, [...(byPage.get(b.page) ?? []), b]);
    }
    if (!byPage.size) return { success: false, error: EMPTY_BOXES_MESSAGE };

    const dpi = opts.dpi && Number.isFinite(opts.dpi) && opts.dpi > 0 ? opts.dpi : 200;
    const render = opts.renderPage ?? canvasRenderer;

    // Sanitise and copy the untouched pages in one pass so shared objects are shared.
    const keptIndices = src.getPageIndices().filter((i) => !byPage.has(i + 1));
    const pruner = new ResourcePruner(src.context);
    for (const i of keptIndices) sanitizeKeptPage(src.context, src.getPage(i), pruner);

    // Fresh document: no Info dictionary, outline, AcroForm, names tree or OpenAction.
    const out = await PDFDocument.create({ updateMetadata: false });
    const copied = await out.copyPages(src, keptIndices);

    const pdfjsDoc = await openPdfjs(bytes);
    try {
      let k = 0;
      for (let i = 0; i < total; i++) {
        const pageBoxes = byPage.get(i + 1);
        if (!pageBoxes) {
          out.addPage(copied[k++]);
          continue;
        }
        const view = displayedPage(src.getPage(i));
        const pdfjsPage = await pdfjsDoc.getPage(i + 1);
        const vp1 = pdfjsPage.getViewport({ scale: 1 });
        let scale = Math.max(dpi / 72, MIN_SCALE);
        scale = Math.min(scale, MAX_SIDE_PX / Math.max(vp1.width, vp1.height), Math.sqrt(MAX_AREA_PX / (vp1.width * vp1.height)));
        const img = await render(pdfjsPage, scale);
        pdfjsPage.cleanup();
        const rgb = paintBoxesToRgb(img, pageBoxes);

        const imageRef = out.context.register(
          out.context.flateStream(rgb, {
            Type: "XObject",
            Subtype: "Image",
            Width: img.width,
            Height: img.height,
            ColorSpace: "DeviceRGB",
            BitsPerComponent: 8,
          })
        );
        const page = out.addPage([view.width, view.height]);
        const name = page.node.newXObject("Redacted", imageRef);
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(view.width, 0, 0, view.height, 0, 0),
          drawObject(name),
          popGraphicsState()
        );
      }
    } finally {
      await pdfjsDoc.destroy();
    }

    dropUnreachable(out);
    return {
      success: true,
      blob: await saveToBlob(out),
      filename: `${file.name.replace(/\.pdf$/i, "")}_redacted.pdf`,
    };
  } catch (e) {
    if (e instanceof Error && /too large to redact/.test(e.message)) return { success: false, error: e.message };
    return { success: false, error: toolErrorMessage(e, "Failed to redact this PDF. Make sure it's a valid PDF.") };
  }
}

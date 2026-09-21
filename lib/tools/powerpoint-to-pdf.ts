// PowerPoint to PDF: turns a .pptx into a PDF with one page per slide and real,
// selectable text. Runs entirely client-side — a .pptx is just a ZIP of XML, so
// jszip unpacks it, DOMParser reads it and pdf-lib draws it. Nothing is uploaded.
//
// Slides are absolutely positioned in EMUs (914400 per inch → 12700 per point),
// which maps almost directly onto a PDF page: every shape carries its own
// offset/extent, so positions, sizes, colours and alignment survive. What does
// NOT survive: animations, transitions, embedded video/audio, charts, SmartArt,
// shape rotation, gradients, theme/scheme colours and custom (non-Latin) fonts —
// pdf-lib's built-in fonts are Helvetica-family and WinAnsi-only.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import type ZipFile from "jszip";
import type { ToolResult } from "@/lib/pdf-tools";

const EMU_PER_PT = 12700;
/** 13.333in × 7.5in widescreen, in points — the modern PowerPoint default. */
const DEFAULT_SLIDE_PT: [number, number] = [960, 540];

export const NOT_PPTX_MESSAGE =
  "This doesn't look like a PowerPoint presentation. RizzPDF reads .pptx files (PowerPoint 2007 and newer).";
export const OLD_PPT_MESSAGE =
  "This is the old binary .ppt format, which can't be read in the browser. Open it in PowerPoint, Keynote or Google Slides and save it as .pptx, then try again.";

export interface PowerPointToPdfOptions {
  /** Called after each slide is drawn, so the UI can show slide-by-slide progress. */
  onProgress?: (done: number, total: number) => void;
}

// ─── XML helpers (namespace-prefix agnostic) ────────────────────────────────
// Producers other than PowerPoint sometimes use different prefixes for the same
// namespaces, so everything is looked up by local name.

const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (!root || root.localName === "parsererror" || doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Malformed XML");
  }
  return doc;
}

/** All descendants (any depth) with this local name, in document order. */
function all(root: Element | Document, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", name));
}

/** Direct children with this local name. */
function kids(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function kid(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return null;
}

/** Follow a chain of direct children, e.g. path(sp, "spPr", "xfrm", "off"). */
function path(el: Element | null, ...names: string[]): Element | null {
  let cur: Element | null = el;
  for (const n of names) cur = kid(cur, n);
  return cur;
}

function num(el: Element | null, attr: string, fallback: number): number {
  const v = el?.getAttribute(attr);
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function relId(el: Element): string | null {
  return el.getAttributeNS(NS_R, "embed") ?? el.getAttribute("r:embed") ?? null;
}

function relIdOfSlide(el: Element): string | null {
  return el.getAttributeNS(NS_R, "id") ?? el.getAttribute("r:id") ?? null;
}

// ─── ZIP / package helpers ──────────────────────────────────────────────────

/** Resolve an OPC relationship target against the part's own directory. */
function resolvePart(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = baseDir.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

async function readRels(zip: ZipFile, partPath: string): Promise<Map<string, string>> {
  const dir = partPath.slice(0, partPath.lastIndexOf("/"));
  const name = partPath.slice(partPath.lastIndexOf("/") + 1);
  const relsPath = `${dir}/_rels/${name}.rels`;
  const map = new Map<string, string>();
  const entry = zip.file(relsPath);
  if (!entry) return map;
  let doc: Document;
  try {
    doc = parseXml(await entry.async("string"));
  } catch {
    return map;
  }
  for (const rel of all(doc, "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (!id || !target) continue;
    if (rel.getAttribute("TargetMode") === "External") continue;
    map.set(id, resolvePart(dir, target));
  }
  return map;
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

async function openPptx(file: File): Promise<ZipFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Old binary Office files are OLE compound documents, not ZIPs.
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) || /\.ppt$/i.test(file.name)) {
    throw new Error(OLD_PPT_MESSAGE);
  }
  if (!startsWith(bytes, [0x50, 0x4b])) throw new Error(NOT_PPTX_MESSAGE);

  const JSZip = (await import("jszip")).default;
  let zip: ZipFile;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error(`${NOT_PPTX_MESSAGE} The file looks damaged — it couldn't be unpacked.`);
  }
  if (!zip.file("ppt/presentation.xml")) {
    if (zip.file("word/document.xml")) {
      throw new Error("This is a Word document, not a PowerPoint presentation. Use the Word to PDF tool instead.");
    }
    if (zip.file("xl/workbook.xml")) {
      throw new Error("This is an Excel workbook, not a PowerPoint presentation. Use the Excel to PDF tool instead.");
    }
    throw new Error(NOT_PPTX_MESSAGE);
  }
  return zip;
}

/**
 * Slide parts in presentation order. The order comes from `<p:sldIdLst>` in
 * ppt/presentation.xml resolved through its relationships — never from sorting
 * file names, which would put slide10 between slide1 and slide2.
 */
async function slidePaths(zip: ZipFile): Promise<string[]> {
  const out: string[] = [];
  try {
    const pres = parseXml(await zip.file("ppt/presentation.xml")!.async("string"));
    const rels = await readRels(zip, "ppt/presentation.xml");
    for (const sldId of all(pres, "sldId")) {
      const rid = relIdOfSlide(sldId);
      const target = rid ? rels.get(rid) : undefined;
      if (target && zip.file(target)) out.push(target);
    }
  } catch {
    // Fall through to the filename scan below.
  }
  if (out.length > 0) return out;

  // Fallback for decks with a missing/unreadable slide id list: numeric order.
  const found: { n: number; p: string }[] = [];
  zip.forEach((relativePath) => {
    const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(relativePath);
    if (m) found.push({ n: Number(m[1]), p: relativePath });
  });
  return found.sort((a, b) => a.n - b.n).map((f) => f.p);
}

/** How many slides the deck has. Throws a human-readable error for non-.pptx input. */
export async function readSlideCount(file: File): Promise<number> {
  const zip = await openPptx(file);
  return (await slidePaths(zip)).length;
}

// ─── Text encoding ──────────────────────────────────────────────────────────
// pdf-lib's built-in fonts are WinAnsi-only. Anything outside that repertoire
// is folded to a close ASCII equivalent where one exists, and otherwise
// replaced with "?" and reported back to the user rather than silently dropped.

const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function isWinAnsi(cp: number): boolean {
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA.has(cp);
}

const FOLD: Record<string, string> = {
  "‐": "-", "‑": "-", "‒": "-", "―": "-", "−": "-",
  "′": "'", "″": '"', "­": "", "​": "", "‌": "", "‍": "",
  "﻿": "", "️": "", "⁄": "/", " ": " ", " ": " ",
  "→": "->", "←": "<-", "⇒": "=>", "≤": "<=", "≥": ">=",
  "●": "•", "▪": "•", "■": "•", "◦": "•",
  "‣": "•", "⁃": "•", " ": " ",
};

/** WinAnsi-safe text; anything unrepresentable is recorded in `dropped`. */
function sanitize(text: string, dropped: Set<string>): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 9) { out += "    "; continue; }
    if (cp === 10 || cp === 13) { out += " "; continue; }
    if (isWinAnsi(cp)) { out += ch; continue; }
    const folded = FOLD[ch];
    if (folded !== undefined) { out += folded; continue; }
    dropped.add(ch);
    out += "?";
  }
  return out;
}

// ─── Slide model ────────────────────────────────────────────────────────────

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

interface RunStyle {
  size: number;
  bold: boolean;
  italic: boolean;
  color: RGB;
}

interface TextRun extends RunStyle {
  text: string;
}

type Align = "l" | "ctr" | "r";

interface Para {
  runs: TextRun[];
  align: Align;
  bullet: boolean;
  level: number;
}

/** A shape box in points, with the PDF's bottom-left origin already applied. */
interface Box {
  x: number;
  y: number; // bottom edge
  w: number;
  h: number;
}

/** EMU → slide-coordinate transform, used to flatten grouped shapes. */
type Transform = (x: number, y: number) => [number, number];
interface Frame {
  map: Transform;
  scaleX: number;
  scaleY: number;
}

const IDENTITY: Frame = { map: (x, y) => [x, y], scaleX: 1, scaleY: 1 };

function colorOf(fillParent: Element | null): RGB | null {
  const srgb = path(fillParent, "solidFill", "srgbClr");
  const hex = srgb?.getAttribute("val");
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function alignOf(pPr: Element | null): Align {
  const a = pPr?.getAttribute("algn");
  return a === "ctr" ? "ctr" : a === "r" ? "r" : "l";
}

/** Default point size for a placeholder when the run carries no explicit `sz`. */
function placeholderSize(sp: Element): number {
  const ph = path(sp, "nvSpPr", "nvPr", "ph");
  const type = ph?.getAttribute("type") ?? "";
  if (type === "title" || type === "ctrTitle") return 40;
  if (type === "subTitle") return 24;
  return 18;
}

function readParagraphs(txBody: Element, defaultSize: number, dropped: Set<string>): Para[] {
  const paras: Para[] = [];
  for (const p of kids(txBody, "p")) {
    const pPr = kid(p, "pPr");
    const para: Para = {
      runs: [],
      align: alignOf(pPr),
      bullet: !!(kid(pPr, "buChar") || kid(pPr, "buAutoNum")) && !kid(pPr, "buNone"),
      level: Math.min(8, Math.max(0, num(pPr, "lvl", 0))),
    };
    // `a:r` runs, `a:fld` fields (slide numbers, dates) and `a:br` line breaks,
    // in document order.
    for (const node of Array.from(p.children)) {
      if (node.localName === "br") {
        para.runs.push({ text: "\n", size: defaultSize, bold: false, italic: false, color: rgb(0, 0, 0) });
        continue;
      }
      if (node.localName !== "r" && node.localName !== "fld") continue;
      const raw = kids(node, "t").map((t) => t.textContent ?? "").join("");
      if (!raw) continue;
      const rPr = kid(node, "rPr");
      const szAttr = rPr?.getAttribute("sz");
      const size = szAttr ? Math.max(4, Number(szAttr) / 100) : defaultSize;
      para.runs.push({
        text: sanitize(raw, dropped),
        size: Number.isFinite(size) ? size : defaultSize,
        bold: rPr?.getAttribute("b") === "1",
        italic: rPr?.getAttribute("i") === "1",
        color: colorOf(rPr) ?? rgb(0, 0, 0),
      });
    }
    paras.push(para);
  }
  return paras;
}

// ─── Text layout ────────────────────────────────────────────────────────────

interface Seg {
  text: string;
  style: RunStyle;
  width: number;
}
interface LaidLine {
  segs: Seg[];
  width: number;
  size: number; // tallest run on the line
  align: Align;
  indent: number;
}

function fontFor(fonts: Fonts, style: RunStyle): PDFFont {
  if (style.bold && style.italic) return fonts.boldItalic;
  if (style.bold) return fonts.bold;
  if (style.italic) return fonts.italic;
  return fonts.regular;
}

/** Width of a WinAnsi-safe string; falls back to an estimate if pdf-lib balks. */
function widthOf(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.5;
  }
}

const LINE_SPACING = 1.2;

function layout(paras: Para[], maxWidth: number, fonts: Fonts, scale: number): LaidLine[] {
  const lines: LaidLine[] = [];
  for (const para of paras) {
    const indent = para.level * 18;
    const avail = Math.max(16, maxWidth - indent);
    let segs: Seg[] = [];
    let width = 0;
    let size = 0;

    const flush = () => {
      lines.push({ segs, width, size: size || 12, align: para.align, indent });
      segs = [];
      width = 0;
      size = 0;
    };
    const push = (text: string, style: RunStyle, w: number) => {
      const last = segs[segs.length - 1];
      if (last && last.style === style) {
        last.text += text;
        last.width += w;
      } else {
        segs.push({ text, style, width: w });
      }
      width += w;
      size = Math.max(size, style.size);
    };

    if (para.runs.length === 0) {
      lines.push({ segs: [], width: 0, size: 12 * scale, align: para.align, indent });
      continue;
    }

    let prefix = para.bullet ? "• " : "";
    for (const run of para.runs) {
      const style: RunStyle = {
        size: Math.max(4, run.size * scale),
        bold: run.bold,
        italic: run.italic,
        color: run.color,
      };
      const font = fontFor(fonts, style);
      if (prefix) {
        push(prefix, style, widthOf(font, prefix, style.size));
        prefix = "";
      }
      const pieces = run.text.split("\n"); // "\n" only ever comes from <a:br>
      pieces.forEach((piece, pieceIndex) => {
        if (pieceIndex > 0) flush();
        // Keep trailing whitespace attached to the word before it.
        const tokens = piece.match(/\S+\s*|\s+/g) ?? [];
        for (const token of tokens) {
          const word = token.replace(/\s+$/, "");
          const w = widthOf(font, token, style.size);
          const wordWidth = word ? widthOf(font, word, style.size) : 0;
          if (segs.length > 0 && width + wordWidth > avail) flush();
          if (segs.length === 0 && /^\s+$/.test(token)) continue; // no leading space
          push(token, style, w);
        }
      });
    }
    flush();
  }
  return lines;
}

const totalHeight = (lines: LaidLine[]) => lines.reduce((h, l) => h + l.size * LINE_SPACING, 0);

function drawParagraphs(page: PDFPage, box: Box, paras: Para[], fonts: Fonts, anchor: string, autoShrink: boolean) {
  let scale = 1;
  let lines = layout(paras, box.w, fonts, scale);
  // Shrink-to-fit, the way PowerPoint's own autofit does, so long bullet lists
  // don't spill across the slide. Never below half size.
  if (autoShrink) {
    let guard = 0;
    while (totalHeight(lines) > box.h && scale > 0.5 && guard++ < 8) {
      scale *= 0.88;
      lines = layout(paras, box.w, fonts, scale);
    }
  }

  const height = totalHeight(lines);
  const top = box.y + box.h;
  let cursor = top;
  if (anchor === "ctr") cursor = top - Math.max(0, (box.h - height) / 2);
  else if (anchor === "b") cursor = top - Math.max(0, box.h - height);

  for (const line of lines) {
    const lineHeight = line.size * LINE_SPACING;
    const baseline = cursor - line.size * 0.92;
    cursor -= lineHeight;
    if (line.segs.length === 0) continue;
    const avail = Math.max(16, box.w - line.indent);
    let x = box.x + line.indent;
    if (line.align === "ctr") x += Math.max(0, (avail - line.width) / 2);
    else if (line.align === "r") x += Math.max(0, avail - line.width);
    for (const seg of line.segs) {
      const text = seg.text.replace(/\s+$/, "");
      if (text) {
        try {
          page.drawText(text, {
            x,
            y: baseline,
            size: seg.style.size,
            font: fontFor(fonts, seg.style),
            color: seg.style.color,
          });
        } catch {
          // A single unrenderable run must never lose the rest of the slide.
        }
      }
      x += seg.width;
    }
  }
}

// ─── Shapes ─────────────────────────────────────────────────────────────────

function boxFromXfrm(xfrm: Element | null, frame: Frame, pageH: number): Box | null {
  const off = kid(xfrm, "off");
  const ext = kid(xfrm, "ext");
  if (!off || !ext) return null;
  const [ex, ey] = frame.map(num(off, "x", 0), num(off, "y", 0));
  const w = num(ext, "cx", 0) * frame.scaleX;
  const h = num(ext, "cy", 0) * frame.scaleY;
  if (w <= 0 || h <= 0) return null;
  return {
    x: ex / EMU_PER_PT,
    y: pageH - (ey + h) / EMU_PER_PT,
    w: w / EMU_PER_PT,
    h: h / EMU_PER_PT,
  };
}

function groupFrame(grpSp: Element, parent: Frame): Frame {
  const xfrm = path(grpSp, "grpSpPr", "xfrm");
  const off = kid(xfrm, "off");
  const ext = kid(xfrm, "ext");
  const chOff = kid(xfrm, "chOff");
  const chExt = kid(xfrm, "chExt");
  if (!off || !ext || !chOff || !chExt) return parent;
  const cw = num(chExt, "cx", 0);
  const ch = num(chExt, "cy", 0);
  if (cw <= 0 || ch <= 0) return parent;
  const sx = num(ext, "cx", cw) / cw;
  const sy = num(ext, "cy", ch) / ch;
  const ox = num(off, "x", 0);
  const oy = num(off, "y", 0);
  const cx = num(chOff, "x", 0);
  const cy = num(chOff, "y", 0);
  return {
    map: (x, y) => parent.map(ox + (x - cx) * sx, oy + (y - cy) * sy),
    scaleX: parent.scaleX * sx,
    scaleY: parent.scaleY * sy,
  };
}

async function embedImage(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return pdf.embedPng(bytes);
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return pdf.embedJpg(bytes);
  return null;
}

interface SlideContext {
  pdf: PDFDocument;
  page: PDFPage;
  zip: ZipFile;
  rels: Map<string, string>;
  fonts: Fonts;
  pageH: number;
  dropped: Set<string>;
  skippedImages: Set<string>;
  /** Where the next shape without an explicit position goes (points, top-down). */
  flowTop: number;
}

function drawShapeFill(page: PDFPage, sp: Element, box: Box) {
  const spPr = kid(sp, "spPr");
  const fill = colorOf(spPr);
  const line = colorOf(kid(spPr, "ln"));
  if (!fill && !line) return;
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    color: fill ?? undefined,
    borderColor: line ?? undefined,
    borderWidth: line ? Math.max(0.5, num(kid(spPr, "ln"), "w", 12700) / EMU_PER_PT) : undefined,
  });
}

function drawSp(ctx: SlideContext, sp: Element, frame: Frame) {
  const box = boxFromXfrm(path(sp, "spPr", "xfrm"), frame, ctx.pageH);
  const txBody = kid(sp, "txBody");
  const paras = txBody ? readParagraphs(txBody, placeholderSize(sp), ctx.dropped) : [];
  const hasText = paras.some((p) => p.runs.some((r) => r.text.trim()));

  if (box) {
    drawShapeFill(ctx.page, sp, box);
    if (!hasText) return;
    const bodyPr = kid(txBody, "bodyPr");
    const inset = {
      l: num(bodyPr, "lIns", 91440) / EMU_PER_PT,
      r: num(bodyPr, "rIns", 91440) / EMU_PER_PT,
      t: num(bodyPr, "tIns", 45720) / EMU_PER_PT,
      b: num(bodyPr, "bIns", 45720) / EMU_PER_PT,
    };
    const inner: Box = {
      x: box.x + inset.l,
      y: box.y + inset.b,
      w: Math.max(16, box.w - inset.l - inset.r),
      h: Math.max(8, box.h - inset.t - inset.b),
    };
    // PowerPoint's own "shrink text on overflow" — honour it when present.
    const fontScale = num(path(bodyPr, "normAutofit"), "fontScale", 0);
    if (fontScale > 0) {
      for (const p of paras) for (const r of p.runs) r.size = Math.max(4, (r.size * fontScale) / 100000);
    }
    drawParagraphs(ctx.page, inner, paras, ctx.fonts, kid(txBody, "bodyPr")?.getAttribute("anchor") ?? "t", true);
    return;
  }

  // No explicit geometry (it lives on the slide layout/master, which this tool
  // doesn't resolve): flow the text down the slide instead of dropping it.
  if (!hasText) return;
  const pageW = ctx.page.getWidth();
  const margin = pageW * 0.06;
  const inner: Box = {
    x: margin,
    y: 0,
    w: pageW - margin * 2,
    h: Math.max(24, ctx.flowTop),
  };
  const lines = layout(paras, inner.w, ctx.fonts, 1);
  const h = totalHeight(lines);
  inner.y = Math.max(0, ctx.flowTop - h);
  inner.h = h;
  drawParagraphs(ctx.page, inner, paras, ctx.fonts, "t", false);
  ctx.flowTop = Math.max(0, inner.y - 10);
}

async function drawPic(ctx: SlideContext, pic: Element, frame: Frame) {
  const box = boxFromXfrm(path(pic, "spPr", "xfrm"), frame, ctx.pageH);
  const blip = path(pic, "blipFill", "blip");
  const rid = blip ? relId(blip) : null;
  if (!box || !rid) return;
  const target = ctx.rels.get(rid);
  const entry = target ? ctx.zip.file(target) : null;
  if (!entry) return;
  const bytes = await entry.async("uint8array");
  let image: PDFImage | null = null;
  try {
    image = await embedImage(ctx.pdf, bytes);
  } catch {
    image = null; // corrupt/unsupported payload — skip, keep the slide
  }
  if (!image) {
    const ext = (target ?? "").split(".").pop()?.toLowerCase();
    ctx.skippedImages.add(ext && ext.length <= 5 ? `.${ext}` : "unsupported");
    return;
  }
  ctx.page.drawImage(image, { x: box.x, y: box.y, width: box.w, height: box.h });
}

/** A graphic frame table: cell text laid out on the grid, without cell shading. */
function drawTable(ctx: SlideContext, frame: Element, tf: Frame) {
  const box = boxFromXfrm(path(frame, "xfrm"), tf, ctx.pageH);
  const tbl = all(frame, "tbl")[0];
  if (!box || !tbl) return;
  const grid = kid(tbl, "tblGrid");
  const colWidths = grid ? kids(grid, "gridCol").map((c) => num(c, "w", 0) / EMU_PER_PT) : [];
  const rows = kids(tbl, "tr");
  if (colWidths.length === 0 || rows.length === 0) return;

  const gridWidth = colWidths.reduce((a, b) => a + b, 0) || box.w;
  const kx = box.w / gridWidth;
  const rawHeights = rows.map((r) => num(r, "h", 0) / EMU_PER_PT);
  const gridHeight = rawHeights.reduce((a, b) => a + b, 0) || box.h;
  const ky = box.h / gridHeight;

  let top = box.y + box.h;
  rows.forEach((tr, ri) => {
    const rowH = (rawHeights[ri] || gridHeight / rows.length) * ky;
    let x = box.x;
    kids(tr, "tc").forEach((tc, ci) => {
      const colW = (colWidths[ci] ?? gridWidth / colWidths.length) * kx;
      const txBody = kid(tc, "txBody");
      if (txBody) {
        const paras = readParagraphs(txBody, 14, ctx.dropped);
        if (paras.some((p) => p.runs.some((r) => r.text.trim()))) {
          drawParagraphs(
            ctx.page,
            { x: x + 4, y: top - rowH + 2, w: Math.max(12, colW - 8), h: Math.max(8, rowH - 4) },
            paras,
            ctx.fonts,
            "ctr",
            true
          );
        }
      }
      ctx.page.drawRectangle({
        x,
        y: top - rowH,
        width: colW,
        height: rowH,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });
      x += colW;
    });
    top -= rowH;
  });
}

async function drawTree(ctx: SlideContext, tree: Element, frame: Frame, depth = 0) {
  if (depth > 6) return; // pathological nesting guard
  for (const node of Array.from(tree.children)) {
    try {
      if (node.localName === "sp") drawSp(ctx, node, frame);
      else if (node.localName === "pic") await drawPic(ctx, node, frame);
      else if (node.localName === "graphicFrame") drawTable(ctx, node, frame);
      else if (node.localName === "grpSp") await drawTree(ctx, node, groupFrame(node, frame), depth + 1);
    } catch {
      // One bad shape must not cost the whole slide.
    }
  }
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function powerpointToPdf(file: File, opts: PowerPointToPdfOptions = {}): Promise<ToolResult> {
  try {
    const zip = await openPptx(file);
    const paths = await slidePaths(zip);
    if (paths.length === 0) {
      return { success: false, error: "This presentation has no slides to convert." };
    }

    // Slide size (EMU → pt), from the presentation part.
    let sizePt = DEFAULT_SLIDE_PT;
    try {
      const pres = parseXml(await zip.file("ppt/presentation.xml")!.async("string"));
      const sldSz = all(pres, "sldSz")[0];
      const w = num(sldSz ?? null, "cx", 0) / EMU_PER_PT;
      const h = num(sldSz ?? null, "cy", 0) / EMU_PER_PT;
      if (w > 1 && h > 1) sizePt = [w, h];
    } catch {
      // Keep the widescreen default.
    }

    const pdf = await PDFDocument.create();
    const fonts: Fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    };

    const dropped = new Set<string>();
    const skippedImages = new Set<string>();
    const failed: number[] = [];

    for (let i = 0; i < paths.length; i++) {
      const page = pdf.addPage([sizePt[0], sizePt[1]]);
      try {
        const slide = parseXml(await zip.file(paths[i])!.async("string"));
        const root = slide.documentElement;
        // Slide background, when it's a plain colour (theme fills are skipped).
        const bg = colorOf(path(kid(root, "cSld"), "bg", "bgPr"));
        if (bg) page.drawRectangle({ x: 0, y: 0, width: sizePt[0], height: sizePt[1], color: bg });

        const tree = all(root, "spTree")[0];
        if (tree) {
          const ctx: SlideContext = {
            pdf,
            page,
            zip,
            rels: await readRels(zip, paths[i]),
            fonts,
            pageH: sizePt[1],
            dropped,
            skippedImages,
            flowTop: sizePt[1] * 0.92,
          };
          await drawTree(ctx, tree, IDENTITY);
        }
      } catch {
        // Keep the blank page already added so slide numbering stays correct.
        failed.push(i + 1);
      }
      opts.onProgress?.(i + 1, paths.length);
      // Let the UI paint between slides.
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
    }

    const bytes = await pdf.save();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });

    const notes: string[] = [];
    if (failed.length) {
      notes.push(
        `${failed.length} slide${failed.length > 1 ? "s" : ""} (${failed.join(", ")}) couldn't be read and came through blank.`
      );
    }
    if (dropped.size) {
      const sample = [...dropped].slice(0, 8).join(" ");
      notes.push(
        `Some characters (${sample}) aren't supported by the PDF's built-in fonts and were replaced with "?". Non-Latin scripts such as Chinese, Japanese, Arabic, Greek or Cyrillic need an embedded font, which this tool can't do yet.`
      );
    }
    if (skippedImages.size) {
      notes.push(
        `Images in unsupported formats (${[...skippedImages].join(", ")}) were skipped — only PNG and JPEG can be embedded.`
      );
    }

    return {
      success: true,
      blob,
      filename: file.name.replace(/\.pptx?$/i, "") + ".pdf",
      ...(notes.length ? { warning: notes.join(" ") } : {}),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error && err.message ? err.message : NOT_PPTX_MESSAGE,
    };
  }
}

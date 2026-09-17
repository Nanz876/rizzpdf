import { PDFFont, StandardFonts, degrees } from "pdf-lib";
import type { PDFPageProxy } from "pdfjs-dist";
import type { ImageLike, Word } from "tesseract.js";
import { loadPdf, saveToBlob, toolErrorMessage, displayedPage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

/**
 * OCR for scanned PDFs — everything runs in the browser.
 *
 * A scanned page is a picture of text: nothing to select, search or copy. Each
 * selected page is rasterised with pdf.js at OCR_DPI and read by tesseract.js
 * (WASM). The raster is ONLY the OCR engine's input — it is never written back.
 * What lands in the output is the original page, byte for byte, with one
 * invisible (`opacity: 0`) text run drawn per recognised word, positioned on the
 * word it came from. The scan keeps its own resolution and file size; it just
 * becomes selectable and searchable.
 *
 * Pages that aren't OCR'd are left exactly as they were.
 *
 * Privacy: the user's file never leaves the browser. Only tesseract.js's WASM core
 * and language model are fetched, from its default CDN.
 *
 * Known limit: the invisible layer uses Helvetica (WinAnsi), so characters outside
 * Latin-1 can't be embedded and are dropped from the text layer. The plain-text
 * output (`text` / `pageTexts`) always keeps everything tesseract recognised.
 */

/** Pages a free (non-Pro) user may OCR per document. */
export const FREE_OCR_PAGES = 10;

/** Resolution the page is rasterised at for tesseract. Output quality is unaffected. */
export const OCR_DPI = 200;

/** A page with fewer than this many non-space characters has no usable text layer. */
export const MIN_TEXT_CHARS = 20;

const MAX_SIDE_PX = 14000;
const MAX_AREA_PX = 50_000_000;

/** What tesseract should read for one page, and how big that image is. */
export interface OcrRenderedPage {
  /** Pixel size of `image`. Recognised word boxes are measured in these pixels. */
  width: number;
  height: number;
  /** Passed straight to tesseract (a canvas in the browser). */
  image: ImageLike;
  /** Called once the page is done, to free the canvas. */
  release?: () => void;
}

export type OcrPageRenderer = (page: PDFPageProxy, scale: number) => Promise<OcrRenderedPage>;

export interface OcrOptions {
  /** 1-based page numbers to OCR. Default: every page. Others are left untouched. */
  pages?: number[];
  /** Called before each page and once at the end; OCR is slow, so surface this. */
  onProgress?: (done: number, total: number, stage: string) => void;
  /** Tesseract language code, e.g. "eng", "deu", "fra". Default "eng". */
  language?: string;
  /** Injected renderer (tests / non-DOM environments). Defaults to a DOM canvas. */
  renderPage?: OcrPageRenderer;
}

export interface OcrResult extends ToolResult {
  /** Everything recognised, pages separated by a blank line. */
  text?: string;
  /** One entry per page of the document; "" for pages that weren't OCR'd. */
  pageTexts?: string[];
}

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

// ─── Is this actually a scan? ───────────────────────────────────────────────

/**
 * Decide whether a PDF is a scan (page images with no text layer).
 *
 * A page counts as scanned when pdf.js finds fewer than MIN_TEXT_CHARS real
 * characters on it. The document counts as scanned when fewer than half its
 * pages have a text layer — so a text document with one blank page isn't
 * mistaken for a scan.
 */
export async function isScanned(file: File): Promise<{ scanned: boolean; pageCount: number; textPages: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await openPdfjs(bytes);
  try {
    let textPages = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let chars = 0;
      for (const item of content.items) {
        if ("str" in item) chars += item.str.replace(/\s+/g, "").length;
        if (chars >= MIN_TEXT_CHARS) break;
      }
      if (chars >= MIN_TEXT_CHARS) textPages++;
      page.cleanup();
    }
    return { scanned: textPages * 2 < doc.numPages, pageCount: doc.numPages, textPages };
  } finally {
    await doc.destroy();
  }
}

// ─── Rendering (OCR input only) ─────────────────────────────────────────────

const canvasRenderer: OcrPageRenderer = async (page, scale) => {
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  // Tesseract reads the canvas directly, so give it an opaque white background
  // rather than the transparent pixels a scan's own margins would leave.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  await page.render({ canvasContext: ctx, canvas, viewport, background: "#ffffff" }).promise;
  return {
    width,
    height,
    image: canvas,
    release: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
};

/** Scale that reaches OCR_DPI without blowing past the browser's canvas limits. */
function renderScale(page: PDFPageProxy): number {
  const vp = page.getViewport({ scale: 1 });
  return Math.min(
    OCR_DPI / 72,
    MAX_SIDE_PX / Math.max(vp.width, vp.height),
    Math.sqrt(MAX_AREA_PX / (vp.width * vp.height))
  );
}

// ─── Tesseract ──────────────────────────────────────────────────────────────

type TesseractModule = { createWorker: typeof import("tesseract.js").createWorker };

/**
 * tesseract.js ships as CommonJS (`export =`), so the dynamic import may hand back
 * either the namespace or an interop `default` wrapper depending on the bundler.
 */
async function getTesseract(): Promise<TesseractModule> {
  const mod = (await import("tesseract.js")) as unknown as Partial<TesseractModule> & { default?: TesseractModule };
  // Named first: reaching for `.default` when it isn't there throws under some loaders.
  if (typeof mod.createWorker === "function") return mod as TesseractModule;
  const fallback = mod.default;
  if (fallback && typeof fallback.createWorker === "function") return fallback;
  throw new Error("The OCR engine failed to load. Check your connection and try again.");
}

/** Flatten tesseract's block → paragraph → line → word tree into one word list. */
function wordsOf(page: { blocks?: unknown }): Word[] {
  const blocks = (page.blocks ?? null) as { paragraphs?: { lines?: { words?: Word[] }[] }[] }[] | null;
  if (!blocks) return [];
  const out: Word[] = [];
  for (const block of blocks) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) out.push(word);
      }
    }
  }
  return out;
}

// ─── Invisible text layer ───────────────────────────────────────────────────

/**
 * Helvetica is a WinAnsi standard font: it can't encode anything above Latin-1.
 * Drop what it can't represent rather than failing the whole document.
 */
function winAnsiSafe(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) out += ch;
  }
  return out;
}

function encodable(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Descender share of the font size: how far a word's box reaches below its baseline. */
const DESCENDER = 0.18;

// ─── OCR ────────────────────────────────────────────────────────────────────

function normalizePages(pages: number[] | undefined, total: number): number[] {
  if (!pages) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>();
  for (const p of pages) {
    const n = Math.round(p);
    if (Number.isFinite(n) && n >= 1 && n <= total) wanted.add(n);
  }
  return [...wanted].sort((a, b) => a - b);
}

/**
 * OCR a scanned PDF into a searchable PDF.
 *
 * Returns the same PDF with an invisible text layer added, plus the plain text,
 * so the page can offer a .txt download without running OCR twice.
 */
export async function ocrPdf(file: File, opts: OcrOptions = {}): Promise<OcrResult> {
  const report = opts.onProgress ?? (() => {});
  let worker: Awaited<ReturnType<TesseractModule["createWorker"]>> | null = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Edited in place: every page keeps its own content, size, /Rotate and crop box.
    const doc = await loadPdf(bytes); // decrypts restriction-only files, rejects password-locked ones
    const total = doc.getPageCount();
    const targets = normalizePages(opts.pages, total);
    if (!targets.length) return { success: false, error: "Select at least one page to read." };

    const render = opts.renderPage ?? canvasRenderer;
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pageTexts: string[] = Array.from({ length: total }, () => "");

    report(0, targets.length, "Starting the OCR engine…");
    const { createWorker } = await getTesseract();
    worker = await createWorker(opts.language || "eng");

    const pdfjsDoc = await openPdfjs(bytes);
    try {
      let done = 0;
      for (const pageNum of targets) {
        report(done, targets.length, `Reading page ${pageNum} of ${total}…`);

        const page = doc.getPage(pageNum - 1);
        // Geometry as the reader sees it: crop box, after /Rotate. pdf.js bakes both
        // into the pixels it renders, so image pixels and displayed points share an
        // origin (top-left) and orientation; `toUser` inverts that back to the page.
        const view = displayedPage(page);
        const pdfjsPage = await pdfjsDoc.getPage(pageNum);
        const img = await render(pdfjsPage, renderScale(pdfjsPage));
        pdfjsPage.cleanup();

        const recognized = await worker.recognize(img.image, {}, { text: true, blocks: true });
        img.release?.();
        pageTexts[pageNum - 1] = recognized.data.text ?? "";

        const sx = view.width / img.width;
        const sy = view.height / img.height;
        for (const word of wordsOf(recognized.data)) {
          const text = winAnsiSafe(word.text ?? "");
          if (!text.trim() || !word.bbox || !encodable(font, text)) continue;
          const left = word.bbox.x0 * sx;
          const boxW = Math.max((word.bbox.x1 - word.bbox.x0) * sx, 0.1);
          // tesseract measures y downwards from the top of the image.
          const boxH = Math.max((word.bbox.y1 - word.bbox.y0) * sy, 0.1);
          const boxBottomFromTop = word.bbox.y1 * sy;

          // Size the invisible glyphs so the run roughly fills the word's box:
          // start from its height, then stretch/shrink to match its width.
          const natural = font.widthOfTextAtSize(text, boxH);
          const size = natural > 0
            ? Math.min(Math.max((boxH * boxW) / natural, boxH * 0.5), boxH * 1.5)
            : boxH;

          // Baseline sits a little above the box's bottom edge, measured from the
          // bottom of the DISPLAYED page, then mapped into the page's user space.
          const { x, y } = view.toUser(left, view.height - boxBottomFromTop + size * DESCENDER);
          page.drawText(text, { x, y, size, font, opacity: 0, rotate: degrees(view.rotation) });
        }

        done++;
        report(done, targets.length, `Read ${done} of ${targets.length} page${targets.length === 1 ? "" : "s"}`);
      }
    } finally {
      await pdfjsDoc.destroy();
    }

    report(targets.length, targets.length, "Saving the searchable PDF…");
    const text = targets.map((p) => pageTexts[p - 1].trim()).filter(Boolean).join("\n\n");
    return {
      success: true,
      blob: await saveToBlob(doc),
      filename: `${file.name.replace(/\.pdf$/i, "")}_ocr.pdf`,
      text,
      pageTexts,
      warning: text.trim() ? undefined : "No text was recognised. The scan may be too faint, skewed or low-resolution.",
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to OCR this PDF. Make sure it's a valid PDF.") };
  } finally {
    try {
      await worker?.terminate();
    } catch {
      // Worker already gone: nothing to clean up.
    }
  }
}

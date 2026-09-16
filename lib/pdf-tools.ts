import { PDFDocument, PDFRawStream, PDFName, PDFNumber, PDFArray, PDFDict, PDFRef, StandardFonts, degrees, rgb, grayscale } from "pdf-lib";
import { loadPdf, saveToBlob, toolErrorMessage, displayedPage } from "@/lib/pdf-load";

export interface ToolResult {
  success: boolean;
  blob?: Blob;
  blobs?: Blob[];
  filename?: string;
  filenames?: string[];
  error?: string;
  warning?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke later: revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Bundle several outputs into one ZIP so the browser doesn't block multiple downloads. */
export async function zipFiles(blobs: Blob[], filenames: string[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  blobs.forEach((b, i) => zip.file(filenames[i] ?? `file_${i + 1}`, b));
  return zip.generateAsync({ type: "blob" });
}

/** Download one file directly, or several as a single ZIP. */
export async function downloadResults(blobs: Blob[], filenames: string[], zipName: string) {
  if (blobs.length === 1) {
    downloadBlob(blobs[0], filenames[0]);
  } else if (blobs.length > 1) {
    downloadBlob(await zipFiles(blobs, filenames), zipName);
  }
}

function baseName(file: File) {
  return file.name.replace(/\.pdf$/i, "");
}

async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

/** Render a PDF page to a canvas at the given scale, returns the canvas */
async function renderPageToCanvas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfJsDoc: any,
  pageNum: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const page = await pdfJsDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))), type, quality)
  );
}

// ─── Merge ───────────────────────────────────────────────────────────────────

export async function mergePDFs(files: File[]): Promise<ToolResult> {
  try {
    const merged = await PDFDocument.create();
    for (const file of files) {
      const doc = await loadPdf(file);
      const copied = await merged.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => merged.addPage(p));
    }
    return { success: true, blob: await saveToBlob(merged), filename: "merged.pdf" };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to merge PDFs. Make sure all files are valid PDFs.") };
  }
}

// ─── Split ───────────────────────────────────────────────────────────────────

/**
 * Parse a range string like "1-3, 5, 9-7" into groups of 0-based page indices.
 * Reversed ranges are accepted. Throws a user-facing message for bad input.
 */
export function parseRanges(rangeStr: string, total: number): number[][] {
  const parts = rangeStr.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one page or range, e.g. 1-3, 5.");
  return parts.map((part) => {
    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) throw new Error(`"${part}" isn't a page or range. Use numbers like 2 or 4-7.`);
    let start = parseInt(match[1], 10);
    let end = match[2] ? parseInt(match[2], 10) : start;
    if (start > end) [start, end] = [end, start];
    if (start < 1 || end > total) {
      throw new Error(`"${part}" is outside this document, which has ${total} page${total === 1 ? "" : "s"}.`);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  });
}

export async function splitPDF(
  file: File,
  mode: "every-page" | "range",
  rangeStr?: string
): Promise<ToolResult> {
  try {
    const doc = await loadPdf(file);
    const total = doc.getPageCount();
    const base = baseName(file);

    let groups: number[][];
    if (mode === "every-page") {
      groups = Array.from({ length: total }, (_, i) => [i]);
    } else {
      try {
        groups = parseRanges(rangeStr || `1-${total}`, total);
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Invalid page range." };
      }
    }

    const blobs: Blob[] = [];
    const filenames: string[] = [];
    for (let g = 0; g < groups.length; g++) {
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(doc, groups[g]);
      copied.forEach((p) => newDoc.addPage(p));
      blobs.push(await saveToBlob(newDoc));
      filenames.push(mode === "every-page" ? `${base}_page${groups[g][0] + 1}.pdf` : `${base}_part${g + 1}.pdf`);
    }
    return { success: true, blobs, filenames };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to split PDF.") };
  }
}

// ─── Compress ────────────────────────────────────────────────────────────────

const COMPRESS_SETTINGS = {
  low: { maxEdge: 1400, quality: 0.6, flateMaxRatio: 0.8 },     // "Extreme"
  medium: { maxEdge: 2200, quality: 0.75, flateMaxRatio: 0.6 }, // "Recommended"
  high: { maxEdge: 3200, quality: 0.85, flateMaxRatio: 0.45 },  // "Less"
} as const;

function numberOf(dict: PDFDict, key: string): number | undefined {
  const v = dict.get(PDFName.of(key));
  return v instanceof PDFNumber ? v.asNumber() : undefined;
}

/** Number of colour components for simple colour spaces we can safely re-encode; undefined otherwise. */
function simpleComponents(doc: PDFDocument, dict: PDFDict): 1 | 3 | undefined {
  let cs = dict.get(PDFName.of("ColorSpace"));
  if (cs instanceof PDFRef) cs = doc.context.lookup(cs);
  if (cs instanceof PDFName) {
    const n = cs.asString();
    if (n === "/DeviceRGB") return 3;
    if (n === "/DeviceGray") return 1;
    return undefined;
  }
  if (cs instanceof PDFArray && cs.get(0)?.toString() === "/ICCBased") {
    const stream = doc.context.lookup(cs.get(1));
    const nComp = stream && "dict" in stream ? numberOf((stream as PDFRawStream).dict, "N") : undefined;
    return nComp === 3 ? 3 : nComp === 1 ? 1 : undefined; // skip CMYK (N=4)
  }
  return undefined;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decode an image XObject into a canvas-drawable source, or null if unsupported. */
async function decodeImage(
  doc: PDFDocument,
  obj: PDFRawStream,
  w: number,
  h: number
): Promise<CanvasImageSource | null> {
  const dict = obj.dict;
  if (dict.get(PDFName.of("ImageMask")) || dict.get(PDFName.of("Decode"))) return null;
  if (numberOf(dict, "BitsPerComponent") !== 8) return null;
  const comps = simpleComponents(doc, dict);
  if (!comps) return null;

  const filter = dict.get(PDFName.of("Filter"))?.toString();
  if (filter === "/DCTDecode") {
    return createImageBitmap(new Blob([obj.getContents() as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }));
  }
  if (filter === "/FlateDecode" && !dict.get(PDFName.of("DecodeParms"))) {
    const raw = await inflate(obj.getContents());
    if (raw.length < w * h * comps) return null;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0, j = 0; i < w * h; i++, j += comps) {
      const o = i * 4;
      rgba[o] = raw[j];
      rgba[o + 1] = comps === 3 ? raw[j + 1] : raw[j];
      rgba[o + 2] = comps === 3 ? raw[j + 2] : raw[j];
      rgba[o + 3] = 255;
    }
    return createImageBitmap(new ImageData(rgba, w, h));
  }
  return null;
}

export async function compressPDF(
  file: File,
  quality: "low" | "medium" | "high"
): Promise<ToolResult> {
  try {
    // Re-encode embedded photos/scans (JPEG and lossless Flate images) as JPEG,
    // downsampling oversized ones. Text, fonts and vector graphics are never
    // touched, so text stays selectable.
    const settings = COMPRESS_SETTINGS[quality];
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const doc = await loadPdf(originalBytes);
    const context = doc.context;

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      if (dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
      const w = numberOf(dict, "Width") ?? 0;
      const h = numberOf(dict, "Height") ?? 0;
      if (w < 64 || h < 64) continue;

      const filter = dict.get(PDFName.of("Filter"))?.toString();
      const original = obj.getContents();
      let source: CanvasImageSource | null = null;
      try {
        source = await decodeImage(doc, obj, w, h);
      } catch {
        source = null;
      }
      if (!source) continue;

      const scale = Math.min(1, settings.maxEdge / Math.max(w, h));
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, nw, nh);
      ctx.drawImage(source, 0, 0, nw, nh);
      const jpeg = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", settings.quality)).arrayBuffer());
      canvas.width = 0;
      canvas.height = 0;

      // Lossless (Flate) images are usually screenshots/line art: only switch them
      // to JPEG when the saving is substantial, to avoid visible artefacts.
      const limit = filter === "/FlateDecode" ? original.length * settings.flateMaxRatio : original.length;
      if (jpeg.length >= limit) continue;

      const newDict = dict.clone(context);
      newDict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
      newDict.delete(PDFName.of("DecodeParms"));
      newDict.set(PDFName.of("Width"), PDFNumber.of(nw));
      newDict.set(PDFName.of("Height"), PDFNumber.of(nh));
      newDict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
      newDict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
      context.assign(ref, PDFRawStream.of(newDict, jpeg));
    }

    const blob = await saveToBlob(doc);
    const filename = `${baseName(file)}_compressed.pdf`;
    if (blob.size >= originalBytes.length) {
      // Never hand back a bigger file.
      return {
        success: true,
        blob: new Blob([originalBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
        filename,
        warning: "This PDF is already well optimised — there was nothing worth compressing.",
      };
    }
    return { success: true, blob, filename };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to compress PDF.") };
  }
}

// ─── Rotate ───────────────────────────────────────────────────────────────────

export async function rotatePDF(
  file: File,
  angle: 90 | 180 | 270,
  pageSelection: "all" | number[]
): Promise<ToolResult> {
  try {
    const doc = await loadPdf(file);
    const pages = doc.getPages();
    const targets = pageSelection === "all" ? pages.map((_, i) => i) : pageSelection.map((n) => n - 1);
    for (const idx of targets) {
      if (idx >= 0 && idx < pages.length) {
        const current = pages[idx].getRotation().angle;
        pages[idx].setRotation(degrees((((current + angle) % 360) + 360) % 360));
      }
    }
    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_rotated.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to rotate PDF.") };
  }
}

/** Apply per-page rotations (1-based page number → degrees to add). */
export async function rotatePages(file: File, rotations: Record<number, number>): Promise<ToolResult> {
  try {
    const doc = await loadPdf(file);
    doc.getPages().forEach((page, i) => {
      const add = rotations[i + 1];
      if (!add) return;
      page.setRotation(degrees((((page.getRotation().angle + add) % 360) + 360) % 360));
    });
    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_rotated.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to rotate PDF.") };
  }
}

// ─── PDF to images ────────────────────────────────────────────────────────────

async function pdfToImages(
  file: File,
  type: "image/jpeg" | "image/png",
  dpi: number,
  pages?: number[]
): Promise<ToolResult> {
  const ext = type === "image/png" ? "png" : "jpg";
  try {
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const numPages = pdfJsDoc.numPages;
    const wanted = (pages?.length ? pages : Array.from({ length: numPages }, (_, i) => i + 1))
      .filter((n) => n >= 1 && n <= numPages)
      .sort((a, b) => a - b);
    const base = baseName(file);

    const blobs: Blob[] = [];
    const filenames: string[] = [];
    for (const pageNum of wanted) {
      const canvas = await renderPageToCanvas(pdfJsDoc, pageNum, dpi / 72);
      blobs.push(await canvasToBlob(canvas, type, type === "image/jpeg" ? 0.92 : undefined));
      canvas.width = 0;
      canvas.height = 0;
      filenames.push(numPages === 1 ? `${base}.${ext}` : `${base}_page${pageNum}.${ext}`);
    }
    return { success: true, blobs, filenames };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, `Failed to convert PDF to ${ext.toUpperCase()} images.`) };
  }
}

export function pdfToJpg(file: File, dpi: number = 150, pages?: number[]): Promise<ToolResult> {
  return pdfToImages(file, "image/jpeg", dpi, pages);
}

export function pdfToPng(file: File, dpi: number = 150, pages?: number[]): Promise<ToolResult> {
  return pdfToImages(file, "image/png", dpi, pages);
}

// ─── JPG to PDF ───────────────────────────────────────────────────────────────

const A4: [number, number] = [595.28, 841.89];

/** Read the EXIF Orientation (1-8) from JPEG bytes; 1 when absent. */
export function jpegOrientation(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let off = 2;
  while (off + 4 < bytes.length && bytes[off] === 0xff) {
    const marker = bytes[off + 1];
    const len = (bytes[off + 2] << 8) | bytes[off + 3];
    if (marker === 0xe1 && String.fromCharCode(...bytes.subarray(off + 4, off + 8)) === "Exif") {
      const t = off + 10;
      const le = bytes[t] === 0x49;
      const u16 = (p: number) => (le ? bytes[p] | (bytes[p + 1] << 8) : (bytes[p] << 8) | bytes[p + 1]);
      const u32 = (p: number) => (le ? (u16(p) | (u16(p + 2) << 16)) >>> 0 : ((u16(p) << 16) | u16(p + 2)) >>> 0);
      const ifd = t + u32(t + 4);
      const count = u16(ifd);
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    if (marker === 0xda) break; // start of scan
    off += 2 + len;
  }
  return 1;
}

async function imageToPng(file: File): Promise<Uint8Array> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${file.name}" couldn't be read. Use JPG or PNG (iPhone HEIC photos need converting first).`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob = await canvasToBlob(canvas, "image/png");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function jpgToPdf(images: File[]): Promise<ToolResult> {
  try {
    const doc = await PDFDocument.create();

    for (const img of images) {
      const bytes = new Uint8Array(await img.arrayBuffer());
      const isJpeg = img.type === "image/jpeg" || /\.(jpe?g)$/i.test(img.name);
      const isPng = img.type === "image/png" || /\.png$/i.test(img.name);

      let orientation = 1;
      let embedded;
      if (isJpeg) {
        orientation = jpegOrientation(bytes);
        if ([2, 4, 5, 7].includes(orientation)) {
          // Mirrored orientations: let the browser apply them, then embed losslessly.
          embedded = await doc.embedPng(await imageToPng(img));
          orientation = 1;
        } else {
          embedded = await doc.embedJpg(bytes); // original bytes: full resolution, no recompression
        }
      } else if (isPng) {
        embedded = await doc.embedPng(bytes);
      } else {
        embedded = await doc.embedPng(await imageToPng(img));
      }

      const sideways = orientation === 6 || orientation === 8;
      const dispW = sideways ? embedded.height : embedded.width;
      const dispH = sideways ? embedded.width : embedded.height;

      // A4 in the image's orientation; scale down to fit, never up past 96 DPI.
      const [pw, ph] = dispW > dispH ? [A4[1], A4[0]] : A4;
      const scale = Math.min(pw / dispW, ph / dispH, 72 / 96);
      const bw = dispW * scale;
      const bh = dispH * scale;
      const bx = (pw - bw) / 2;
      const by = (ph - bh) / 2;

      const page = doc.addPage([pw, ph]);
      if (orientation === 6) {
        page.drawImage(embedded, { x: bx, y: by + bh, width: bh, height: bw, rotate: degrees(-90) });
      } else if (orientation === 8) {
        page.drawImage(embedded, { x: bx + bw, y: by, width: bh, height: bw, rotate: degrees(90) });
      } else if (orientation === 3) {
        page.drawImage(embedded, { x: bx + bw, y: by + bh, width: bw, height: bh, rotate: degrees(180) });
      } else {
        page.drawImage(embedded, { x: bx, y: by, width: bw, height: bh });
      }
    }

    return { success: true, blob: await saveToBlob(doc), filename: "images.pdf" };
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("couldn't be read") ? e.message : "Failed to convert images to PDF.";
    return { success: false, error: msg };
  }
}

// ─── Watermark ────────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  text: string;
  opacity?: number;    // 0–1
  rotation?: number;  // degrees counter-clockwise, used for "diagonal"
  fontSize?: number;
  color?: "gray" | "red" | "blue";
  position?: "center" | "diagonal";
}

const UNSUPPORTED_TEXT =
  "Watermark and page-number text can use Latin letters, numbers and common symbols only.";

export async function watermarkPDF(file: File, opts: WatermarkOptions): Promise<ToolResult> {
  try {
    const { text, opacity = 0.3, rotation = 30, fontSize = 60, color = "gray", position = "diagonal" } = opts;
    if (!text.trim()) return { success: false, error: "Enter some watermark text." };

    const doc = await loadPdf(file);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    try {
      font.encodeText(text);
    } catch {
      return { success: false, error: UNSUPPORTED_TEXT };
    }

    const fillColor = { gray: grayscale(0.5), red: rgb(0.8, 0.1, 0.1), blue: rgb(0.1, 0.1, 0.8) }[color];
    const angle = position === "diagonal" ? rotation : 0;
    const rad = (angle * Math.PI) / 180;

    for (const page of doc.getPages()) {
      const view = displayedPage(page);
      // Shrink long text so it stays on the page.
      const maxWidth = (position === "diagonal" ? Math.hypot(view.width, view.height) : view.width) * 0.85;
      const size = Math.min(fontSize, (fontSize * maxWidth) / Math.max(1, font.widthOfTextAtSize(text, fontSize)));
      const tw = font.widthOfTextAtSize(text, size);
      const halfCap = size * 0.35;
      // Baseline start so the text's centre sits at the page centre.
      const dx = view.width / 2 - (tw / 2) * Math.cos(rad) + halfCap * Math.sin(rad);
      const dy = view.height / 2 - (tw / 2) * Math.sin(rad) - halfCap * Math.cos(rad);
      const { x, y } = view.toUser(dx, dy);
      page.drawText(text, { x, y, size, font, color: fillColor, opacity, rotate: degrees(angle + view.rotation) });
    }

    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_watermarked.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to add watermark.") };
  }
}

// ─── Organize ─────────────────────────────────────────────────────────────────

/**
 * Reorder (and optionally drop) pages in place. Working on the original document
 * rather than copying into a new one keeps form fields, metadata and bookmarks.
 * `newOrder` holds 0-based source page indices; omitted pages are removed.
 */
export async function organizePDF(file: File, newOrder: number[]): Promise<ToolResult> {
  try {
    const doc = await loadPdf(file);
    const pages = doc.getPages();
    if (!newOrder.length) return { success: false, error: "A PDF needs at least one page." };
    if (new Set(newOrder).size !== newOrder.length || newOrder.some((i) => i < 0 || i >= pages.length)) {
      return { success: false, error: "Invalid page order." };
    }
    for (let i = pages.length - 1; i >= 0; i--) doc.removePage(i);
    newOrder.forEach((i) => doc.addPage(pages[i]));
    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_organized.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to organize PDF.") };
  }
}

/** Render all pages of a PDF as thumbnail data URLs. Throws a user-facing message on failure. */
export async function renderThumbnails(file: File, scale = 0.3): Promise<string[]> {
  try {
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const thumbs: string[] = [];
    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
      const canvas = await renderPageToCanvas(pdfJsDoc, i, scale);
      thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
      canvas.width = 0;
      canvas.height = 0;
    }
    return thumbs;
  } catch (e) {
    throw new Error(toolErrorMessage(e, "This file couldn't be opened. Make sure it's a valid PDF."));
  }
}

// ─── Page Numbers ─────────────────────────────────────────────────────────────

export interface PageNumberOptions {
  position?: "bottom-center" | "bottom-right" | "bottom-left" | "top-center";
  startFrom?: number;
  fontSize?: number;
  format?: "1" | "Page 1" | "1 / N";
}

export async function addPageNumbers(file: File, opts: PageNumberOptions = {}): Promise<ToolResult> {
  try {
    const { position = "bottom-center", startFrom = 1, fontSize = 12, format = "1" } = opts;
    const doc = await loadPdf(file);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const last = pages.length + startFrom - 1;
    const margin = 20;

    pages.forEach((page, i) => {
      const num = i + startFrom;
      const label = format === "1" ? `${num}` : format === "Page 1" ? `Page ${num}` : `${num} / ${last}`;
      const view = displayedPage(page);
      const tw = font.widthOfTextAtSize(label, fontSize);
      const dx =
        position === "bottom-right" ? view.width - tw - margin
        : position === "bottom-left" ? margin
        : (view.width - tw) / 2;
      const dy = position === "top-center" ? view.height - margin - fontSize : margin;
      const { x, y } = view.toUser(dx, dy);
      page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2), rotate: degrees(view.rotation) });
    });

    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_numbered.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to add page numbers.") };
  }
}

// ─── Sign (embed signature image onto PDF) ────────────────────────────────────

export interface SignOptions {
  signatureDataUrl: string; // PNG or JPEG data URL
  page?: number;            // 1-based, default last page
  /** Left edge of the signature as a fraction of the displayed page width. */
  x?: number;
  /** Top edge of the signature as a fraction of the displayed page height (0 = top). */
  yFromTop?: number;
  /** Legacy: bottom edge as a fraction of page height (0 = bottom). Ignored when yFromTop is set. */
  y?: number;
  widthRatio?: number;      // fraction of displayed page width, default 0.3
}

export async function signPDF(file: File, opts: SignOptions): Promise<ToolResult> {
  try {
    const { signatureDataUrl, page, x = 0.5, widthRatio = 0.3 } = opts;
    const doc = await loadPdf(file);
    const pages = doc.getPages();
    const target = pages[page ? page - 1 : pages.length - 1];
    if (!target) return { success: false, error: "That page doesn't exist." };

    const [header, base64] = signatureDataUrl.split(",");
    const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const sig = header.includes("image/png") ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);

    const view = displayedPage(target);
    const sw = view.width * widthRatio;
    const sh = (sig.height / sig.width) * sw;
    const dx = x * view.width;
    const dy = opts.yFromTop !== undefined ? view.height - opts.yFromTop * view.height - sh : (opts.y ?? 0.1) * view.height;
    const pos = view.toUser(dx, dy);
    target.drawImage(sig, { x: pos.x, y: pos.y, width: sw, height: sh, rotate: degrees(view.rotation) });

    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_signed.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to add signature.") };
  }
}

// ─── Delete Pages ─────────────────────────────────────────────────────────────

export async function deletePages(file: File, pagesToDelete: number[]): Promise<ToolResult> {
  try {
    const doc = await loadPdf(file);
    const total = doc.getPageCount();
    const toDelete = [...new Set(pagesToDelete.map((p) => p - 1))].filter((i) => i >= 0 && i < total);
    if (toDelete.length >= total) {
      return { success: false, error: "Cannot delete all pages from the document." };
    }
    // Remove in place (highest index first) so forms, metadata and bookmarks survive.
    toDelete.sort((a, b) => b - a).forEach((i) => doc.removePage(i));
    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_edited.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to delete pages.") };
  }
}

// ─── Repair PDF ───────────────────────────────────────────────────────────────

export async function repairPDF(file: File): Promise<ToolResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Pass 1: structure-preserving — pdf-lib rebuilds the cross-reference table.
  try {
    const doc = await loadPdf(bytes);
    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_repaired.pdf` };
  } catch (e) {
    if ((e as Error)?.name === "PdfPasswordError") return { success: false, error: toolErrorMessage(e, "") };
    // pdf-lib couldn't parse — fall through to rendering recovery
  }

  // Pass 2: PDF.js is more tolerant; rebuild each page from a rendered image at its real size.
  try {
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const newPdf = await PDFDocument.create();
    for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
      const pdfPage = await pdfJsDoc.getPage(pageNum);
      const { width, height } = pdfPage.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(pdfJsDoc, pageNum, 2);
      const jpg = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.92)).arrayBuffer());
      canvas.width = 0;
      canvas.height = 0;
      const image = await newPdf.embedJpg(jpg);
      newPdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    }
    return {
      success: true,
      blob: await saveToBlob(newPdf),
      filename: `${baseName(file)}_repaired.pdf`,
      warning: "Severe damage detected — pages were rebuilt from rendered images. Text is no longer selectable in the output.",
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to repair PDF. The file may be too corrupted to recover.") };
  }
}

// ─── Protect ──────────────────────────────────────────────────────────────────

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function protectPDF(
  file: File,
  userPassword: string,
  ownerPassword?: string
): Promise<ToolResult> {
  try {
    if (!userPassword) return { success: false, error: "Enter a password." };
    // Decrypt restriction-only inputs first; password-protected inputs must be unlocked.
    const doc = await loadPdf(file);
    const plain = await doc.save({ useObjectStreams: false });
    const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
    const encrypted = await encryptPDF(plain, userPassword, {
      // If the owner password equalled the open password, anyone who can open the
      // file could also lift the restrictions. Use a random one unless provided.
      ownerPassword: ownerPassword || randomPassword(),
      algorithm: "AES-256",
      allowPrinting: true,
      allowHighQualityPrint: true,
      allowModifying: false,
      allowCopying: false,
      allowAnnotating: false,
      allowFillingForms: true,
      allowExtraction: false,
      allowAssembly: false,
    });
    const blob = new Blob([encrypted as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_protected.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to password-protect this PDF.") };
  }
}

// ─── PDF to Word ──────────────────────────────────────────────────────────────

type TextItem = { str: string; x: number; y: number; w: number; size: number; bold: boolean; italic: boolean };
type Line = { text: string; x: number; y: number; size: number; bold: boolean; italic: boolean };

const BULLET_RE = /^[•●▪◦‣∙·\-–]\s+/;

export const NO_TEXT_MESSAGE =
  "This PDF has no selectable text — it looks like a scanned document. RizzPDF can't read text from images yet (no OCR).";

export async function pdfToWord(file: File): Promise<ToolResult> {
  try {
    const pdfjsLib = await getPdfjsLib();
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [];
    let totalChars = 0;
    let pageWidthPt = 612;
    let pageHeightPt = 792;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      if (pageNum === 1) {
        pageWidthPt = viewport.width;
        pageHeightPt = viewport.height;
      }
      const content = await page.getTextContent();

      // Font names (for bold/italic) are only available after the operator list loads.
      const fontNames = new Map<string, string>();
      try {
        await page.getOperatorList();
        for (const id of Object.keys(content.styles)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const font = page.commonObjs.has(id) ? (page.commonObjs.get(id) as any) : null;
          if (font?.name) fontNames.set(id, String(font.name));
        }
      } catch {
        // Styling is best-effort.
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
      if (!items.length) continue;

      // 2. Group into lines by baseline, then order left to right.
      items.sort((p, q) => p.y - q.y || p.x - q.x);
      const rawLines: TextItem[][] = [];
      for (const it of items) {
        const line = rawLines.find((l) => Math.abs(l[0].y - it.y) <= Math.max(2, it.size * 0.4));
        if (line) line.push(it);
        else rawLines.push([it]);
      }
      const lines: Line[] = rawLines
        .map((l) => {
          l.sort((p, q) => p.x - q.x);
          let text = "";
          let prevEnd = -Infinity;
          for (const it of l) {
            const gap = it.x - prevEnd;
            if (text) text += gap > it.size * 2 ? "\t" : gap > it.size * 0.15 && !text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
            text += it.str;
            prevEnd = it.x + it.w;
          }
          return {
            text: text.replace(/ {2,}/g, " ").trim(),
            x: l[0].x,
            y: l[0].y,
            size: Math.max(...l.map((i) => i.size)),
            bold: l.every((i) => i.bold),
            italic: l.every((i) => i.italic),
          };
        })
        .filter((l) => l.text)
        .sort((p, q) => p.y - q.y);

      // 3. Body size = most common line size (weighted by characters).
      const weight = new Map<number, number>();
      for (const l of lines) weight.set(l.size, (weight.get(l.size) ?? 0) + l.text.length);
      const body = [...weight.entries()].sort((p, q) => q[1] - p[1])[0][0];
      const leftMargin = Math.min(...lines.map((l) => l.x));

      // 4. Merge wrapped lines into paragraphs.
      type Para = { lines: Line[]; bullet: boolean };
      const paras: Para[] = [];
      for (const line of lines) {
        const prev = paras[paras.length - 1];
        const last = prev?.lines[prev.lines.length - 1];
        const isBullet = BULLET_RE.test(line.text);
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

      // 5. Emit Word paragraphs.
      paras.forEach((p, idx) => {
        const first = p.lines[0];
        const text = p.lines
          .map((l) => l.text)
          .reduce((acc, t) => (acc.endsWith("-") && !acc.endsWith(" -") ? acc.slice(0, -1) + t : acc ? `${acc} ${t}` : t), "")
          .replace(BULLET_RE, "");
        const size = first.size;
        const heading = size >= body * 1.5 ? HeadingLevel.HEADING_1 : size >= body * 1.2 ? HeadingLevel.HEADING_2 : undefined;
        const indentPt = Math.max(0, first.x - leftMargin);
        children.push(
          new Paragraph({
            heading,
            bullet: p.bullet ? { level: 0 } : undefined,
            indent: !p.bullet && indentPt > body ? { left: Math.round(indentPt * 20) } : undefined,
            spacing: { after: Math.round(body * 6) },
            pageBreakBefore: idx === 0 && pageNum > 1 && children.length > 0,
            children: [
              new TextRun({
                text,
                bold: first.bold || !!heading,
                italics: first.italic,
                size: Math.round(size * 2),
              }),
            ],
          })
        );
      });
    }

    if (totalChars === 0) return { success: false, error: NO_TEXT_MESSAGE };

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
    return { success: true, blob: await Packer.toBlob(doc), filename: file.name.replace(/\.pdf$/i, ".docx") };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Conversion failed. Make sure the file is a valid PDF.") };
  }
}

// ─── Batch Processing ─────────────────────────────────────────────────────────

export type BatchOptions =
  | { tool: "compress"; quality: "low" | "medium" | "high" }
  | { tool: "rotate"; angle: 90 | 180 | 270 }
  | { tool: "pdf-to-jpg" }
  | { tool: "watermark"; text: string; opacity?: number; position?: "center" | "diagonal"; fontSize?: number; color?: "gray" | "red" | "blue" }
  | { tool: "page-numbers"; position?: "bottom-center" | "bottom-right" | "bottom-left" }
  | { tool: "unlock"; password?: string };

export async function batchProcess(
  files: File[],
  options: BatchOptions,
  onProgress: (fileIndex: number, status: "processing" | "done" | "error", error?: string) => void
): Promise<Array<{ blob: Blob; filename: string; warning?: string } | null>> {
  const CONCURRENCY = 3;
  const results: Array<{ blob: Blob; filename: string; warning?: string } | null> = new Array(files.length).fill(null);
  let activeCount = 0;
  let nextIndex = 0;

  const processFile = async (i: number): Promise<void> => {
    onProgress(i, "processing");
    try {
      const f = files[i];
      let result: ToolResult = { success: false, error: "Unknown tool" };

      if (options.tool === "compress") {
        result = await compressPDF(f, options.quality);
      } else if (options.tool === "rotate") {
        result = await rotatePDF(f, options.angle, "all");
      } else if (options.tool === "pdf-to-jpg") {
        result = await pdfToJpg(f);
        if (result.success && result.blobs && result.blobs.length > 0) {
          const names = result.filenames ?? result.blobs.map((_, idx) => `page_${idx + 1}.jpg`);
          results[i] = result.blobs.length === 1
            ? { blob: result.blobs[0], filename: names[0] }
            : { blob: await zipFiles(result.blobs, names), filename: f.name.replace(/\.pdf$/i, "_pages.zip") };
          onProgress(i, "done");
          return;
        }
      } else if (options.tool === "watermark") {
        result = await watermarkPDF(f, {
          text: options.text,
          opacity: options.opacity ?? 0.3,
          position: options.position ?? "diagonal",
          fontSize: options.fontSize ?? 60,
          color: options.color ?? "gray",
        });
      } else if (options.tool === "page-numbers") {
        result = await addPageNumbers(f, { position: options.position ?? "bottom-center" });
      } else if (options.tool === "unlock") {
        const { unlockPDF } = await import("@/lib/pdf-unlock");
        result = await unlockPDF(f, options.password ?? "");
      }

      if (result.success && result.blob) {
        results[i] = { blob: result.blob, filename: result.filename ?? f.name, warning: result.warning };
        onProgress(i, "done");
      } else {
        onProgress(i, "error", result.error);
      }
    } catch (e: unknown) {
      onProgress(i, "error", e instanceof Error ? e.message : "Error");
    }
  };

  await new Promise<void>((resolve) => {
    const next = () => {
      while (activeCount < CONCURRENCY && nextIndex < files.length) {
        const i = nextIndex++;
        activeCount++;
        processFile(i).then(() => {
          activeCount--;
          next();
          if (activeCount === 0 && nextIndex >= files.length) resolve();
        });
      }
      if (nextIndex >= files.length && activeCount === 0) resolve();
    };
    next();
  });

  return results;
}

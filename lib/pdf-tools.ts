import { PDFDocument, StandardFonts, degrees, rgb, grayscale } from "pdf-lib";

export interface ToolResult {
  success: boolean;
  blob?: Blob;
  blobs?: Blob[];
  filename?: string;
  filenames?: string[];
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
  return canvas;
}

// ─── Merge ───────────────────────────────────────────────────────────────────

export async function mergePDFs(files: File[]): Promise<ToolResult> {
  try {
    const merged = await PDFDocument.create();
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pageIndices = doc.getPageIndices();
      const copied = await merged.copyPages(doc, pageIndices);
      copied.forEach((p) => merged.addPage(p));
    }
    const saved = await merged.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: "merged.pdf" };
  } catch {
    return { success: false, error: "Failed to merge PDFs. Make sure all files are valid PDFs." };
  }
}

// ─── Split ───────────────────────────────────────────────────────────────────

/** Parse a range string like "1-3,5,7-9" into 0-based page indices */
function parseRanges(rangeStr: string, total: number): number[][] {
  const groups: number[][] = [];
  const parts = rangeStr.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) continue;
    const start = Math.max(1, parseInt(match[1]));
    const end = match[2] ? Math.min(total, parseInt(match[2])) : start;
    const indices: number[] = [];
    for (let i = start; i <= end; i++) indices.push(i - 1); // 0-based
    if (indices.length) groups.push(indices);
  }
  return groups;
}

export async function splitPDF(
  file: File,
  mode: "every-page" | "range",
  rangeStr?: string
): Promise<ToolResult> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = doc.getPageCount();
    const base = baseName(file);

    let groups: number[][];
    if (mode === "every-page") {
      groups = Array.from({ length: total }, (_, i) => [i]);
    } else {
      groups = parseRanges(rangeStr || `1-${total}`, total);
      if (!groups.length) return { success: false, error: "Invalid page range." };
    }

    const blobs: Blob[] = [];
    const filenames: string[] = [];

    for (let g = 0; g < groups.length; g++) {
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(doc, groups[g]);
      copied.forEach((p) => newDoc.addPage(p));
      const saved = await newDoc.save();
      blobs.push(new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" }));
      filenames.push(
        mode === "every-page"
          ? `${base}_page${groups[g][0] + 1}.pdf`
          : `${base}_part${g + 1}.pdf`
      );
    }

    return { success: true, blobs, filenames };
  } catch {
    return { success: false, error: "Failed to split PDF." };
  }
}

// ─── Compress ────────────────────────────────────────────────────────────────

export async function compressPDF(
  file: File,
  quality: "low" | "medium" | "high"
): Promise<ToolResult> {
  try {
    const scaleMap = { low: 0.5, medium: 0.72, high: 0.9 };
    const jpegQualityMap = { low: 0.6, medium: 0.78, high: 0.9 };
    const scale = scaleMap[quality];
    const jpegQ = jpegQualityMap[quality];

    const bytes = await file.arrayBuffer();
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    const numPages = pdfJsDoc.numPages;

    const newPdf = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const canvas = await renderPageToCanvas(pdfJsDoc, pageNum, scale);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", jpegQ);
      const base64 = jpegDataUrl.split(",")[1];
      const jpegBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const jpegImage = await newPdf.embedJpg(jpegBytes);
      const newPage = newPdf.addPage([canvas.width, canvas.height]);
      newPage.drawImage(jpegImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    }

    const saved = await newPdf.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    const filename = `${baseName(file)}_compressed.pdf`;
    return { success: true, blob, filename };
  } catch {
    return { success: false, error: "Failed to compress PDF." };
  }
}

// ─── Rotate ───────────────────────────────────────────────────────────────────

export async function rotatePDF(
  file: File,
  angle: 90 | 180 | 270,
  pageSelection: "all" | number[]
): Promise<ToolResult> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();

    const targets = pageSelection === "all"
      ? pages.map((_, i) => i)
      : (pageSelection as number[]).map((n) => n - 1); // convert 1-based to 0-based

    for (const idx of targets) {
      if (idx >= 0 && idx < pages.length) {
        const current = pages[idx].getRotation().angle;
        pages[idx].setRotation(degrees((current + angle) % 360));
      }
    }

    const saved = await doc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_rotated.pdf` };
  } catch {
    return { success: false, error: "Failed to rotate PDF." };
  }
}

// ─── PDF to JPG ───────────────────────────────────────────────────────────────

export async function pdfToJpg(file: File, dpi: number = 150): Promise<ToolResult> {
  try {
    const scale = dpi / 72; // PDF default is 72 DPI
    const bytes = await file.arrayBuffer();
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    const numPages = pdfJsDoc.numPages;
    const base = baseName(file);

    const blobs: Blob[] = [];
    const filenames: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const canvas = await renderPageToCanvas(pdfJsDoc, pageNum, scale);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = jpegDataUrl.split(",")[1];
      const jpegBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      blobs.push(new Blob([jpegBytes], { type: "image/jpeg" }));
      filenames.push(numPages === 1 ? `${base}.jpg` : `${base}_page${pageNum}.jpg`);
    }

    return { success: true, blobs, filenames };
  } catch {
    return { success: false, error: "Failed to convert PDF to images." };
  }
}

// ─── JPG to PDF ───────────────────────────────────────────────────────────────

export async function jpgToPdf(images: File[]): Promise<ToolResult> {
  try {
    const doc = await PDFDocument.create();

    for (const img of images) {
      const bytes = await img.arrayBuffer();
      const uint8 = new Uint8Array(bytes);
      const isJpeg = img.type === "image/jpeg" || img.name.toLowerCase().match(/\.(jpg|jpeg)$/);
      const isPng = img.type === "image/png" || img.name.toLowerCase().endsWith(".png");

      let embedded;
      if (isJpeg) {
        embedded = await doc.embedJpg(uint8);
      } else if (isPng) {
        embedded = await doc.embedPng(uint8);
      } else {
        // Convert to PNG via canvas
        const blob = new Blob([bytes], { type: img.type });
        const bmpUrl = URL.createObjectURL(blob);
        const image = new Image();
        await new Promise((res, rej) => { image.onload = res; image.onerror = rej; image.src = bmpUrl; });
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d")!.drawImage(image, 0, 0);
        URL.revokeObjectURL(bmpUrl);
        const pngDataUrl = canvas.toDataURL("image/png");
        const pngBase64 = pngDataUrl.split(",")[1];
        const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
        embedded = await doc.embedPng(pngBytes);
      }

      const { width, height } = embedded;
      const page = doc.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    }

    const saved = await doc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: "images.pdf" };
  } catch {
    return { success: false, error: "Failed to convert images to PDF." };
  }
}

// ─── Watermark ────────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  text: string;
  opacity?: number;    // 0–1
  rotation?: number;  // degrees
  fontSize?: number;
  color?: "gray" | "red" | "blue";
  position?: "center" | "diagonal";
}

export async function watermarkPDF(file: File, opts: WatermarkOptions): Promise<ToolResult> {
  try {
    const {
      text,
      opacity = 0.3,
      rotation = 45,
      fontSize = 60,
      color = "gray",
      position = "diagonal",
    } = opts;

    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();

    const colorMap = {
      gray: grayscale(0.5),
      red: rgb(0.8, 0.1, 0.1),
      blue: rgb(0.1, 0.1, 0.8),
    };
    const fillColor = colorMap[color];

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const x = position === "diagonal" ? (width - textWidth * Math.cos((rotation * Math.PI) / 180)) / 2 : (width - textWidth) / 2;
      const y = position === "diagonal" ? height / 2 : height / 2;

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: fillColor,
        opacity,
        rotate: degrees(rotation),
      });
    }

    const saved = await doc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_watermarked.pdf` };
  } catch {
    return { success: false, error: "Failed to add watermark." };
  }
}

// ─── Organize ─────────────────────────────────────────────────────────────────

export async function organizePDF(file: File, newOrder: number[]): Promise<ToolResult> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(doc, newOrder); // newOrder is 0-based
    copied.forEach((p) => newDoc.addPage(p));

    const saved = await newDoc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_organized.pdf` };
  } catch {
    return { success: false, error: "Failed to organize PDF." };
  }
}

/** Render all pages of a PDF as thumbnail data URLs (for Organize UI) */
export async function renderThumbnails(file: File, scale = 0.3): Promise<string[]> {
  const bytes = await file.arrayBuffer();
  const pdfjsLib = await getPdfjsLib();
  const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const thumbs: string[] = [];
  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const canvas = await renderPageToCanvas(pdfJsDoc, i, scale);
    thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
  }
  return thumbs;
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
    const {
      position = "bottom-center",
      startFrom = 1,
      fontSize = 12,
      format = "1",
    } = opts;

    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;
    const margin = 20;

    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const num = i + startFrom;
      const label =
        format === "1" ? `${num}` :
        format === "Page 1" ? `Page ${num}` :
        `${num} / ${total + startFrom - 1}`;
      const textWidth = font.widthOfTextAtSize(label, fontSize);

      let x: number;
      let y: number;

      if (position === "bottom-center") { x = (width - textWidth) / 2; y = margin; }
      else if (position === "bottom-right") { x = width - textWidth - margin; y = margin; }
      else if (position === "bottom-left") { x = margin; y = margin; }
      else { x = (width - textWidth) / 2; y = height - margin - fontSize; }

      page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
    });

    const saved = await doc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_numbered.pdf` };
  } catch {
    return { success: false, error: "Failed to add page numbers." };
  }
}

// ─── Sign (embed signature image onto PDF) ────────────────────────────────────

export interface SignOptions {
  signatureDataUrl: string; // PNG data URL of signature
  page?: number;            // 1-based, default last page
  x?: number;               // normalized 0–1
  y?: number;               // normalized 0–1
  widthRatio?: number;      // fraction of page width, default 0.3
}

export async function signPDF(file: File, opts: SignOptions): Promise<ToolResult> {
  try {
    const { signatureDataUrl, page, x = 0.5, y = 0.1, widthRatio = 0.3 } = opts;

    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();
    const targetPage = pages[(page ? page - 1 : pages.length - 1)];
    const { width, height } = targetPage.getSize();

    // Decode signature PNG
    const base64 = signatureDataUrl.split(",")[1];
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const sigImage = await doc.embedPng(pngBytes);

    const sigWidth = width * widthRatio;
    const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
    const sigX = x * (width - sigWidth);
    const sigY = y * height;

    targetPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigWidth, height: sigHeight });

    const saved = await doc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_signed.pdf` };
  } catch {
    return { success: false, error: "Failed to add signature." };
  }
}

// ─── Delete Pages ─────────────────────────────────────────────────────────────

export async function deletePages(file: File, pagesToDelete: number[]): Promise<ToolResult> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = doc.getPageCount();

    // Build 0-based keep indices (all pages NOT in pagesToDelete)
    const deleteSet = new Set(pagesToDelete.map((p) => p - 1)); // convert to 0-based
    const keepIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !deleteSet.has(i));

    if (keepIndices.length === 0) {
      return { success: false, error: "Cannot delete all pages from the document." };
    }

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(doc, keepIndices);
    copied.forEach((p) => newDoc.addPage(p));

    const saved = await newDoc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_edited.pdf` };
  } catch {
    return { success: false, error: "Failed to delete pages." };
  }
}

// ─── PDF to PNG ───────────────────────────────────────────────────────────────

export async function pdfToPng(file: File, dpi: number = 150): Promise<ToolResult> {
  try {
    const scale = dpi / 72; // PDF default is 72 DPI
    const bytes = await file.arrayBuffer();
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    const numPages = pdfJsDoc.numPages;
    const base = baseName(file);

    const blobs: Blob[] = [];
    const filenames: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const canvas = await renderPageToCanvas(pdfJsDoc, pageNum, scale);
      const pngDataUrl = canvas.toDataURL("image/png");
      const base64 = pngDataUrl.split(",")[1];
      const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      blobs.push(new Blob([pngBytes], { type: "image/png" }));
      filenames.push(numPages === 1 ? `${base}.png` : `${base}_page${pageNum}.png`);
    }

    return { success: true, blobs, filenames };
  } catch {
    return { success: false, error: "Failed to convert PDF to PNG images." };
  }
}

// ─── Repair PDF ───────────────────────────────────────────────────────────────

export async function repairPDF(file: File): Promise<ToolResult> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const saved = await doc.save();
    const blob = new Blob([saved as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    return { success: true, blob, filename: `${baseName(file)}_repaired.pdf` };
  } catch {
    return { success: false, error: "Failed to repair PDF. The file may be too corrupted to recover." };
  }
}

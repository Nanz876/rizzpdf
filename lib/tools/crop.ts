import { PDFDocument, PDFPage } from "pdf-lib";
import { loadPdf, saveToBlob, toolErrorMessage, displayedPage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

function baseName(file: File) {
  return file.name.replace(/\.pdf$/i, "");
}

export interface CropMargins {
  /** Fraction (0–0.45) of the DISPLAYED page removed from each edge, as the reader sees it. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropOptions {
  margins: CropMargins;
  /** 1-based page numbers, or "all". */
  pages: "all" | number[];
  /**
   * When true, cropped-away content is permanently discarded by re-rendering the
   * targeted pages as images at 200 DPI. Off by default: normally the crop box only
   * hides content outside it — the hidden pixels are still inside the file — so
   * this is the only way to truly remove them. The trade-off is that text on those
   * pages is no longer selectable/searchable afterwards.
   */
  permanent?: boolean;
}

const MARGIN_ERROR =
  "These margins leave less than 5% of the page width or height — pick smaller margins.";

/** Load pdf.js with the app's worker, matching the convention used across lib/pdf-tools.ts. */
async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

/**
 * Set a page's CropBox from margins expressed as fractions of the DISPLAYED page
 * (i.e. after /Rotate is applied, as the reader sees it). We compute the new
 * displayed rectangle's four corners in "reader" coordinates, map each through
 * `displayedPage().toUser` (which already accounts for /Rotate), then take the
 * min/max in user space — this stays correct for any of the four rotations
 * without needing per-rotation special-casing.
 */
function newCropBoxFor(page: PDFPage, margins: CropMargins) {
  const view = displayedPage(page);
  const dxMin = margins.left * view.width;
  const dxMax = view.width - margins.right * view.width;
  const dyMin = margins.bottom * view.height;
  const dyMax = view.height - margins.top * view.height;

  const corners = [
    view.toUser(dxMin, dyMin),
    view.toUser(dxMin, dyMax),
    view.toUser(dxMax, dyMin),
    view.toUser(dxMax, dyMax),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export async function cropPDF(file: File, opts: CropOptions): Promise<ToolResult> {
  try {
    const { margins, pages, permanent } = opts;
    if (1 - margins.left - margins.right < 0.05 || 1 - margins.top - margins.bottom < 0.05) {
      return { success: false, error: MARGIN_ERROR };
    }

    const doc = await loadPdf(file);
    const allPages = doc.getPages();
    const targets =
      pages === "all"
        ? allPages.map((_, i) => i)
        : [...new Set(pages.map((n) => n - 1))].filter((i) => i >= 0 && i < allPages.length);

    for (const idx of targets) {
      const page = allPages[idx];
      const box = newCropBoxFor(page, margins);
      // TrimBox/ArtBox/BleedBox mirror the CropBox so printers and other tooling
      // also respect the crop, not just on-screen viewers.
      page.setCropBox(box.x, box.y, box.width, box.height);
      page.setTrimBox(box.x, box.y, box.width, box.height);
      page.setArtBox(box.x, box.y, box.width, box.height);
      page.setBleedBox(box.x, box.y, box.width, box.height);
    }

    if (!permanent) {
      return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_cropped.pdf` };
    }

    // Permanent removal: re-render each targeted page (now cropped) as an image at
    // 200 DPI and swap it in. This genuinely discards the hidden content, at the
    // cost of making text non-selectable on those pages.
    const intermediateBytes = await doc.save({ useObjectStreams: true });
    const pdfjsLib = await getPdfjsLib();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: intermediateBytes }).promise;
    const outDoc = await PDFDocument.create();
    const targetSet = new Set(targets);

    for (let i = 0; i < allPages.length; i++) {
      if (!targetSet.has(i)) {
        const [copied] = await outDoc.copyPages(doc, [i]);
        outDoc.addPage(copied);
        continue;
      }
      const pjsPage = await pdfJsDoc.getPage(i + 1);
      const scale = 200 / 72;
      const viewport = pjsPage.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext("2d")!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await pjsPage.render({ canvasContext: ctx as any, viewport, canvas }).promise;
      const jpegBlob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))), "image/jpeg", 0.92)
      );
      const jpgBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      canvas.width = 0;
      canvas.height = 0;

      const view = displayedPage(allPages[i]);
      const img = await outDoc.embedJpg(jpgBytes);
      const newPage = outDoc.addPage([view.width, view.height]);
      newPage.drawImage(img, { x: 0, y: 0, width: view.width, height: view.height });
    }

    return {
      success: true,
      blob: await saveToBlob(outDoc),
      filename: `${baseName(file)}_cropped.pdf`,
      warning: "Hidden content was permanently removed — text on the affected pages is no longer selectable.",
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to crop PDF.") };
  }
}

/**
 * Render page 1 at a low scale and find the non-white content bounding box, to
 * suggest starting margins. Browser-only (uses canvas). Returns fractions of the
 * displayed page, with a small 1% padding so content isn't cut flush.
 */
export async function autoCropMargins(file: File): Promise<CropMargins> {
  const pdfjsLib = await getPdfjsLib();
  const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdfJsDoc.getPage(1);
  const scale = 0.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.floor(viewport.width));
  const height = Math.max(1, Math.floor(viewport.height));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
  const { data } = ctx.getImageData(0, 0, width, height);

  const tolerance = 245; // treat near-white pixels as background
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] < tolerance || data[i + 1] < tolerance || data[i + 2] < tolerance) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  canvas.width = 0;
  canvas.height = 0;

  if (maxX < 0) return { top: 0, right: 0, bottom: 0, left: 0 }; // blank page — nothing to crop

  const pad = 0.01;
  return {
    left: Math.max(0, minX / width - pad),
    right: Math.max(0, (width - 1 - maxX) / width - pad),
    top: Math.max(0, minY / height - pad), // canvas y=0 is the top, matching "top" as displayed
    bottom: Math.max(0, (height - 1 - maxY) / height - pad),
  };
}

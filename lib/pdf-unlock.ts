import { PDFDocument } from "pdf-lib";

export interface UnlockResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
}

export async function unlockPDF(file: File, password: string): Promise<UnlockResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // First try: pdf-lib with ignoreEncryption.
    // Works for permission-locked PDFs (no open password). Preserves text,
    // links, form fields, annotations, and all vector content.
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const saved = await doc.save();
      const blob = new Blob([saved.buffer as ArrayBuffer], { type: "application/pdf" });
      return { success: true, blob, filename: file.name.replace(/\.pdf$/i, "_unlocked.pdf") };
    } catch {
      // Falls through to rasterizing approach for strongly encrypted PDFs
    }

    // Fallback: use PDF.js to decrypt with the password, then re-render each page.
    // This is lossy (rasterizes to images) but handles open-password encryption
    // that pdf-lib cannot strip.
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString();

    let pdfJsDoc: import("pdfjs-dist").PDFDocumentProxy;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: bytes, password });
      pdfJsDoc = await loadingTask.promise;
    } catch {
      return { success: false, error: "Incorrect password or unable to unlock this PDF." };
    }

    const numPages = pdfJsDoc.numPages;
    const newPdf = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;

      const pngDataUrl = canvas.toDataURL("image/png");
      const base64 = pngDataUrl.split(",")[1];
      const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const pngImage = await newPdf.embedPng(pngBytes);
      // Use full viewport dimensions — do not halve, which would shrink the output
      const newPage = newPdf.addPage([viewport.width, viewport.height]);
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    const unlockedBytes = await newPdf.save();
    const blob = new Blob([unlockedBytes as unknown as BlobPart], { type: "application/pdf" });
    return { success: true, blob, filename: file.name.replace(/\.pdf$/i, "_unlocked.pdf") };
  } catch {
    return { success: false, error: "Failed to process this file. Make sure it's a valid PDF." };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

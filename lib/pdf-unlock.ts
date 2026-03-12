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

    // Dynamically import pdfjs-dist (browser-only — avoids SSR DOMMatrix errors)
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString();

    // Load & decrypt with PDF.js
    let pdfJsDoc: import("pdfjs-dist").PDFDocumentProxy;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        password,
      });
      pdfJsDoc = await loadingTask.promise;
    } catch {
      return { success: false, error: "Incorrect password or unable to unlock this PDF." };
    }

    const numPages = pdfJsDoc.numPages;

    // Render each page to canvas and embed as image in a new pdf-lib PDF
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
      const newPage = newPdf.addPage([viewport.width / 2, viewport.height / 2]);
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: viewport.width / 2,
        height: viewport.height / 2,
      });
    }

    const unlockedBytes = await newPdf.save();
    const blob = new Blob([unlockedBytes as unknown as BlobPart], { type: "application/pdf" });
    const filename = file.name.replace(/\.pdf$/i, "_unlocked.pdf");
    return { success: true, blob, filename };
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

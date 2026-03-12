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

    // Try to load with password
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(arrayBuffer, {
        password,
        ignoreEncryption: false,
      });
    } catch {
      return { success: false, error: "Incorrect password or unable to unlock this PDF." };
    }

    // Save without encryption
    const unlockedBytes = await pdfDoc.save();
    const blob = new Blob([unlockedBytes], { type: "application/pdf" });

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

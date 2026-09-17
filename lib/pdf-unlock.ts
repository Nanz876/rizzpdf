import { PDFDocument } from "pdf-lib";
import { recordOutput } from "@/lib/handoff";

export interface UnlockResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
  warning?: string;
}

const unlockedName = (file: File) => file.name.replace(/\.pdf$/i, "_unlocked.pdf");

/**
 * Remove a PDF's open password and/or permission restrictions.
 *
 * RC4 (V1/V2), AES-128 (V4 crypt-filter) and AES-256 (V5) files are all
 * decrypted losslessly: text, links, forms and image quality are untouched.
 * Other encryption types (e.g. public-key security handlers) fall back to
 * rendering each page, which loses selectable text.
 */
export async function unlockPDF(file: File, password: string): Promise<UnlockResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  let encrypted: boolean;
  try {
    encrypted = (await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })).isEncrypted;
  } catch {
    return { success: false, error: "This file couldn't be opened. Make sure it's a valid PDF." };
  }

  if (!encrypted) {
    return {
      success: true,
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
      filename: unlockedName(file),
      warning: "This PDF wasn't locked, so it was saved unchanged.",
    };
  }

  try {
    // Decrypt directly. Don't route this through lib/worker/run: the worker bundle
    // reaches this file (via batchProcess), and a worker that imports the code
    // that spawns the worker makes the Turbopack build recurse forever.
    const { decryptPdf } = await import("@/lib/pdf-decrypt");
    const decrypted = await decryptPdf(bytes, password);
    return {
      success: true,
      blob: new Blob([decrypted as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
      filename: unlockedName(file),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/incorrect password/i.test(msg)) {
      return {
        success: false,
        error: password
          ? "Wrong password — double-check and try again."
          : "This PDF needs its open password. Enter it and try again.",
      };
    }
    if (!/unsupported encryption/i.test(msg)) {
      return { success: false, error: "This file couldn't be unlocked. It may be damaged." };
    }
  }

  return renderUnlock(file, bytes, password);
}

/** Fallback for encryption types the lossless decrypter doesn't support. */
async function renderUnlock(file: File, bytes: Uint8Array, password: string): Promise<UnlockResult> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    let pdfJsDoc: import("pdfjs-dist").PDFDocumentProxy;
    try {
      pdfJsDoc = await pdfjsLib.getDocument({ data: bytes.slice(), password }).promise;
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === "PasswordException") {
        return {
          success: false,
          error: password ? "Wrong password — double-check and try again." : "This PDF needs its open password. Enter it and try again.",
        };
      }
      return { success: false, error: "This file couldn't be unlocked. It may be damaged." };
    }

    const newPdf = await PDFDocument.create();
    for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
      const page = await pdfJsDoc.getPage(pageNum);
      const { width, height } = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: canvas.getContext("2d")! as any, viewport, canvas }).promise;
      const png = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png"));
      canvas.width = 0;
      canvas.height = 0;
      const image = await newPdf.embedPng(new Uint8Array(await png.arrayBuffer()));
      newPdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    }

    const out = await newPdf.save();
    return {
      success: true,
      blob: new Blob([out as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
      filename: unlockedName(file),
      warning: "This PDF uses an encryption type that required full rendering to unlock — text is no longer selectable in the output.",
    };
  } catch {
    return { success: false, error: "Failed to process this file. Make sure it's a valid PDF." };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  recordOutput(blob, filename); // lets the user continue in another tool
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

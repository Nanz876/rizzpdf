import { PDFDocument, PDFPage } from "pdf-lib";

export const PASSWORD_REQUIRED_MESSAGE =
  "This PDF is password-protected. Unlock it first with the Unlock PDF tool, then try again.";

export class PdfPasswordError extends Error {
  constructor() {
    super(PASSWORD_REQUIRED_MESSAGE);
    this.name = "PdfPasswordError";
  }
}

async function toBytes(input: File | Blob | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
}

/**
 * Load a PDF for editing with pdf-lib.
 *
 * pdf-lib cannot decrypt, and `ignoreEncryption` only skips the check, so editing
 * an encrypted file silently produces garbled pages. Instead:
 * - Restriction-only files (no open password) are decrypted losslessly first (lib/pdf-decrypt.ts, which escapes decrypted strings correctly).
 * - Files that need an open password throw PdfPasswordError with a clear message.
 *
 * Metadata (title, author, producer) is left untouched.
 */
export async function loadPdf(input: File | Blob | Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  const bytes = await toBytes(input);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  if (!doc.isEncrypted) return doc;

  const { decryptPdf } = await import("@/lib/pdf-decrypt");
  let decrypted: Uint8Array;
  try {
    decrypted = await decryptPdf(bytes, "");
  } catch (e) {
    // Needs an open password, or uses a security handler we can't open for editing:
    // either way the Unlock tool is the right next step.
    if (/password|unsupported encryption/i.test(e instanceof Error ? e.message : String(e))) throw new PdfPasswordError();
    throw e;
  }
  return PDFDocument.load(decrypted, { updateMetadata: false });
}

/** Map any thrown error to a user-facing message, keeping password guidance specific. */
export function toolErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof PdfPasswordError) return e.message;
  const name = (e as { name?: string })?.name;
  if (name === "PasswordException") return PASSWORD_REQUIRED_MESSAGE; // thrown by PDF.js
  return fallback;
}

/** Save a pdf-lib document to a PDF Blob. */
export async function saveToBlob(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save({ useObjectStreams: true });
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}

function normalizedRotation(page: PDFPage): 0 | 90 | 180 | 270 {
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  return (Math.round(r / 90) * 90) % 360 as 0 | 90 | 180 | 270;
}

/**
 * Geometry of the page as the reader sees it: the crop box, after the page's own
 * /Rotate is applied. Use `toUser` to turn a point measured from the displayed
 * bottom-left corner into pdf-lib user-space coordinates plus the rotation that
 * makes text/images appear upright.
 */
export function displayedPage(page: PDFPage) {
  const crop = page.getCropBox();
  const rotation = normalizedRotation(page);
  const x0 = crop.x;
  const y0 = crop.y;
  const x1 = crop.x + crop.width;
  const y1 = crop.y + crop.height;
  const sideways = rotation === 90 || rotation === 270;
  const width = sideways ? crop.height : crop.width;
  const height = sideways ? crop.width : crop.height;

  function toUser(dx: number, dy: number): { x: number; y: number } {
    switch (rotation) {
      case 90:
        return { x: x1 - dy, y: y0 + dx };
      case 180:
        return { x: x1 - dx, y: y1 - dy };
      case 270:
        return { x: x0 + dy, y: y1 - dx };
      default:
        return { x: x0 + dx, y: y0 + dy };
    }
  }

  return { width, height, rotation, toUser };
}

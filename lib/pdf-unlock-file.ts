// Shared "unlock on intake" helper. Any tool that accepts a PDF runs its files
// through this before processing, so a password-protected file is decrypted once,
// up front, on the main thread — and every downstream tool (including the ones
// that run in the Web Worker, which can't show a prompt) receives a plain,
// already-unlocked file. This replaces the old dead-end where each tool errored
// with "unlock it first, then come back".
//
// - Not encrypted → returned unchanged.
// - Restriction-only (owner password, empty user password) → decrypted silently,
//   no prompt (this is lossless and needs no secret).
// - Open password required → `requestPassword` is called, retrying on a wrong
//   password, until it succeeds or the user cancels (returns null).
// - Anything we can't decrypt (unsupported handler, not a PDF) → returned
//   unchanged so the tool surfaces its own error as before.
import { PDFDocument } from "pdf-lib";
import { decryptPdf, WrongPasswordError } from "@/lib/pdf-decrypt";

/** Asked for a password for `filename`; `wrongPassword` is true after a failed attempt. Resolve null to cancel. */
export type RequestPassword = (filename: string, wrongPassword: boolean) => Promise<string | null>;

function toFile(bytes: Uint8Array, name: string): File {
  return new File([bytes as Uint8Array<ArrayBuffer>], name, { type: "application/pdf" });
}

async function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.isEncrypted;
  } catch {
    // Not a parseable PDF — let the tool handle it.
    return false;
  }
}

/**
 * Return an unlocked copy of `file`, prompting for a password if one is needed.
 * Returns the original file when nothing needs doing, or `null` if the user
 * cancels the prompt. Never throws for ordinary "can't decrypt" cases.
 */
export async function unlockFileIfNeeded(file: File, requestPassword: RequestPassword): Promise<File | null> {
  // Only PDFs can be encrypted here.
  if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return file;

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(await isEncrypted(bytes))) return file;

  // Restriction-only files decrypt with an empty password, no prompt needed.
  try {
    return toFile(await decryptPdf(bytes, ""), file.name);
  } catch (e) {
    if (!(e instanceof WrongPasswordError)) {
      // Unsupported encryption or some other failure — hand back the original.
      return file;
    }
  }

  // An open password is required: prompt, retrying until correct or cancelled.
  let wrong = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const password = await requestPassword(file.name, wrong);
    if (password === null) return null; // cancelled
    try {
      return toFile(await decryptPdf(bytes, password), file.name);
    } catch (e) {
      if (e instanceof WrongPasswordError) {
        wrong = true;
        continue;
      }
      return file; // give up gracefully on unexpected errors
    }
  }
}

"use client";

/**
 * Tool chaining: remember the last PDF a tool produced so the user can open it in
 * another tool without downloading and re-uploading. Everything stays in memory
 * in this tab; nothing is uploaded or persisted.
 */

export interface ToolOutput {
  file: File;
  /** Path of the tool page that produced it, so other pages don't show it. */
  fromPath: string;
}

let lastOutput: ToolOutput | null = null;
let pendingInput: File | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Called whenever a tool downloads a result. Only PDFs can be chained. */
export function recordOutput(blob: Blob, filename: string) {
  if (typeof window === "undefined") return;
  if (blob.type !== "application/pdf" && !/\.pdf$/i.test(filename)) return;
  lastOutput = {
    file: new File([blob], filename, { type: "application/pdf" }),
    fromPath: window.location.pathname,
  };
  notify();
}

export function getLastOutput(): ToolOutput | null {
  return lastOutput;
}

export function clearLastOutput() {
  lastOutput = null;
  notify();
}

export function subscribeOutput(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Queue the last output to be loaded by the next tool page's upload zone. */
export function handOffLastOutput(): boolean {
  if (!lastOutput) return false;
  pendingInput = lastOutput.file;
  lastOutput = null;
  notify();
  return true;
}

/** Take (and clear) a file handed off from the previous tool, if any. */
export function takeHandedOffFile(): File | null {
  const f = pendingInput;
  pendingInput = null;
  return f;
}

// A module Web Worker that runs the pdf-lib-only tool functions off the main
// thread, so large files don't freeze the tab. Dispatched by lib/worker/run.ts.
//
// IMPORTANT: this file (and everything it imports) must never touch the DOM —
// no `document`, `canvas`, or `window`. Only pdf-lib operations that work on raw
// bytes belong here. Canvas/pdf.js rendering (compress, PDF-to-image, crop's
// "permanent" mode, etc.) must stay on the main thread and is not registered
// below. See CLAUDE.md's "Web Worker" rule.
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  rotatePages,
  organizePDF,
  deletePages,
  addPageNumbers,
  watermarkPDF,
  signPDFMulti,
  protectPDF,
} from "@/lib/pdf-tools";
import { cropPDF } from "@/lib/tools/crop";
import { flattenPDF } from "@/lib/tools/flatten";
import { fillForm } from "@/lib/tools/fill-form";
import { decryptPdf } from "@/lib/pdf-decrypt";
import type { WorkerFnName, WorkerRequest, WorkerResponse } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FUNCTIONS: Record<WorkerFnName, (...args: any[]) => Promise<unknown>> = {
  mergePDFs,
  splitPDF,
  rotatePDF,
  rotatePages,
  organizePDF,
  deletePages,
  addPageNumbers,
  watermarkPDF,
  signPDFMulti,
  protectPDF,
  decryptPdf,
  cropPDF,
  flattenPDF,
  fillForm,
};

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const { id, fn, args } = event.data;
  try {
    const handler = FUNCTIONS[fn];
    if (!handler) throw new Error(`Unknown worker function: ${fn}`);
    const result = await handler(...args);
    const response: WorkerResponse = { id, ok: true, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(response);
  }
});

export {};

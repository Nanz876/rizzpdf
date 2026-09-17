// Shared message shapes between lib/worker/run.ts (main thread) and
// lib/worker/pdf-worker.ts (the worker). Keep in sync with the FUNCTIONS map in
// pdf-worker.ts and the DIRECT map in run.ts — every name here must exist in both.
export type WorkerFnName =
  | "mergePDFs"
  | "splitPDF"
  | "rotatePDF"
  | "rotatePages"
  | "organizePDF"
  | "deletePages"
  | "addPageNumbers"
  | "watermarkPDF"
  | "signPDFMulti"
  | "protectPDF"
  | "decryptPdf"
  | "cropPDF"
  | "flattenPDF"
  | "fillForm";

export interface WorkerRequest {
  id: number;
  fn: WorkerFnName;
  args: unknown[];
}

export interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

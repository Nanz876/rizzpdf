// Dispatches pdf-lib-only tool calls to a shared Web Worker (lib/worker/pdf-worker.ts)
// so large files don't freeze the tab, with a same-thread fallback when workers
// aren't available or fail. See CLAUDE.md's "Web Worker" rule before adding a
// function here — it must also be registered in pdf-worker.ts's FUNCTIONS map.
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

// The same functions the worker runs, for the main-thread fallback path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DIRECT: Record<WorkerFnName, (...args: any[]) => Promise<unknown>> = {
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

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

let warned = false;
function warnOnce(message: string, err?: unknown) {
  if (warned) return;
  warned = true;
  console.warn(message, err);
}

function rejectAllPending(reason: unknown) {
  for (const [id, p] of pending) {
    p.reject(reason);
    pending.delete(id);
  }
}

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;
  if (typeof Worker === "undefined") {
    workerFailed = true;
    return null;
  }
  try {
    const w = new Worker(new URL("./pdf-worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, ok, result, error } = event.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error ?? "Worker error"));
    };
    w.onerror = (event: ErrorEvent) => {
      warnOnce("[rizzpdf] PDF worker crashed; falling back to running on the main thread.", event);
      workerFailed = true;
      worker = null;
      rejectAllPending(new Error("Worker crashed"));
    };
    worker = w;
    return worker;
  } catch (e) {
    warnOnce("[rizzpdf] Couldn't start the PDF worker; running on the main thread instead.", e);
    workerFailed = true;
    return null;
  }
}

/**
 * Run a pdf-lib tool function off the main thread when possible, so large files
 * don't freeze the tab. Falls back to calling the function directly on the main
 * thread if Web Workers aren't available, construction throws, or the worker
 * call itself errors (logged once via console.warn).
 */
export async function runInWorker<T>(fn: WorkerFnName, ...args: unknown[]): Promise<T> {
  const w = getWorker();
  if (!w) {
    return DIRECT[fn](...args) as Promise<T>;
  }

  const id = nextId++;
  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const request: WorkerRequest = { id, fn, args };
      w.postMessage(request);
    });
    return result as T;
  } catch (e) {
    warnOnce("[rizzpdf] PDF worker call failed; falling back to running on the main thread.", e);
    return DIRECT[fn](...args) as Promise<T>;
  }
}

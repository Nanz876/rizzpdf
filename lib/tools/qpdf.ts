// qpdf (Apache-2.0) compiled to WebAssembly, wrapped by @neslinesli93/qpdf-wasm
// (ISC). qpdf is the standard tool for *structural* PDF optimisation — object
// streams, stream (flate) recompression, and linearisation — which pdf-lib
// can't do. We use it to squeeze the PDF structure after our canvas pass has
// already handled images, and to power Linearize ("Fast Web View").
//
// Runs entirely in the browser (the .wasm ships from our own origin at
// /qpdf/qpdf.wasm — no CDN, no uploads). It touches WASM and, in its unused
// Node branch, `fs`; it is therefore dynamically imported and only ever called
// on the main thread, never the pdf-lib worker. Every entry point here is a
// progressive enhancement: callers must treat a throw as "qpdf unavailable"
// and fall back to the non-qpdf result.

// The package ships its own `declare module` types (dist/qpdf.d.ts). We use the
// type only — the actual code is loaded from /public at runtime (see loadQpdfFactory).
import type { QpdfInstance } from "@neslinesli93/qpdf-wasm";

type QpdfFactory = (opts: { locateFile: () => string }) => Promise<QpdfInstance>;

// Assets served from our own origin (/public). No CDN, no uploads.
const QPDF_JS_URL = "/qpdf/qpdf.js";
const QPDF_WASM_URL = "/qpdf/qpdf.wasm";

let factoryPromise: Promise<QpdfFactory> | null = null;

/**
 * Load the qpdf Emscripten factory as a classic script from /public, rather than
 * through the bundler. The script is a UMD CommonJS module whose unused Node
 * branch references `fs` — bundling it fails ("Can't resolve 'fs'"), and that
 * branch never runs in a browser anyway. We give it a one-shot `module`/`exports`
 * shim so the UMD assigns its factory, then capture it. Cached after first load.
 */
function loadQpdfFactory(): Promise<QpdfFactory> {
  if (factoryPromise) return factoryPromise;
  factoryPromise = new Promise<QpdfFactory>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const prevModule = w.module;
    const prevExports = w.exports;
    const shim = { exports: {} as Record<string, unknown> };
    w.module = shim;
    w.exports = shim.exports;
    const restore = () => {
      w.module = prevModule;
      w.exports = prevExports;
    };
    const script = document.createElement("script");
    script.src = QPDF_JS_URL;
    script.onload = () => {
      const exported = (shim.exports.default ?? shim.exports) as QpdfFactory | undefined;
      restore();
      if (typeof exported === "function") resolve(exported);
      else reject(new Error("qpdf failed to load"));
    };
    script.onerror = () => {
      restore();
      reject(new Error("qpdf script could not be fetched"));
    };
    document.head.appendChild(script);
  }).catch((e) => {
    factoryPromise = null; // allow a later retry
    throw e;
  });
  return factoryPromise;
}

/**
 * Run qpdf once: `qpdf [args] <input> <output>`, returning the output bytes.
 * A fresh module instance is created per call so there's no Emscripten FS state
 * to leak between runs. Throws on a non-zero qpdf exit or any load failure.
 */
export async function qpdfRun(input: Uint8Array, args: string[]): Promise<Uint8Array> {
  if (typeof window === "undefined") throw new Error("qpdf runs in the browser only");
  const factory = await loadQpdfFactory();
  const instance: QpdfInstance = await factory({ locateFile: () => QPDF_WASM_URL });

  // Write the input into the in-memory FS (MEMFS). We deliberately don't use
  // WORKERFS — it relies on FileReaderSync, which only exists inside a Web
  // Worker, and compress runs on the main thread.
  const fs = instance.FS as unknown as {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  fs.writeFile("/input.pdf", input);
  try {
    const code = instance.callMain([...args, "/input.pdf", "/output.pdf"]);
    if (code !== 0) throw new Error(`qpdf exited with code ${code}`);
    return fs.readFile("/output.pdf");
  } finally {
    try {
      fs.unlink("/input.pdf");
      fs.unlink("/output.pdf");
    } catch {
      // Best-effort cleanup; the instance is discarded anyway.
    }
  }
}

// Long-standing qpdf flags (present for many major versions), so an older wasm
// build won't reject them. Image recompression is intentionally left to our
// canvas pass; here we only optimise structure.
const STRUCTURE_ARGS = [
  "--object-streams=generate",
  "--compress-streams=y",
  "--recompress-flate",
  "--compression-level=9",
];

/**
 * Structurally optimise a PDF (object streams + flate recompression). Returns
 * the smaller of qpdf's output and the input, or the input unchanged if qpdf
 * isn't available. Never throws.
 */
export async function structurallyCompress(input: Uint8Array): Promise<Uint8Array> {
  try {
    const out = await qpdfRun(input, STRUCTURE_ARGS);
    return out.length > 0 && out.length < input.length ? out : input;
  } catch {
    return input;
  }
}

/** Linearise a PDF for "Fast Web View" (byte-range streaming). Throws if qpdf is unavailable. */
export async function linearize(input: Uint8Array): Promise<Uint8Array> {
  return qpdfRun(input, ["--linearize"]);
}

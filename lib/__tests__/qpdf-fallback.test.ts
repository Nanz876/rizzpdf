// @vitest-environment node
// qpdf is browser-only (WASM). In Node it can't run, so every qpdf entry point
// must degrade safely — this pins that contract so the tools never regress when
// qpdf is unavailable. The real in-browser behaviour is verified separately with
// Playwright against test-fixtures.
import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { structurallyCompress, repairWithQpdf, linearize } from "@/lib/tools/qpdf";
import { linearizePDF } from "@/lib/pdf-tools";

const FIX = path.resolve(__dirname, "../../test-fixtures");
async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

describe("qpdf fallbacks when the engine can't run (Node)", () => {
  it("structurallyCompress returns the input unchanged, never throwing", async () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    await expect(structurallyCompress(input)).resolves.toBe(input);
  });

  it("repairWithQpdf resolves to null rather than throwing", async () => {
    await expect(repairWithQpdf(new Uint8Array([1, 2, 3]))).resolves.toBeNull();
  });

  it("linearize throws (callers must catch and fall back)", async () => {
    await expect(linearize(new Uint8Array([1, 2, 3]))).rejects.toThrow(/browser only/i);
  });
});

describe("linearizePDF degrades gracefully", () => {
  it("returns a clear error (not a crash) when qpdf can't run", async () => {
    const r = await linearizePDF(await fixture("smoke/plain-text.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/web view|valid PDF/i);
  });

  it("asks for an unlock on password-protected files before touching qpdf", async () => {
    const r = await linearizePDF(await fixture("audit/user-password.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password-protected/);
  });
});

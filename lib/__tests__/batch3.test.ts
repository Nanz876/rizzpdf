// @vitest-environment node
// Batch 3 tests: merge page selection (Part 1), compression ladder search (Part 2),
// and the runInWorker fallback (Part 3). pdfjs mock/helpers copied from tools.audit.test.ts.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import * as tools from "@/lib/pdf-tools";
import { runInWorker } from "@/lib/worker/run";

const FIX = path.resolve(__dirname, "../../test-fixtures");
const MIME: Record<string, string> = { ".pdf": "application/pdf" };

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: MIME[path.extname(rel)] });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function openPdfjs(bytes: Uint8Array) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return real.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await openPdfjs(bytes);
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

// ─── Part 1: merge with per-file page selection ────────────────────────────

describe("merge with page selections", () => {
  it("picks the given ranges from each file, in order", async () => {
    const r = await tools.mergePDFs(
      [await fixture("smoke/multi-page.pdf"), await fixture("audit/structured-doc.pdf")],
      ["2-3", "2"]
    );
    expect(r.success).toBe(true);
    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("Page 2 of 6");
    expect(texts[1]).toContain("Page 3 of 6");
    expect(texts[2]).toContain("Appendix");
  });

  it("keeps the order written, e.g. '3,1' puts page 3 first", async () => {
    const r = await tools.mergePDFs([await fixture("smoke/multi-page.pdf")], ["3,1"]);
    expect(r.success).toBe(true);
    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain("Page 3 of 6");
    expect(texts[1]).toContain("Page 1 of 6");
  });

  it("names the file in a bad-range error", async () => {
    const bad = await fixture("smoke/multi-page.pdf");
    const r = await tools.mergePDFs([bad, await fixture("audit/structured-doc.pdf")], ["99", undefined]);
    expect(r.success).toBe(false);
    expect(r.error).toContain(bad.name);
    expect(r.error).toMatch(/outside this document/);
  });

  it("no selections merges all pages (existing behaviour)", async () => {
    const r = await tools.mergePDFs([await fixture("smoke/multi-page.pdf"), await fixture("smoke/plain-text.pdf")]);
    expect(r.success).toBe(true);
    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(7); // 6 + 1
  });
});

// ─── Part 2: compression ladder search ─────────────────────────────────────

describe("searchCompressionLadder", () => {
  const ladder = [
    { maxEdge: 2200, quality: 0.75 },
    { maxEdge: 1600, quality: 0.65 },
    { maxEdge: 1200, quality: 0.55 },
    { maxEdge: 900, quality: 0.45 },
    { maxEdge: 700, quality: 0.35 },
  ];

  it("stops at the first level under target", async () => {
    const sizes = [5_000_000, 3_000_000, 1_000_000, 500_000, 200_000];
    let calls = 0;
    const tryLevel = async (_settings: unknown, index: number) => { calls++; return sizes[index]; };
    const result = await tools.searchCompressionLadder(tryLevel, 2_000_000, ladder);
    expect(result.reachedTarget).toBe(true);
    expect(result.index).toBe(2);
    expect(result.size).toBe(1_000_000);
    expect(calls).toBe(3); // stopped after finding the first level under target
  });

  it("returns the smallest with reachedTarget false when none fit", async () => {
    const sizes = [5_000_000, 4_500_000, 4_000_000, 3_800_000, 3_700_000];
    const tryLevel = async (_settings: unknown, index: number) => sizes[index];
    const result = await tools.searchCompressionLadder(tryLevel, 1_000_000, ladder);
    expect(result.reachedTarget).toBe(false);
    expect(result.index).toBe(4);
    expect(result.size).toBe(3_700_000);
  });

  it("makes no attempts when the original is already under target", async () => {
    let calls = 0;
    const tryLevel = async () => { calls++; return 100; };
    const result = await tools.searchCompressionLadder(tryLevel, 2_000_000, ladder, 100_000);
    expect(calls).toBe(0);
    expect(result.reachedTarget).toBe(true);
    expect(result.index).toBe(-1);
    expect(result.size).toBe(100_000);
  });
});

describe("compressToTarget", () => {
  it("returns the original unchanged, with a warning, when already under target", async () => {
    const file = await fixture("smoke/multi-page.pdf");
    const r = await tools.compressToTarget(file, file.size * 2);
    expect(r.success).toBe(true);
    expect(r.reachedTarget).toBe(true);
    expect(r.warning).toMatch(/already/i);
    expect(r.blob!.size).toBe(file.size);
  });
});

// ─── Part 3: runInWorker fallback (Worker is undefined in Node) ────────────

describe("runInWorker fallback", () => {
  it("Worker is unavailable in this environment (sanity check for the fallback path)", () => {
    expect(typeof Worker).toBe("undefined");
  });

  it("returns the same result as calling mergePDFs directly", async () => {
    const files = [await fixture("smoke/multi-page.pdf"), await fixture("smoke/plain-text.pdf")];
    const direct = await tools.mergePDFs(files);
    const viaWorker = await runInWorker<tools.ToolResult>("mergePDFs", files);
    expect(viaWorker.success).toBe(true);
    expect(direct.success).toBe(true);
    const [directTexts, workerTexts] = await Promise.all([
      pageTexts(await bytesOf(direct.blob!)),
      pageTexts(await bytesOf(viaWorker.blob!)),
    ]);
    expect(workerTexts).toEqual(directTexts);
  });

  it("an application-level error result matches the direct call", async () => {
    const bad = await fixture("smoke/multi-page.pdf");
    const direct = await tools.mergePDFs([bad], ["99"]);
    const viaWorker = await runInWorker<tools.ToolResult>("mergePDFs", [bad], ["99"]);
    expect(viaWorker.success).toBe(false);
    expect(viaWorker.error).toBe(direct.error);
  });

  it("propagates a thrown error the same way the direct call would", async () => {
    const bytes = await fs.readFile(path.join(FIX, "audit/user-password.pdf"));
    const { decryptPdf } = await import("@/lib/pdf-decrypt");
    await expect(decryptPdf(bytes, "wrong-password")).rejects.toThrow();
    await expect(runInWorker("decryptPdf", bytes, "wrong-password")).rejects.toThrow();
  });
});

describe("worker import graph", () => {
  it("library code never imports lib/worker/run (a worker that spawns itself hangs the build)", async () => {
    const fsp = await import("node:fs/promises");
    const pth = await import("node:path");
    const root = pth.resolve(__dirname, "..");
    const offenders: string[] = [];
    async function walk(dir: string) {
      for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
        const full = pth.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "__tests__" || entry.name === "worker") continue;
          await walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          const src = await fsp.readFile(full, "utf8");
          if (/from\s+["']@\/lib\/worker\/run["']|import\(["']@\/lib\/worker\/run["']\)/.test(src)) offenders.push(full);
        }
      }
    }
    await walk(root);
    expect(offenders).toEqual([]);
  });
});

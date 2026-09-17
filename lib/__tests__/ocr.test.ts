// @vitest-environment node
// OCR turns a picture of text into a searchable PDF. These tests check the two
// promises the tool makes: it can tell a scan from a real text document, and the
// PDF it produces has the recognised words in its text layer, on the right page.
//
// Node has no canvas, so the rasteriser is injected (as in redact.test.ts) and
// tesseract.js is mocked — the recogniser's accuracy is not what's under test here,
// the geometry and the plumbing around it are.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { ImageLike } from "tesseract.js";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  // The app sets workerSrc to a browser URL; absorb that in tests.
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

/** Words the fake recogniser "reads" off every page it is given. */
const WORDS = ["Quarterly", "Invoice", "Number", "84213"];
const recognizedImages: string[] = [];
const createdLangs: string[] = [];
let terminated = 0;

vi.mock("tesseract.js", () => ({
  createWorker: async (langs?: string) => {
    createdLangs.push(langs ?? "");
    return {
      recognize: async (image: unknown) => {
        recognizedImages.push(String(image));
        // Four words stacked down the top-left of the image.
        const words = WORDS.map((text, i) => ({
          text,
          confidence: 92,
          bbox: { x0: 120, y0: 150 + i * 60, x1: 120 + text.length * 26, y1: 195 + i * 60 },
        }));
        return {
          jobId: "test",
          data: { text: WORDS.join(" "), blocks: [{ paragraphs: [{ lines: [{ words }] }] }] },
        };
      },
      terminate: async () => {
        terminated++;
      },
    };
  },
}));

import { isScanned, ocrPdf, FREE_OCR_PAGES, OCR_DPI, type OcrPageRenderer } from "@/lib/tools/ocr";

const FIX = path.resolve(__dirname, "../../test-fixtures");

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await real.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  await doc.destroy();
  return out;
}

/** Solid-white RGBA page at the requested scale (node has no canvas). */
const renderScales: number[] = [];
let released = 0;
const whiteRenderer: OcrPageRenderer = async (page, scale) => {
  renderScales.push(scale);
  const vp = page.getViewport({ scale });
  const width = Math.ceil(vp.width);
  const height = Math.ceil(vp.height);
  return {
    data: new Uint8ClampedArray(width * height * 4).fill(255),
    width,
    height,
    image: `canvas:${width}x${height}` as unknown as ImageLike,
    release: () => {
      released++;
    },
  };
};

beforeEach(() => {
  recognizedImages.length = 0;
  createdLangs.length = 0;
  renderScales.length = 0;
  terminated = 0;
  released = 0;
});

describe("isScanned", () => {
  it("reports an image-only PDF as scanned", async () => {
    const r = await isScanned(await fixture("audit/scanned-no-text.pdf"));
    expect(r.scanned).toBe(true);
    expect(r.pageCount).toBe(1);
    expect(r.textPages).toBe(0);
  });

  it("reports a real text document as not scanned", async () => {
    const r = await isScanned(await fixture("audit/structured-doc.pdf"));
    expect(r.scanned).toBe(false);
    expect(r.pageCount).toBe(2);
    expect(r.textPages).toBe(2);
  });
});

describe("ocrPdf", () => {
  it("puts the recognised words into the output PDF's text layer", async () => {
    const file = await fixture("audit/scanned-no-text.pdf");
    // Positive control: the scan has nothing to select before OCR.
    expect((await pageTexts(await bytesOf(file))).join("")).toBe("");

    const r = await ocrPdf(file, { renderPage: whiteRenderer });
    expect(r.success).toBe(true);
    expect(r.filename).toBe("scanned-no-text_ocr.pdf");

    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(1);
    for (const word of WORDS) expect(texts[0]).toContain(word);

    // The plain-text output carries the same words.
    for (const word of WORDS) expect(r.text).toContain(word);
    expect(r.pageTexts).toHaveLength(1);

    // Rendered at roughly OCR_DPI, and the canvas was handed to tesseract and freed.
    expect(renderScales[0]).toBeCloseTo(OCR_DPI / 72, 5);
    expect(recognizedImages).toHaveLength(1);
    expect(released).toBe(1);
    expect(terminated).toBe(1);
    expect(createdLangs).toEqual(["eng"]);
  });

  it("keeps the words inside the page box", async () => {
    const file = await fixture("audit/scanned-no-text.pdf");
    const r = await ocrPdf(file, { renderPage: whiteRenderer });
    const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await real.getDocument({ data: await bytesOf(r.blob!), isEvalSupported: false, verbosity: 0 }).promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const items = (await page.getTextContent()).items.filter(
      (it): it is Extract<typeof it, { str: string }> => "str" in it && it.str.trim().length > 0
    );
    expect(items.length).toBe(WORDS.length);
    for (const it of items) {
      const [x, y] = [it.transform[4], it.transform[5]];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(vp.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(vp.height);
    }
    // Reading order top to bottom: the first word sits highest on the page.
    const ys = items.map((it) => it.transform[5]);
    expect(ys[0]).toBeGreaterThan(ys[ys.length - 1]);
    await doc.destroy();
  });

  it("passes the language through", async () => {
    await ocrPdf(await fixture("audit/scanned-no-text.pdf"), { renderPage: whiteRenderer, language: "deu" });
    expect(createdLangs).toEqual(["deu"]);
  });

  it("reports per-page progress", async () => {
    const seen: [number, number, string][] = [];
    await ocrPdf(await fixture("audit/structured-doc.pdf"), {
      renderPage: whiteRenderer,
      onProgress: (done, total, stage) => seen.push([done, total, stage]),
    });
    expect(seen.length).toBeGreaterThan(2);
    expect(seen[0][1]).toBe(2);
    expect(seen[seen.length - 1][0]).toBe(2);
  });
});

describe("page cap", () => {
  it("only OCRs the pages it was given and copies the rest untouched", async () => {
    const file = await fixture("audit/structured-doc.pdf"); // 2 pages of real text
    const r = await ocrPdf(file, { pages: [1], renderPage: whiteRenderer });
    expect(r.success).toBe(true);

    // One render, one recognise — page 2 was never read.
    expect(renderScales).toHaveLength(1);
    expect(recognizedImages).toHaveLength(1);

    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(2);
    // Page 1 was rasterised: only the invisible OCR layer is selectable now.
    for (const word of WORDS) expect(texts[0]).toContain(word);
    expect(texts[0]).not.toContain("Quarterly Report");
    // Page 2 is the untouched original.
    expect(texts[1]).toContain("Appendix");
    expect(texts[1]).not.toContain("Invoice");

    // pageTexts has one slot per page; skipped pages are empty.
    expect(r.pageTexts).toHaveLength(2);
    expect(r.pageTexts![1]).toBe("");
  });

  it("ignores page numbers outside the document and rejects an empty selection", async () => {
    const file = await fixture("audit/structured-doc.pdf");
    const r = await ocrPdf(file, { pages: [2, 99, 0], renderPage: whiteRenderer });
    expect(r.success).toBe(true);
    expect(recognizedImages).toHaveLength(1);

    const empty = await ocrPdf(file, { pages: [], renderPage: whiteRenderer });
    expect(empty.success).toBe(false);
    expect(empty.error).toMatch(/at least one page/i);
  });

  it("caps free users at ten pages per document", () => {
    expect(FREE_OCR_PAGES).toBe(10);
  });
});

describe("bad input", () => {
  it("tells the user to unlock a password-protected PDF first", async () => {
    const r = await ocrPdf(await fixture("audit/user-password.pdf"), { renderPage: whiteRenderer });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password-protected.*Unlock/i);
  });
});

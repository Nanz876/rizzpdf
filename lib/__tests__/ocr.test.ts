// @vitest-environment node
// OCR turns a picture of text into a searchable PDF. These tests pin the three
// promises the tool makes:
//   1. it can tell a scan from a real text document,
//   2. the output is the ORIGINAL page with an invisible text layer on top — same
//      size, same /Rotate, same crop box, same content stream, no re-rasterising,
//   3. each recognised word lands on the pixels it was read from, including on a
//      page with its own /Rotate and an offset CropBox.
//
// Node has no canvas, so the rasteriser is injected (as in redact.test.ts) and
// tesseract.js is mocked — the recogniser's accuracy is not what's under test here,
// the geometry and the plumbing around it are.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, PDFArray, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
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

/** Words the fake recogniser "reads", as fractions of the rendered image. */
const WORD_SPECS = [
  { text: "Quarterly", fx0: 0.1, fx1: 0.35, fy0: 0.08, fy1: 0.12 },
  { text: "Invoice", fx0: 0.1, fx1: 0.28, fy0: 0.2, fy1: 0.235 },
  { text: "Number", fx0: 0.3, fx1: 0.5, fy0: 0.2, fy1: 0.235 },
  { text: "84213", fx0: 0.1, fx1: 0.24, fy0: 0.76, fy1: 0.795 },
];
const WORDS = WORD_SPECS.map((w) => w.text);

const recognizedImages: string[] = [];
const createdLangs: string[] = [];
let terminated = 0;

vi.mock("tesseract.js", () => ({
  createWorker: async (langs?: string) => {
    createdLangs.push(langs ?? "");
    return {
      recognize: async (image: unknown) => {
        recognizedImages.push(String(image));
        // The injected renderer encodes the image size into `image`, so the fake
        // boxes can be expressed in that image's own pixels.
        const [, w, h] = /^canvas:(\d+)x(\d+)$/.exec(String(image))!.map(Number);
        const words = WORD_SPECS.map((s) => ({
          text: s.text,
          confidence: 92,
          bbox: {
            x0: Math.round(s.fx0 * w),
            x1: Math.round(s.fx1 * w),
            y0: Math.round(s.fy0 * h),
            y1: Math.round(s.fy1 * h),
          },
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

async function fixtureBytes(rel: string): Promise<Uint8Array> {
  return new Uint8Array(await fs.readFile(path.join(FIX, rel)));
}

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
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
  await doc.destroy();
  return out;
}

/**
 * Every text item on a page, with its baseline origin converted to the page as the
 * reader sees it: pixels from the top-left of the rotated, cropped page at scale 1.
 * This is the same space tesseract's boxes are measured in, so expectations can be
 * written directly against the fractions fed to the fake recogniser.
 */
async function displayedTextItems(bytes: Uint8Array, pageNum: number) {
  const doc = await openPdfjs(bytes);
  const page = await doc.getPage(pageNum);
  const vp = page.getViewport({ scale: 1 });
  const items = (await page.getTextContent()).items.filter(
    (it): it is Extract<typeof it, { str: string }> => "str" in it && it.str.trim().length > 0
  );
  const out = items.map((it) => {
    const [vx, vy] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    return { str: it.str, vx, vy };
  });
  await doc.destroy();
  return { items: out, width: vp.width, height: vp.height };
}

/** A page's whole content stream, decoded and concatenated in drawing order. */
async function pageContent(bytes: Uint8Array, pageIndex: number): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const ctx = doc.context;
  const contents = ctx.lookup(doc.getPage(pageIndex).node.get(PDFName.of("Contents")));
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => ctx.lookup(r)) : [contents];
  let text = "";
  for (const s of streams) {
    if (s instanceof PDFRawStream) text += Buffer.from(decodePDFRawStream(s).decode()).toString("latin1");
  }
  return text;
}

/** How many image XObjects the file carries, by compression filter. */
function imageFilters(bytes: Uint8Array): { dct: number; images: number } {
  const raw = Buffer.from(bytes).toString("latin1");
  return {
    dct: (raw.match(/\/DCTDecode/g) ?? []).length,
    images: (raw.match(/\/Subtype\s*\/Image/g) ?? []).length,
  };
}

/** Solid-white page at the requested scale (node has no canvas). */
const renderScales: number[] = [];
let released = 0;
const whiteRenderer: OcrPageRenderer = async (page, scale) => {
  renderScales.push(scale);
  const vp = page.getViewport({ scale });
  const width = Math.ceil(vp.width);
  const height = Math.ceil(vp.height);
  return {
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

// The whole point of the rewrite: the scan itself is never touched, so a 300 DPI
// archival page stays a 300 DPI archival page.
describe("the original pages survive untouched", () => {
  it("keeps every page's size, rotation and crop box", async () => {
    const before = await PDFDocument.load(await fixtureBytes("audit/rotated-cropped.pdf"));
    const r = await ocrPdf(await fixture("audit/rotated-cropped.pdf"), { renderPage: whiteRenderer });
    expect(r.success).toBe(true);
    const after = await PDFDocument.load(await bytesOf(r.blob!));

    expect(after.getPageCount()).toBe(before.getPageCount());
    for (let i = 0; i < before.getPageCount(); i++) {
      const a = before.getPage(i);
      const b = after.getPage(i);
      expect(b.getSize()).toEqual(a.getSize());
      expect(b.getRotation().angle).toBe(a.getRotation().angle);
      expect(b.getCropBox()).toEqual(a.getCropBox());
      expect(b.getMediaBox()).toEqual(a.getMediaBox());
    }
    // Page 1 really is the awkward one.
    expect(before.getPage(0).getRotation().angle).toBe(90);
    expect(before.getPage(0).getCropBox()).toEqual({ x: 36, y: 36, width: 540, height: 720 });
  });

  it("keeps the original page content stream and adds no image", async () => {
    const inBytes = await fixtureBytes("audit/structured-doc.pdf");
    const r = await ocrPdf(await fixture("audit/structured-doc.pdf"), { renderPage: whiteRenderer });
    const outBytes = await bytesOf(r.blob!);

    // The document's own text is still there, alongside the OCR layer.
    const texts = await pageTexts(outBytes);
    expect(texts[0]).toContain("Quarterly Report");
    expect(texts[0]).toContain("Revenue grew steadily");
    expect(texts[1]).toContain("Appendix");

    // The original content stream survives verbatim; the text layer is appended
    // after it (pdf-lib brackets pre-existing content in its own q/Q pair).
    const originalContent = await pageContent(inBytes, 0);
    const newContent = await pageContent(outBytes, 0);
    expect(originalContent.length).toBeGreaterThan(100); // positive control
    expect(newContent).toContain(originalContent);
    expect(newContent.indexOf(originalContent) + originalContent.length).toBeLessThan(newContent.length);

    // Nothing was rasterised: a text document gains no image XObject.
    expect(imageFilters(inBytes).images).toBe(0);
    expect(imageFilters(outBytes).images).toBe(0);

    // Output is the input plus a text layer, not plus a 200 DPI raster.
    expect(outBytes.length).toBeLessThan(inBytes.length + 50_000);
  });

  it("leaves a scan's own image untouched instead of re-encoding it", async () => {
    const inBytes = await fixtureBytes("audit/scanned-no-text.pdf");
    const r = await ocrPdf(await fixture("audit/scanned-no-text.pdf"), { renderPage: whiteRenderer });
    const outBytes = await bytesOf(r.blob!);

    // Still exactly one image, still the original JPEG — not a re-render.
    expect(imageFilters(inBytes)).toEqual({ dct: 1, images: 1 });
    expect(imageFilters(outBytes)).toEqual({ dct: 1, images: 1 });

    const originalContent = await pageContent(inBytes, 0);
    expect(await pageContent(outBytes, 0)).toContain(originalContent);

    // A 200 DPI RGB re-render of this page would be hundreds of kilobytes.
    expect(outBytes.length).toBeLessThan(inBytes.length + 20_000);
  });
});

describe("word positioning", () => {
  // Fractions of the displayed page the word boxes were fed at, so the invisible
  // text must come back within a whisker of them.
  const expectPlaced = (
    found: { str: string; vx: number; vy: number }[],
    width: number,
    height: number
  ) => {
    expect(found).toHaveLength(WORD_SPECS.length);
    for (const spec of WORD_SPECS) {
      const item = found.find((f) => f.str === spec.text);
      expect(item, `no invisible "${spec.text}"`).toBeTruthy();
      // Left edge of the baseline, in displayed pixels from the left.
      expect(item!.vx).toBeCloseTo(spec.fx0 * width, 0);
      // Baseline sits just above the box's bottom edge (descender allowance),
      // measured downwards from the top of the displayed page.
      const boxBottom = spec.fy1 * height;
      const boxHeight = (spec.fy1 - spec.fy0) * height;
      expect(item!.vy).toBeGreaterThan(boxBottom - boxHeight);
      expect(item!.vy).toBeLessThanOrEqual(boxBottom + 0.5);
    }
  };

  it("lands words on the pixels they were read from (upright page)", async () => {
    const r = await ocrPdf(await fixture("audit/scanned-no-text.pdf"), { renderPage: whiteRenderer });
    const { items, width, height } = await displayedTextItems(await bytesOf(r.blob!), 1);
    expect(width).toBe(612);
    expect(height).toBe(792);
    expectPlaced(items, width, height);
  });

  it("lands words on the pixels they were read from (/Rotate 90 + offset CropBox)", async () => {
    const r = await ocrPdf(await fixture("audit/rotated-cropped.pdf"), { pages: [1], renderPage: whiteRenderer });
    expect(r.success).toBe(true);
    const { items, width, height } = await displayedTextItems(await bytesOf(r.blob!), 1);
    // Displayed page is the 540x720 crop box turned on its side.
    expect(width).toBe(720);
    expect(height).toBe(540);

    // Page 1 keeps its own text too, so look only at the words OCR added.
    const found = items.filter((i) => WORDS.includes(i.str));
    expectPlaced(found, width, height);

    // A wrong inverse mapping would still be "on the page" — prove the layer is
    // actually rotated by checking the page's own text is unaffected and present.
    expect(items.some((i) => i.str.includes("Rotated"))).toBe(true);
  });
});

describe("page cap", () => {
  it("only OCRs the pages it was given and leaves the rest without a text layer", async () => {
    const file = await fixture("audit/structured-doc.pdf"); // 2 pages of real text
    const r = await ocrPdf(file, { pages: [1], renderPage: whiteRenderer });
    expect(r.success).toBe(true);

    // One render, one recognise — page 2 was never read.
    expect(renderScales).toHaveLength(1);
    expect(recognizedImages).toHaveLength(1);

    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(2);
    // Page 1 has both its own text and the OCR layer; page 2 only its own.
    for (const word of WORDS) expect(texts[0]).toContain(word);
    expect(texts[0]).toContain("Quarterly Report");
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

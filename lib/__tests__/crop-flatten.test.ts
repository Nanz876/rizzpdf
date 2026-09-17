// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, PDFName, PDFDict, PDFRef, rectangle, fill } from "pdf-lib";

const require = createRequire(import.meta.url);

// Copied from lib/__tests__/tools.audit.test.ts: the app sets pdf.js's workerSrc to
// a browser URL, which needs absorbing under Node for these tests.
vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { cropPDF } from "@/lib/tools/crop";
import { flattenPDF } from "@/lib/tools/flatten";

const FIX = path.resolve(__dirname, "../../test-fixtures");
const MIME: Record<string, string> = { ".pdf": "application/pdf" };

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: MIME[path.extname(rel)] });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function openPdfjs(bytes: Uint8Array, password?: string) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return real.getDocument({ data: bytes.slice(), password, isEvalSupported: false, verbosity: 0 }).promise;
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

async function operatorFns(bytes: Uint8Array, pageNum = 1): Promise<number[]> {
  const doc = await openPdfjs(bytes);
  const list = await (await doc.getPage(pageNum)).getOperatorList();
  return [...list.fnArray];
}

describe("crop", () => {
  it("shrinks every page's CropBox to 80%, centred, for uniform 10% margins", async () => {
    const file = await fixture("smoke/multi-page.pdf");
    const srcDoc = await PDFDocument.load(await file.arrayBuffer());
    const srcBoxes = srcDoc.getPages().map((p) => p.getCropBox());

    const r = await cropPDF(file, { margins: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 }, pages: "all" });
    expect(r.success).toBe(true);

    const outDoc = await PDFDocument.load(await bytesOf(r.blob!));
    outDoc.getPages().forEach((page, i) => {
      const src = srcBoxes[i];
      const box = page.getCropBox();
      expect(box.width).toBeCloseTo(src.width * 0.8, 5);
      expect(box.height).toBeCloseTo(src.height * 0.8, 5);
      expect(box.x).toBeCloseTo(src.x + src.width * 0.1, 5);
      expect(box.y).toBeCloseTo(src.y + src.height * 0.1, 5);
    });
  });

  it("crops the correct user-space edge on a page rotated 90° with an offset CropBox", async () => {
    // audit/rotated-cropped.pdf page 1 has /Rotate 90 and CropBox (36, 36, 540, 720).
    // Displayed sideways, the reader's "top" edge is the unrotated page's LEFT edge
    // (x0), not its actual top (y1) — see lib/pdf-load.ts displayedPage() for why.
    // A 20% top-only margin should shrink the box from the x0 side only.
    const file = await fixture("audit/rotated-cropped.pdf");
    const srcDoc = await PDFDocument.load(await file.arrayBuffer());
    const srcBox = srcDoc.getPage(0).getCropBox();
    expect([srcBox.x, srcBox.y, srcBox.width, srcBox.height]).toEqual([36, 36, 540, 720]);

    const r = await cropPDF(file, { margins: { top: 0.2, right: 0, bottom: 0, left: 0 }, pages: [1] });
    expect(r.success).toBe(true);

    const outDoc = await PDFDocument.load(await bytesOf(r.blob!));
    const outPage = outDoc.getPage(0);
    expect(outPage.getRotation().angle).toBe(90);
    const box = outPage.getCropBox();
    // Displayed height for a sideways page is the CropBox's own width (540); 20% of
    // that (108) is removed from the x0 edge, which is the displayed top.
    expect(box.x).toBeCloseTo(36 + 0.2 * 540, 5); // 144
    expect(box.y).toBeCloseTo(36, 5);
    expect(box.width).toBeCloseTo(540 - 0.2 * 540, 5); // 432
    expect(box.height).toBeCloseTo(720, 5);
  });

  it("applies only to the page(s) named in a custom page selection", async () => {
    const file = await fixture("smoke/multi-page.pdf");
    const srcDoc = await PDFDocument.load(await file.arrayBuffer());
    const srcBoxes = srcDoc.getPages().map((p) => p.getCropBox());
    expect(srcBoxes.length).toBeGreaterThanOrEqual(2);

    const r = await cropPDF(file, { margins: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 }, pages: [2] });
    expect(r.success).toBe(true);

    const outDoc = await PDFDocument.load(await bytesOf(r.blob!));
    outDoc.getPages().forEach((page, i) => {
      const src = srcBoxes[i];
      const box = page.getCropBox();
      if (i === 1) {
        expect(box.width).toBeCloseTo(src.width * 0.8, 5);
        expect(box.height).toBeCloseTo(src.height * 0.8, 5);
      } else {
        expect(box.width).toBeCloseTo(src.width, 5);
        expect(box.height).toBeCloseTo(src.height, 5);
      }
    });
  });

  it("rejects margins that would leave less than 5% of the page", async () => {
    const file = await fixture("smoke/multi-page.pdf");
    const r = await cropPDF(file, { margins: { top: 0.48, right: 0, bottom: 0.48, left: 0 }, pages: "all" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/5%/);
  });
});

describe("flatten", () => {
  it("flattens form fields into the page and empties the form", async () => {
    const r = await flattenPDF(await fixture("audit/form-metadata.pdf"), { forms: true, annotations: false });
    expect(r.success).toBe(true);
    const bytes = await bytesOf(r.blob!);
    const outDoc = await PDFDocument.load(bytes);
    expect(outDoc.getForm().getFields()).toHaveLength(0);
    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain("Jane Doe");
  });

  it("bakes a non-Link annotation's appearance into the page and removes it, keeping Link annotations", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const context = doc.context;

    // A Square annotation with an /AP /N appearance stream that paints a filled rectangle.
    const apStream = context.formXObject([rectangle(10, 10, 50, 50), fill()], {
      BBox: context.obj([0, 0, 70, 70]),
    });
    const apRef = context.register(apStream);
    const squareDict = context.obj({
      Type: "Annot",
      Subtype: "Square",
      Rect: [20, 20, 90, 90],
      AP: { N: apRef },
    });
    const squareRef = context.register(squareDict);
    page.node.addAnnot(squareRef);

    // A Link annotation, which must survive flattening untouched.
    const linkDict = context.obj({ Type: "Annot", Subtype: "Link", Rect: [100, 100, 150, 150] });
    const linkRef = context.register(linkDict);
    page.node.addAnnot(linkRef);

    const bytes = new Uint8Array(await doc.save());
    const file = new File([bytes as Uint8Array<ArrayBuffer>], "annotated.pdf", { type: "application/pdf" });

    const r = await flattenPDF(file, { forms: false, annotations: true });
    expect(r.success).toBe(true);
    const outBytes = await bytesOf(r.blob!);

    const outDoc = await PDFDocument.load(outBytes);
    const outAnnots = outDoc.getPage(0).node.Annots()!.asArray();
    expect(outAnnots).toHaveLength(1);
    const remaining = outDoc.context.lookup(outAnnots[0] as PDFRef);
    expect((remaining as PDFDict).get(PDFName.of("Subtype"))?.toString()).toBe("/Link");

    const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const fns = await operatorFns(outBytes);
    expect(fns).toContain(real.OPS.paintFormXObjectBegin);
  });

  it("returns the original file with a warning when there's nothing to flatten", async () => {
    const r = await flattenPDF(await fixture("smoke/plain-text.pdf"), { forms: true, annotations: true });
    expect(r.success).toBe(true);
    expect(r.warning).toMatch(/nothing to flatten/i);
  });
});

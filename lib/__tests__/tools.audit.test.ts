// @vitest-environment node
// Audit tests: each assertion encodes something the site advertises about a tool.
// Tools that need a real browser canvas (compress, PDF to JPG/PNG, raster fallbacks)
// are covered by the in-browser smoke test instead.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import JSZip from "jszip";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  // The app sets workerSrc to a browser URL; absorb that in tests.
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import * as tools from "@/lib/pdf-tools";
import { unlockPDF } from "@/lib/pdf-unlock";

const FIX = path.resolve(__dirname, "../../test-fixtures");
const MIME: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".png": "image/png" };

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: MIME[path.extname(rel)] });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());


async function openPdfjs(bytes: Uint8Array, password?: string) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return real.getDocument({ data: bytes.slice(), password, isEvalSupported: false, verbosity: 0 }).promise;
}

async function pageTexts(bytes: Uint8Array, password?: string): Promise<string[]> {
  const doc = await openPdfjs(bytes, password);
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

/** Transform matrices (in order) emitted on a page, plus the index of each image paint. */
async function drawOps(bytes: Uint8Array, pageNum = 1) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await openPdfjs(bytes);
  const list = await (await doc.getPage(pageNum)).getOperatorList();
  const transforms: number[][] = [];
  let imagesPainted = 0;
  list.fnArray.forEach((fn, i) => {
    if (fn === real.OPS.transform) transforms.push((list.argsArray[i] as number[]).map((n) => Math.round(n * 1000) / 1000));
    if (fn === real.OPS.paintImageXObject) imagesPainted++;
  });
  return { transforms, imagesPainted };
}

describe("merge", () => {
  it("combines pages in the given order", async () => {
    const r = await tools.mergePDFs([await fixture("audit/structured-doc.pdf"), await fixture("smoke/plain-text.pdf")]);
    expect(r.success).toBe(true);
    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("Quarterly Report");
    expect(texts[2]).toContain("Plain Text Fixture");
  });

  it("never outputs garbled pages for a restriction-encrypted input", async () => {
    const r = await tools.mergePDFs([await fixture("audit/owner-restricted.pdf"), await fixture("smoke/plain-text.pdf")]);
    expect(r.success).toBe(true);
    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts[0]).toContain("Quarterly Report");
  });

  it("tells the user to unlock a password-protected input first", async () => {
    const r = await tools.mergePDFs([await fixture("audit/user-password.pdf"), await fixture("smoke/plain-text.pdf")]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password-protected.*Unlock/i);
  });
});

describe("split", () => {
  it("every page produces one PDF per page", async () => {
    const r = await tools.splitPDF(await fixture("smoke/multi-page.pdf"), "every-page");
    const src = await PDFDocument.load(await (await fixture("smoke/multi-page.pdf")).arrayBuffer());
    expect(r.blobs).toHaveLength(src.getPageCount());
  });

  it("parses documented range syntax like '1, 3-4'", async () => {
    const r = await tools.splitPDF(await fixture("smoke/multi-page.pdf"), "range", "1, 3-4");
    expect(r.blobs).toHaveLength(2);
    const counts = await Promise.all(r.blobs!.map(async (b) => (await PDFDocument.load(await bytesOf(b))).getPageCount()));
    expect(counts).toEqual([1, 2]);
  });

  it("accepts a reversed range like '4-2' instead of silently dropping it", async () => {
    const r = await tools.splitPDF(await fixture("smoke/multi-page.pdf"), "range", "4-2");
    expect(r.success).toBe(true);
    expect(r.blobs).toHaveLength(1);
  });
});

describe("split input errors", () => {
  it("explains out-of-range and malformed ranges", async () => {
    const f = await fixture("smoke/multi-page.pdf");
    expect((await tools.splitPDF(f, "range", "1-99")).error).toMatch(/outside this document/);
    expect((await tools.splitPDF(f, "range", "abc")).error).toMatch(/isn't a page or range/);
  });
});

describe("rotate", () => {
  it("adds to each page's existing rotation", async () => {
    const r = await tools.rotatePDF(await fixture("audit/rotated-cropped.pdf"), 90, "all");
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([180, 90]);
  });
});

describe("watermark", () => {
  it("puts selectable watermark text on every page", async () => {
    const r = await tools.watermarkPDF(await fixture("smoke/multi-page.pdf"), { text: "CONFIDENTIAL" });
    const texts = await pageTexts(await bytesOf(r.blob!));
    for (const t of texts) expect(t).toContain("CONFIDENTIAL");
  });

  it("gives a clear error (not a generic failure) for unsupported characters", async () => {
    const r = await tools.watermarkPDF(await fixture("smoke/plain-text.pdf"), { text: "机密" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Latin letters/i);
  });

  it("keeps the original text readable on a restriction-encrypted input", async () => {
    const r = await tools.watermarkPDF(await fixture("audit/owner-restricted.pdf"), { text: "DRAFT" });
    expect(r.success).toBe(true);
    const [t] = await pageTexts(await bytesOf(r.blob!));
    expect(t).toContain("Quarterly Report");
    expect(t).toContain("DRAFT");
  });
});

describe("page numbers", () => {
  it("renders the chosen format and start number", async () => {
    const r = await tools.addPageNumbers(await fixture("smoke/multi-page.pdf"), { format: "Page 1", startFrom: 5 });
    const texts = await pageTexts(await bytesOf(r.blob!));
    expect(texts[0]).toContain("Page 5");
    expect(texts[1]).toContain("Page 6");
  });

  it("places numbers inside the visible (cropped) area", async () => {
    const r = await tools.addPageNumbers(await fixture("audit/rotated-cropped.pdf"), { position: "bottom-center" });
    const doc = await openPdfjs(await bytesOf(r.blob!));
    const page = await doc.getPage(1);
    const [x0, y0, x1, y1] = page.view; // crop box in user space
    const item = (await page.getTextContent()).items.find((it) => "str" in it && it.str === "1") as { transform: number[] } | undefined;
    expect(item).toBeTruthy();
    const [, , , , x, y] = item!.transform;
    expect(x).toBeGreaterThanOrEqual(x0);
    expect(x).toBeLessThanOrEqual(x1);
    expect(y).toBeGreaterThanOrEqual(y0);
    expect(y).toBeLessThanOrEqual(y1);
  });
});

describe("delete pages / organize keep document features", () => {
  it("delete keeps form fields and metadata", async () => {
    const r = await tools.deletePages(await fixture("audit/form-metadata.pdf"), [3]);
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe("Signup Form");
    expect(doc.getForm().getFields().map((f) => f.getName())).toContain("fullName");
  });

  it("organize reorders and keeps form fields and metadata", async () => {
    const r = await tools.organizePDF(await fixture("audit/form-metadata.pdf"), [2, 0, 1]);
    const bytes = await bytesOf(r.blob!);
    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain("Third page");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Signup Form");
    expect(doc.getForm().getFields().map((f) => f.getName())).toContain("fullName");
  });
});

describe("protect", () => {
  it("requires the password to open and uses AES-256", async () => {
    const r = await tools.protectPDF(await fixture("audit/structured-doc.pdf"), "s3cret");
    expect(r.success).toBe(true);
    const bytes = await bytesOf(r.blob!);
    await expect(openPdfjs(bytes)).rejects.toThrow(/password/i);
    const texts = await pageTexts(bytes, "s3cret");
    expect(texts[0]).toContain("Quarterly Report");
    const { isEncrypted } = await import("@pdfsmaller/pdf-decrypt");
    expect((await isEncrypted(bytes)).algorithm).toBe("AES-256");
  });
});

describe("unlock", () => {
  it("removes restrictions with no password and keeps text selectable", async () => {
    const r = await unlockPDF(await fixture("audit/owner-restricted.pdf"), "");
    expect(r.success).toBe(true);
    expect(r.warning).toBeFalsy();
    const bytes = await bytesOf(r.blob!);
    expect((await PDFDocument.load(bytes)).isEncrypted).toBe(false);
    expect((await pageTexts(bytes))[0]).toContain("Quarterly Report");
  });

  it("removes an open password and keeps text selectable", async () => {
    const r = await unlockPDF(await fixture("audit/user-password.pdf"), "rizz123");
    expect(r.success).toBe(true);
    expect(r.warning).toBeFalsy();
    expect((await pageTexts(await bytesOf(r.blob!)))[0]).toContain("Quarterly Report");
  });

  it("reports a wrong password clearly", async () => {
    const r = await unlockPDF(await fixture("audit/user-password.pdf"), "nope");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password/i);
  });

  it("asks for a password when a file needs one and none was given", async () => {
    const r = await unlockPDF(await fixture("audit/user-password.pdf"), "");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password/i);
  });
});

describe("repair", () => {
  it("fixes a lightly damaged file and keeps text and page size", async () => {
    const r = await tools.repairPDF(await fixture("smoke/mildly-malformed.pdf"));
    expect(r.success).toBe(true);
    const bytes = await bytesOf(r.blob!);
    expect((await pageTexts(bytes)).join(" ").length).toBeGreaterThan(10);
    const { width, height } = (await PDFDocument.load(bytes)).getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([612, 792]);
  });
});

describe("pdf to word", () => {
  async function docXml(r: { blob?: Blob }) {
    const zip = await JSZip.loadAsync(await bytesOf(r.blob!));
    return zip.file("word/document.xml")!.async("string");
  }
  const paragraphs = (xml: string) =>
    [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(""));

  it("keeps wrapped lines of one paragraph together", async () => {
    const r = await tools.pdfToWord(await fixture("audit/structured-doc.pdf"));
    expect(r.success).toBe(true);
    const paras = paragraphs(await docXml(r));
    const p = paras.find((t) => t.includes("Revenue grew steadily"));
    expect(p).toBeTruthy();
    expect(p).toContain("renewals and a successful product launch");
  });

  it("marks headings with Word heading styles", async () => {
    const xml = await docXml(await tools.pdfToWord(await fixture("audit/structured-doc.pdf")));
    expect(xml).toMatch(/w:pStyle w:val="Heading1"/);
    expect(xml).toMatch(/w:pStyle w:val="Heading2"/);
  });

  it("does not turn a sentence that starts with a dash into a bullet", async () => {
    const { PDFDocument: Doc, StandardFonts } = await import("pdf-lib");
    const d = await Doc.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    const p = d.addPage([612, 792]);
    p.drawText("Results were mixed this quarter overall.", { x: 54, y: 700, size: 11, font });
    p.drawText("- 5 percent below forecast, driven by delays.", { x: 54, y: 685, size: 11, font });
    const r = await tools.pdfToWord(new File([(await d.save()) as Uint8Array<ArrayBuffer>], "dash.pdf", { type: "application/pdf" }));
    const xml = await docXml(r);
    expect(xml).not.toMatch(/w:numPr/);
    expect(paragraphs(xml).some((t) => t.includes("- 5 percent below forecast"))).toBe(true);
  });

  it("turns bullet characters into real Word bullets", async () => {
    const xml = await docXml(await tools.pdfToWord(await fixture("audit/structured-doc.pdf")));
    const paras = paragraphs(xml);
    expect(paras.some((t) => t.startsWith("Revenue up 18 percent"))).toBe(true);
    expect(xml).toMatch(/w:numPr/);
  });

  it("uses the source page size (Letter stays Letter)", async () => {
    const xml = await docXml(await tools.pdfToWord(await fixture("audit/structured-doc.pdf")));
    expect(xml).toMatch(/w:pgSz[^>]*w:w="12240"[^>]*w:h="15840"/);
  });

  it("warns instead of producing an empty document for scanned PDFs", async () => {
    const r = await tools.pdfToWord(await fixture("audit/scanned-no-text.pdf"));
    expect(r.success ? r.warning : r.error).toMatch(/scan|no (selectable )?text|OCR/i);
  });
});

describe("jpg to pdf", () => {
  it("keeps full image resolution but uses a printable page size", async () => {
    const r = await tools.jpgToPdf([await fixture("audit/photo-landscape.jpg")]);
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.max(width, height)).toBeLessThanOrEqual(842); // A4/Letter long side in points
    const imgs = [...doc.context.enumerateIndirectObjects()].filter(([, o]) => {
      const d = (o as { dict?: PDFDict }).dict;
      return d?.get(PDFName.of("Subtype"))?.toString() === "/Image";
    });
    const w = (imgs[0][1] as unknown as { dict: PDFDict }).dict.get(PDFName.of("Width"))!.toString();
    expect(w).toBe("3000");
  });

  it("honours phone photo orientation (EXIF)", async () => {
    // Stored 1600x1200 with Orientation=6 → displays as portrait.
    const r = await tools.jpgToPdf([await fixture("audit/phone-photo-rotated.jpg")]);
    const page = (await PDFDocument.load(await bytesOf(r.blob!))).getPage(0);
    const { width, height } = page.getSize();
    const rot = page.getRotation().angle % 180 === 90;
    const displayedPortrait = rot ? width > height : height > width;
    expect(displayedPortrait).toBe(true);
    // Orientation 6 means "rotate 90° clockwise": pdf-lib must draw with a clockwise
    // rotation matrix [0 -1 1 0], not counter-clockwise [0 1 -1 0].
    const { transforms, imagesPainted } = await drawOps(await bytesOf(r.blob!));
    expect(imagesPainted).toBe(1);
    expect(transforms.some((t) => t[0] === 0 && t[1] === -1 && t[2] === 1 && t[3] === 0)).toBe(true);
    expect(transforms.some((t) => t[0] === 0 && t[1] === 1 && t[2] === -1 && t[3] === 0)).toBe(false);
  });

  it("accepts PNG", async () => {
    const r = await tools.jpgToPdf([await fixture("audit/graphic.png")]);
    expect(r.success).toBe(true);
  });
});

describe("sign", () => {
  it("embeds the signature image on the chosen page", async () => {
    const png = await fs.readFile(path.join(FIX, "audit/graphic.png"));
    const r = await tools.signPDF(await fixture("smoke/multi-page.pdf"), {
      signatureDataUrl: `data:image/png;base64,${png.toString("base64")}`,
      page: 2,
    });
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    const res = doc.getPage(1).node.Resources();
    const xobj = res?.lookup(PDFName.of("XObject"));
    expect(xobj).toBeTruthy();
  });

  it("places the signature inside the visible area of a rotated, cropped page", async () => {
    const png = await fs.readFile(path.join(FIX, "audit/graphic.png"));
    const r = await tools.signPDF(await fixture("audit/rotated-cropped.pdf"), {
      signatureDataUrl: `data:image/png;base64,${png.toString("base64")}`,
      page: 1,
      x: 0.5,
      yFromTop: 0.5,
      widthRatio: 0.2,
    });
    const bytes = await bytesOf(r.blob!);
    const crop = (await PDFDocument.load(bytes)).getPage(0).getCropBox();
    const { transforms, imagesPainted } = await drawOps(bytes);
    expect(imagesPainted).toBe(1);
    // pdf-lib draws the image as: translate(x, y), rotate, skew (identity), scale.
    // The position is the translation immediately before the rotation.
    const rotIdx = transforms.findIndex((t) => t[0] === 0 && t[1] === 1 && t[2] === -1 && t[3] === 0);
    expect(rotIdx).toBeGreaterThan(0);
    const translate = transforms[rotIdx - 1];
    expect(translate).toBeTruthy();
    const [x, y] = [translate![4], translate![5]];
    expect(x).toBeGreaterThanOrEqual(crop.x);
    expect(x).toBeLessThanOrEqual(crop.x + crop.width);
    expect(y).toBeGreaterThanOrEqual(crop.y);
    expect(y).toBeLessThanOrEqual(crop.y + crop.height);
    // Page is displayed at 90° clockwise, so the image is drawn rotated 90° counter-clockwise to appear upright.
    expect(transforms.some((t) => t[0] === 0 && t[1] === 1 && t[2] === -1 && t[3] === 0)).toBe(true);
  });
});


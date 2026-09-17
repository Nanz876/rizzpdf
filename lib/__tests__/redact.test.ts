// @vitest-environment node
// Redaction must remove content, not just cover it. These tests inspect the output
// bytes (raw and inflated) and pdf.js text extraction, with positive controls on the
// source so a broken check can't pass vacuously.
import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRawStream,
  StandardFonts,
  pushGraphicsState,
  popGraphicsState,
  drawObject,
  decodePDFRawStream,
} from "pdf-lib";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  // The app sets workerSrc to a browser URL; absorb that in tests.
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { findTextBoxes, redactPDF, REDACT_PRESETS, type RedactBox, type PageRenderer } from "@/lib/tools/redact";

const FIX = path.resolve(__dirname, "../../test-fixtures");

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
  return out;
}

/** Raw bytes as latin1, plus every stream body we can inflate. */
function searchableTexts(bytes: Uint8Array): string[] {
  const buf = Buffer.from(bytes);
  const raw = buf.toString("latin1");
  const texts = [raw];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    try {
      texts.push(zlib.inflateSync(buf.subarray(start, end), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString("latin1"));
    } catch {
      /* not flate */
    }
  }
  return texts;
}

function containsSecret(bytes: Uint8Array, secret: string): boolean {
  const hex = Buffer.from(secret, "latin1").toString("hex");
  const utf16 = Buffer.from(secret, "utf16le").swap16().toString("hex");
  return searchableTexts(bytes).some((t) => {
    const lower = t.toLowerCase();
    return t.includes(secret) || lower.includes(hex) || lower.includes(utf16);
  });
}

/** Solid-white RGBA page at the requested scale (node has no canvas). */
const renderCalls: number[] = [];
const whiteRenderer: PageRenderer = async (page, scale) => {
  renderCalls.push(scale);
  const vp = page.getViewport({ scale });
  const width = Math.ceil(vp.width);
  const height = Math.ceil(vp.height);
  return { data: new Uint8ClampedArray(width * height * 4).fill(255), width, height };
};

const SSN = "123-45-6789";
const EMAIL = "jane@example.com";
const ACCOUNT = "9876-5432-1098";
const PAGE2_LINE = `SSN ${SSN} and email ${EMAIL}`;
const TEXT_X = 72;
const TEXT_Y = 500;
const FONT_SIZE = 12;

let sample: File;
let expectedSsnBox: { x: number; y: number; w: number; h: number };

beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.setTitle("Secret Personnel File");
  doc.setAuthor("HR Department");
  doc.setSubject("Confidential");
  doc.setKeywords(["ssn"]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ctx = doc.context;

  const p1 = doc.addPage([612, 792]);
  p1.drawText("Page one public introduction", { x: 72, y: 700, size: 14, font });
  const p2 = doc.addPage([612, 792]);
  p2.drawText(PAGE2_LINE, { x: TEXT_X, y: TEXT_Y, size: FONT_SIZE, font });
  const p3 = doc.addPage([612, 792]);
  p3.drawText("Page three closing remarks", { x: 72, y: 700, size: 14, font });

  // A form XObject drawn on page 2 but also listed (unused) in page 1's resources,
  // as generators that share one resource dictionary across pages do.
  const shared = ctx.register(
    ctx.stream(`BT /FShared 10 Tf 72 400 Td (Account ${ACCOUNT}) Tj ET`, {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, 612, 792],
      Resources: { Font: { FShared: font.ref } },
    })
  );
  p2.node.setXObject(PDFName.of("Shared"), shared);
  p2.pushOperators(pushGraphicsState(), drawObject("Shared"), popGraphicsState());
  p1.node.setXObject(PDFName.of("Shared"), shared);

  // A link on page 1 whose explicit destination references page 2's dictionary.
  const link = ctx.register(
    ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [72, 650, 200, 670], Border: [0, 0, 0], Dest: [p2.ref, "XYZ", null, null, null] })
  );
  p1.node.addAnnot(link);

  // A text form field on page 2 holding the SSN, and one on page 1.
  const form = doc.getForm();
  const f2 = form.createTextField("ssn");
  f2.setText(SSN);
  f2.addToPage(p2, { x: 72, y: 300, width: 200, height: 20 });
  const f1 = form.createTextField("name");
  f1.setText("Jane Public");
  f1.addToPage(p1, { x: 72, y: 600, width: 200, height: 20 });

  const bytes = await doc.save();
  sample = new File([bytes as Uint8Array<ArrayBuffer>], "personnel.pdf", { type: "application/pdf" });

  const prefix = font.widthOfTextAtSize("SSN ", FONT_SIZE);
  const width = font.widthOfTextAtSize(SSN, FONT_SIZE);
  const ascent = font.heightAtSize(FONT_SIZE, { descender: false });
  expectedSsnBox = {
    x: (TEXT_X + prefix) / 612,
    w: width / 612,
    y: (792 - (TEXT_Y + ascent)) / 792,
    h: ascent / 792,
  };
});

describe("findTextBoxes", () => {
  it("finds the SSN once, on page 2, where it was drawn", async () => {
    const boxes = await findTextBoxes(sample, SSN);
    expect(boxes).toHaveLength(1);
    const [b] = boxes;
    expect(b.page).toBe(2);
    const e = expectedSsnBox;
    expect(Math.abs(b.x - e.x)).toBeLessThan(0.012);
    expect(Math.abs(b.w - e.w)).toBeLessThan(0.03);
    expect(Math.abs(b.y - e.y)).toBeLessThan(0.01);
    expect(Math.abs(b.h - e.h)).toBeLessThan(0.015);
    // The box must fully cover the glyphs.
    expect(b.x).toBeLessThanOrEqual(e.x);
    expect(b.x + b.w).toBeGreaterThanOrEqual(e.x + e.w);
    expect(b.y).toBeLessThanOrEqual(e.y);
    expect(b.y + b.h).toBeGreaterThanOrEqual(e.y + e.h);
  });

  it("is case-insensitive and supports whole-word matching", async () => {
    expect(await findTextBoxes(sample, "PAGE ONE")).toHaveLength(1);
    expect(await findTextBoxes(sample, "intro")).toHaveLength(1);
    expect(await findTextBoxes(sample, "intro", { wholeWord: true })).toHaveLength(0);
    expect(await findTextBoxes(sample, "introduction", { wholeWord: true })).toHaveLength(1);
    expect(await findTextBoxes(sample, "   ")).toHaveLength(0);
  });

  it("email preset finds jane@example.com on page 2", async () => {
    const boxes = await findTextBoxes(sample, REDACT_PRESETS.emails());
    expect(boxes).toHaveLength(1);
    expect(boxes[0].page).toBe(2);
  });

  it("phone and card presets match typical formats", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    page.drawText("Call +1 (555) 123-4567 or 020 7946 0958", { x: 50, y: 700, size: 12, font });
    page.drawText("Card 4111 1111 1111 1111 and 5500-0000-0000-0004", { x: 50, y: 650, size: 12, font });
    page.drawText(`SSN ${SSN} dated 2024-01-15`, { x: 50, y: 600, size: 12, font });
    const f = new File([(await doc.save()) as Uint8Array<ArrayBuffer>], "p.pdf", { type: "application/pdf" });
    expect(await findTextBoxes(f, REDACT_PRESETS.phones())).toHaveLength(2);
    expect(await findTextBoxes(f, REDACT_PRESETS.cards())).toHaveLength(2);
  });
});

describe("redactPDF", () => {
  let out: Uint8Array;
  let ssnBox: RedactBox;

  beforeAll(async () => {
    ssnBox = (await findTextBoxes(sample, SSN))[0];
    renderCalls.length = 0;
    const r = await redactPDF(sample, [ssnBox], { renderPage: whiteRenderer });
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);
    expect(r.filename).toBe("personnel_redacted.pdf");
    out = await bytesOf(r.blob!);
  });

  it("positive control: the checks detect the secrets in the source", async () => {
    const src = new Uint8Array(await sample.arrayBuffer());
    expect(containsSecret(src, SSN)).toBe(true);
    expect(containsSecret(src, EMAIL)).toBe(true);
    expect(containsSecret(src, ACCOUNT)).toBe(true);
    const texts = await pageTexts(src);
    expect(texts[1]).toContain(SSN);
    expect(texts[1]).toContain(ACCOUNT);
  });

  it("removes every trace of page 2's text from the output", async () => {
    const texts = await pageTexts(out);
    expect(texts).toHaveLength(3);
    expect(texts[1].trim()).toBe("");
    for (const t of texts) {
      for (const needle of [SSN, EMAIL, ACCOUNT, "SSN", "email", "Account"]) expect(t).not.toContain(needle);
    }
    expect(texts[0]).toContain("Page one public introduction");
    expect(texts[2]).toContain("Page three closing remarks");
    for (const secret of [SSN, EMAIL, ACCOUNT]) expect(containsSecret(out, secret)).toBe(false);
  });

  it("rasterises at >= 200 DPI and paints the box black", async () => {
    expect(renderCalls).toHaveLength(1);
    expect(renderCalls[0]).toBeGreaterThanOrEqual(200 / 72 - 1e-9);
    const doc = await PDFDocument.load(out);
    const page = doc.getPage(1);
    const xobjects = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
    const [[, ref]] = xobjects.entries();
    const img = doc.context.lookup(ref) as PDFRawStream;
    const w = (img.dict.get(PDFName.of("Width")) as unknown as { asNumber(): number }).asNumber();
    const h = (img.dict.get(PDFName.of("Height")) as unknown as { asNumber(): number }).asNumber();
    const px = decodePDFRawStream(img).decode();
    expect(px.length).toBe(w * h * 3);
    const at = (fx: number, fy: number) => {
      const i = (Math.floor(fy * h) * w + Math.floor(fx * w)) * 3;
      return [px[i], px[i + 1], px[i + 2]];
    };
    expect(at(ssnBox.x + ssnBox.w / 2, ssnBox.y + ssnBox.h / 2)).toEqual([0, 0, 0]);
    expect(at(0.9, 0.9)).toEqual([255, 255, 255]);
  });

  it("drops metadata, forms, outline and cross-page references", async () => {
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getSubject()).toBeUndefined();
    expect(doc.getKeywords()).toBeUndefined();
    expect(doc.getCreator()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();
    // Check the catalog before getForm(), which creates an empty AcroForm on demand.
    for (const key of ["AcroForm", "Outlines", "Names", "OpenAction", "Metadata", "AA"]) {
      expect(doc.catalog.get(PDFName.of(key))).toBeUndefined();
    }
    expect(doc.getForm().getFields()).toHaveLength(0);
    const { width, height } = doc.getPage(1).getSize();
    expect([width, height]).toEqual([612, 792]);
    expect(searchableTexts(out).some((t) => /JavaScript/.test(t))).toBe(false);
  });

  it("rejects an empty box list", async () => {
    const r = await redactPDF(sample, [], { renderPage: whiteRenderer });
    expect(r.success).toBe(false);
    expect(r.error).toBe("Mark at least one area to redact.");
  });

  it("uses the displayed size and no rotation for a rotated, cropped page", async () => {
    const r = await redactPDF(await fixture("audit/rotated-cropped.pdf"), [{ page: 1, x: 0.1, y: 0.1, w: 0.3, h: 0.1 }], {
      renderPage: whiteRenderer,
    });
    expect(r.success).toBe(true);
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    const p = doc.getPage(0);
    expect(p.getSize()).toEqual({ width: 720, height: 540 });
    expect(p.getRotation().angle).toBe(0);
    expect((await pageTexts(await bytesOf(r.blob!)))[1]).toContain("Normal page");
  });

  it("handles restriction-encrypted input and explains password-locked input", async () => {
    const ok = await redactPDF(await fixture("audit/owner-restricted.pdf"), [{ page: 1, x: 0, y: 0, w: 0.5, h: 0.2 }], {
      renderPage: whiteRenderer,
    });
    expect(ok.success).toBe(true);
    const locked = await redactPDF(await fixture("audit/user-password.pdf"), [{ page: 1, x: 0, y: 0, w: 0.5, h: 0.2 }], {
      renderPage: whiteRenderer,
    });
    expect(locked.success).toBe(false);
    expect(locked.error).toMatch(/password-protected.*Unlock/i);
  });
});

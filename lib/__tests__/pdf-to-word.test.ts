// @vitest-environment node
// Covers the image + table additions to PDF to Word. Runs in the Node
// environment (like the rest of the PDF suite) because canvas isn't
// available under jsdom either — see CLAUDE.md's note on canvas-only tools.
// A minimal `document.createElement("canvas")` stub below stands in for the
// real browser Canvas API so the actual image-extraction code path (not a
// parallel test-only implementation) gets exercised.
import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import * as tools from "@/lib/pdf-tools";

const FIX = path.resolve(__dirname, "../../test-fixtures");

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function docXml(r: { blob?: Blob }) {
  const zip = await JSZip.loadAsync(await bytesOf(r.blob!));
  return zip.file("word/document.xml")!.async("string");
}

// ─── Minimal canvas stub ────────────────────────────────────────────────────
// Just enough of the Canvas 2D API for lib/tools/pdf-to-word.ts's image path:
// createImageData / putImageData / toBlob. toBlob PNG-encodes for real (with
// node:zlib) so the resulting .docx contains a genuine, decodable PNG.

type FakeImageData = { width: number; height: number; data: Uint8ClampedArray };

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    crc ^= buf[n];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodePngRGBA(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

class FakeCanvas2DContext {
  constructor(private canvas: FakeCanvas) {}
  createImageData(w: number, h: number): FakeImageData {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
  putImageData(imageData: FakeImageData) {
    this.canvas.pixels = imageData;
  }
  drawImage() {
    // Not exercised: pdfjs's legacy/Node build never returns an ImageBitmap-backed object.
  }
}

class FakeCanvas {
  width = 0;
  height = 0;
  pixels: FakeImageData | null = null;
  getContext(type: string) {
    return type === "2d" ? new FakeCanvas2DContext(this) : null;
  }
  toBlob(cb: (b: Blob | null) => void, type?: string) {
    if (!this.pixels) return cb(null);
    const png = encodePngRGBA(this.pixels.width, this.pixels.height, this.pixels.data);
    cb(new Blob([new Uint8Array(png)], { type: type ?? "image/png" }));
  }
}

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).document = {
    createElement(tag: string) {
      if (tag === "canvas") return new FakeCanvas();
      throw new Error(`pdf-to-word test stub: unsupported tag "${tag}"`);
    },
  };
});

describe("pdf to word: tables", () => {
  it("turns an aligned grid of text into a real Word table", async () => {
    const r = await tools.pdfToWord(await fixture("audit/table-doc.pdf"));
    expect(r.success).toBe(true);
    const xml = await docXml(r);

    const tblMatch = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
    expect(tblMatch).toBeTruthy();
    const tbl = tblMatch![0];
    const cellTexts = [...tbl.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((m) =>
      [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("")
    );
    expect(cellTexts).toEqual(
      expect.arrayContaining(["Item", "Qty", "Price", "Widget", "3", "9.00", "Gadget", "1", "25.00", "Gizmo", "2", "14.50"])
    );

    // The heading and trailing paragraph aren't part of the grid, so they must
    // stay outside the table as ordinary paragraphs.
    const outsideTable = xml.replace(tbl, "");
    expect(outsideTable).toContain("Order Summary");
    expect(outsideTable).toContain("Thank you for your order.");
  });

  it("does not invent a table out of ordinary paragraphs", async () => {
    const r = await tools.pdfToWord(await fixture("audit/structured-doc.pdf"));
    expect(r.success).toBe(true);
    const xml = await docXml(r);
    expect(xml).not.toMatch(/<w:tbl>/);
  });
});

/** A letter page with a line of text and a 200x150 JPEG drawn at 300x225pt. */
async function smallPhotoPdf(): Promise<File> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const jpeg = require("jpeg-js");
  const w = 200;
  const h = 150;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = x;
      data[i + 1] = y;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  // Copy into a fresh array: jpeg-js returns a Buffer that is a view into a
  // shared pool, and pdf-lib reads the underlying memory without its offset.
  const jpg = new Uint8Array(jpeg.encode({ data, width: w, height: h }, 85).data);

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("A page with a photo on it.", { x: 72, y: 720, size: 14, font });
  const img = await doc.embedJpg(jpg);
  page.drawImage(img, { x: 72, y: 400, width: 300, height: 225 });
  return new File([new Uint8Array(await doc.save())], "small-photo.pdf", { type: "application/pdf" });
}

describe("pdf to word: images", () => {
  // A real JPEG photo on a text page, built small on purpose. The 3.4 MB
  // audit photo took ~4.6s of a 5s budget on its own — the canvas stub encodes
  // PNGs in pure JS, so cost scales with pixel count — and any parallel load
  // timed it out. Same path end to end, a fraction of the pixels.
  it("embeds a page image as a media file in the docx", async () => {
    const r = await tools.pdfToWord(await smallPhotoPdf());
    expect(r.success).toBe(true);
    const zip = await JSZip.loadAsync(await bytesOf(r.blob!));
    const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/") && !zip.files[n].dir);
    expect(media.length).toBeGreaterThan(0);
    const bytes = await zip.file(media[0])!.async("uint8array");
    // PNG signature
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const xml = await docXml(r);
    expect(xml).toMatch(/<w:drawing>/);
  });
});

describe("pdf to word: scanned PDFs", () => {
  it("still reports no selectable text instead of an empty/broken docx", async () => {
    const r = await tools.pdfToWord(await fixture("audit/scanned-no-text.pdf"));
    expect(r.success ? r.warning : r.error).toMatch(/scan|no (selectable )?text|OCR/i);
  });
});

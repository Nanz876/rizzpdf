// @vitest-environment node
// The DPI-aware compression logic: an image is only downsampled when it's
// over-resolution for where it sits on the page, and only to the target DPI.
// collectImagePlacements (pdf.js operator walk) runs in Node; the canvas
// re-encode is covered by the in-browser smoke test.
import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);
vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { imageScale, collectImagePlacements, type CompressSettings } from "@/lib/pdf-tools";

const MEDIUM: CompressSettings = { maxEdge: 2200, quality: 0.75, flateMaxRatio: 0.6, dpiTarget: 150, dpiThreshold: 200 };

/** A flate PNG of the given pixel size (solid colour) that pdf-lib can embed and pdf.js can read. */
function png(wPx: number, hPx: number): Uint8Array {
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const stride = wPx * 4;
  const raw = Buffer.alloc((stride + 1) * hPx);
  for (let y = 0; y < hPx; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < wPx; x++) {
      const i = y * (stride + 1) + 1 + x * 4;
      raw[i] = 120; raw[i + 1] = 160; raw[i + 2] = 200; raw[i + 3] = 255;
    }
  }
  const crc32 = (buf: Buffer) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(wPx, 0); ihdr.writeUInt32BE(hPx, 4); ihdr[8] = 8; ihdr[9] = 6;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
}

describe("imageScale", () => {
  it("leaves an image at/under the DPI threshold untouched", () => {
    // 1000px drawn across 500pt ≈ 144 DPI (< 200) → no downsample.
    expect(imageScale(1000, 1000, MEDIUM, { wPt: 500, hPt: 500 })).toBe(1);
  });
  it("downsamples an over-resolution image to the target DPI", () => {
    // 1200px drawn across 100pt ≈ 864 DPI (> 200) → scale to 150/864.
    const s = imageScale(1200, 1200, MEDIUM, { wPt: 100, hPt: 100 });
    expect(s).toBeCloseTo(150 / 864, 3);
    expect(Math.round(1200 * s)).toBe(208); // 150-DPI worth of pixels for 100pt
  });
  it("falls back to the maxEdge cap when placement is unknown", () => {
    expect(imageScale(4400, 4400, MEDIUM, undefined)).toBeCloseTo(2200 / 4400, 5);
  });
});

describe("collectImagePlacements", () => {
  it("reports the on-page draw size of an image, keyed by pixel dims", async () => {
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(png(300, 200));
    const page = doc.addPage([612, 792]);
    page.drawImage(img, { x: 40, y: 40, width: 240, height: 160 });
    const bytes = await doc.save();
    const map = await collectImagePlacements(new Uint8Array(bytes));
    const place = map.get("300x200");
    expect(place).toBeTruthy();
    expect(place!.wPt).toBeCloseTo(240, 0);
    expect(place!.hPt).toBeCloseTo(160, 0);
  });

  it("keeps the largest placement when an image is reused at different sizes", async () => {
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(png(256, 256));
    const p1 = doc.addPage([612, 792]);
    p1.drawImage(img, { x: 10, y: 10, width: 80, height: 80 });
    const p2 = doc.addPage([612, 792]);
    p2.drawImage(img, { x: 10, y: 10, width: 400, height: 400 });
    const map = await collectImagePlacements(new Uint8Array(await doc.save()));
    const place = map.get("256x256");
    expect(place!.wPt).toBeCloseTo(400, 0); // the bigger placement wins
  });
});

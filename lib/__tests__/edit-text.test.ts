// @vitest-environment node
// Editing text is cover-and-redraw: the old line must be gone from the extracted
// text and the new string must really be in the page's content stream. These tests
// check both, plus the geometry that makes a replacement land where it should.
import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  // The app sets workerSrc to a browser URL; absorb that in tests.
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import {
  findEditableText,
  applyTextEdits,
  sampleBackgroundColor,
  closestStandardFont,
  NO_EDITS_MESSAGE,
  type EditableTextLine,
  type TextRect,
} from "@/lib/tools/edit-text";

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
  await doc.destroy();
  return out;
}

/** Every content stream body we can inflate, plus the raw bytes. */
function streamTexts(bytes: Uint8Array): string[] {
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
      texts.push(
        zlib.inflateSync(buf.subarray(start, end), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString("latin1")
      );
    } catch {
      /* not flate */
    }
  }
  return texts;
}

/** pdf-lib writes drawn text as a hex string, so look for both spellings. */
function spellings(needle: string): string[] {
  return [needle, Buffer.from(needle, "latin1").toString("hex")];
}

function findInStream(bytes: Uint8Array, needle: string): { text: string; at: number } | null {
  for (const text of streamTexts(bytes)) {
    for (const spelling of spellings(needle)) {
      const at = text.toLowerCase().indexOf(spelling.toLowerCase());
      if (at >= 0) return { text, at };
    }
  }
  return null;
}

const inContentStream = (bytes: Uint8Array, needle: string) => !!findInStream(bytes, needle);

/** Font size of the last Tf operator before `needle` in the stream that draws it. */
function fontSizeBefore(bytes: Uint8Array, needle: string): number | null {
  const hit = findInStream(bytes, needle);
  if (!hit) return null;
  const matches = [...hit.text.slice(0, hit.at).matchAll(/\/[^\s/]+\s+([\d.]+)\s+Tf/g)];
  return matches.length ? parseFloat(matches[matches.length - 1][1]) : null;
}

const OLD_LINE = "Invoice total: 1,250.00 USD";
const OTHER_LINE = "Thank you for your business";

let sample: File;
let lines: EditableTextLine[];
let target: EditableTextLine;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  page.drawText(OLD_LINE, { x: 72, y: 700, size: 14, font });
  page.drawText(OTHER_LINE, { x: 72, y: 660, size: 11, font: bold, color: rgb(0.8, 0.1, 0.1) });
  const bytes = await doc.save();
  sample = new File([bytes as Uint8Array<ArrayBuffer>], "invoice.pdf", { type: "application/pdf" });

  lines = await findEditableText(sample);
  target = lines.find((l) => l.text === OLD_LINE)!;
});

describe("findEditableText", () => {
  it("returns each line with its box, size and style", () => {
    expect(lines.map((l) => l.text)).toEqual([OLD_LINE, OTHER_LINE]);
    expect(target.page).toBe(1);
    expect(target.fontSize).toBeCloseTo(14, 1);
    expect(target.bold).toBe(false);
    expect(target.family).toBe("sans");
    // Drawn at x=72, baseline y=700 on a 612x792 page.
    expect(target.box.x).toBeGreaterThan(0.09);
    expect(target.box.x).toBeLessThan(0.12);
    expect(target.box.y).toBeGreaterThan(0.09);
    expect(target.box.y).toBeLessThan(0.115);
    expect(target.box.width).toBeGreaterThan(0.2);
    expect(target.box.height).toBeGreaterThan(0.015);

    const other = lines.find((l) => l.text === OTHER_LINE)!;
    expect(other.bold).toBe(true);
    expect(other.color.r).toBeGreaterThan(0.5);
    expect(other.color.g).toBeLessThan(0.3);
  });

  it("picks a matching standard font for the detected style", () => {
    expect(closestStandardFont("sans", false, false)).toBe("Helvetica");
    expect(closestStandardFont("sans", true, true)).toBe("Helvetica-BoldOblique");
    expect(closestStandardFont("serif", true, false)).toBe("Times-Bold");
    expect(closestStandardFont("mono", false, true)).toBe("Courier-Oblique");
  });
});

describe("applyTextEdits", () => {
  it("replaces a line: the old text is gone, the new text is real page text", async () => {
    const replacement = "Invoice total: 980.00 USD";
    const r = await applyTextEdits(sample, [
      {
        page: target.page,
        box: target.box,
        text: replacement,
        fontSize: target.fontSize,
        bold: target.bold,
        italic: target.italic,
        family: target.family,
        color: target.color,
      },
    ]);
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);
    expect(r.filename).toBe("invoice_edited.pdf");

    const out = await bytesOf(r.blob!);
    const [text] = await pageTexts(out);
    expect(text).toContain(replacement);
    expect(text).not.toContain(OLD_LINE);
    expect(text).toContain(OTHER_LINE); // untouched lines survive
    // ...and the replacement is really drawn into the content stream.
    expect(inContentStream(out, replacement)).toBe(true);
  });

  it("covering with empty text just removes the line", async () => {
    const r = await applyTextEdits(sample, [{ page: 1, box: target.box, text: "" }]);
    expect(r.success).toBe(true);
    const [text] = await pageTexts(await bytesOf(r.blob!));
    expect(text).not.toContain(OLD_LINE);
    expect(text).toContain(OTHER_LINE);
  });

  it("shrinks long replacement text so it fits the box width", async () => {
    const long = "Invoice total: 1,250.00 USD plus shipping, handling and applicable sales tax";
    const r = await applyTextEdits(sample, [
      { page: 1, box: target.box, text: long, fontSize: target.fontSize },
    ]);
    expect(r.success).toBe(true);
    const out = await bytesOf(r.blob!);
    const size = fontSizeBefore(out, long);
    expect(size).not.toBeNull();
    expect(size!).toBeLessThan(target.fontSize - 1);
    expect(size!).toBeGreaterThanOrEqual(4);

    // The drawn text stays inside the original box.
    const doc = await openPdfjs(out);
    const content = await (await doc.getPage(1)).getTextContent();
    const item = content.items.find((it) => "str" in it && it.str.startsWith("Invoice total: 1,250.00 USD plus")) as
      | { transform: number[]; width: number }
      | undefined;
    await doc.destroy();
    expect(item).toBeDefined();
    const left = item!.transform[4] / 612;
    const right = (item!.transform[4] + item!.width) / 612;
    expect(left).toBeGreaterThanOrEqual(target.box.x - 0.01);
    expect(right).toBeLessThanOrEqual(target.box.x + target.box.width + 0.01);
  });

  it("adds a new text box on a rotated, cropped page", async () => {
    const file = await fixture("audit/rotated-cropped.pdf");
    const added = "Added by RizzPDF";
    const box: TextRect = { x: 0.1, y: 0.05, width: 0.4, height: 0.04 };
    const r = await applyTextEdits(file, [{ page: 1, box, text: added, cover: false, fontSize: 14 }]);
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);

    const out = await bytesOf(r.blob!);
    expect((await pageTexts(out))[0]).toContain(added);

    // Page 1 is /Rotate 90 with a crop box: 720x540 as displayed. The new text must
    // read upright in that displayed frame, i.e. near its top-left corner.
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    const p = doc.getPage(0);
    expect(p.getRotation().angle).toBe(90);

    const lines = await findEditableText(new File([out as Uint8Array<ArrayBuffer>], "r.pdf", { type: "application/pdf" }));
    const line = lines.find((l) => l.page === 1 && l.text.includes(added))!;
    expect(line).toBeDefined();
    expect(Math.abs(line.box.x - box.x)).toBeLessThan(0.02);
    expect(Math.abs(line.box.y - box.y)).toBeLessThan(0.05);
  });

  it("leaves the lines directly above and below a tightly spaced edit alone", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([400, 200]);
    const rows = ["First row of the table", "Second row of the table", "Third row of the table"];
    rows.forEach((row, i) => page.drawText(row, { x: 30, y: 150 - i * 14, size: 11, font }));
    // A second column that shares the middle row's baseline.
    page.drawText("42.00", { x: 300, y: 136, size: 11, font });
    const file = new File([(await doc.save()) as Uint8Array<ArrayBuffer>], "rows.pdf", { type: "application/pdf" });

    const found = await findEditableText(file);
    const middle = found.find((l) => l.text.startsWith("Second row"))!;
    expect(middle).toBeDefined();
    const r = await applyTextEdits(file, [
      { page: 1, box: middle.box, text: "Second row replaced", fontSize: middle.fontSize },
    ]);
    expect(r.success).toBe(true);
    const [text] = await pageTexts(await bytesOf(r.blob!));
    expect(text).toContain("Second row replaced");
    expect(text).not.toContain("Second row of the table");
    expect(text).toContain(rows[0]);
    expect(text).toContain(rows[2]);
    expect(text).toContain("42.00"); // the neighbouring column shares the baseline
  });

  it("rejects an empty edit list", async () => {
    const r = await applyTextEdits(sample, []);
    expect(r.success).toBe(false);
    expect(r.error).toBe(NO_EDITS_MESSAGE);
  });

  it("handles restriction-encrypted input and explains password-locked input", async () => {
    const box: TextRect = { x: 0.1, y: 0.1, width: 0.3, height: 0.03 };
    const ok = await applyTextEdits(await fixture("audit/owner-restricted.pdf"), [{ page: 1, box, text: "Hello" }]);
    expect(ok.success).toBe(true);

    const locked = await applyTextEdits(await fixture("audit/user-password.pdf"), [{ page: 1, box, text: "Hello" }]);
    expect(locked.success).toBe(false);
    expect(locked.error).toMatch(/password-protected.*Unlock/i);
  });
});

describe("sampleBackgroundColor", () => {
  /** A canvas stand-in: solid `bg` everywhere, `fg` inside the text box. */
  function fakeCanvas(width: number, height: number, bg: number[], fg: number[], box: TextRect) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inBox =
          x >= box.x * width && x < (box.x + box.width) * width && y >= box.y * height && y < (box.y + box.height) * height;
        const [r, g, b] = inBox ? fg : bg;
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    return {
      width,
      height,
      getContext: () => ({
        getImageData: (sx: number, sy: number, sw: number, sh: number) => {
          const out = new Uint8ClampedArray(sw * sh * 4);
          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const src = ((sy + y) * width + sx + x) * 4;
              out.set(data.subarray(src, src + 4), (y * sw + x) * 4);
            }
          }
          return { data: out };
        },
      }),
    } as unknown as HTMLCanvasElement;
  }

  const box: TextRect = { x: 0.3, y: 0.4, width: 0.3, height: 0.1 };

  it("reads the colour around the box, not the text inside it", () => {
    const canvas = fakeCanvas(200, 200, [255, 240, 200], [0, 0, 0], box);
    const c = sampleBackgroundColor(canvas, box);
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBeCloseTo(240 / 255, 2);
    expect(c.b).toBeCloseTo(200 / 255, 2);
  });

  it("falls back to white when the pixels can't be read", () => {
    const broken = {
      width: 100,
      height: 100,
      getContext: () => {
        throw new Error("tainted");
      },
    } as unknown as HTMLCanvasElement;
    expect(sampleBackgroundColor(broken, box)).toEqual({ r: 1, g: 1, b: 1 });
    expect(sampleBackgroundColor({ width: 0, height: 0 } as unknown as HTMLCanvasElement, box)).toEqual({
      r: 1,
      g: 1,
      b: 1,
    });
  });

  it("covers a coloured background with that colour", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 200]);
    page.drawRectangle({ x: 0, y: 0, width: 300, height: 200, color: rgb(1, 240 / 255, 200 / 255) });
    page.drawText("Old value", { x: 40, y: 100, size: 12, font });
    const file = new File([(await doc.save()) as Uint8Array<ArrayBuffer>], "c.pdf", { type: "application/pdf" });

    const [line] = await findEditableText(file);
    const bg = sampleBackgroundColor(
      fakeCanvas(300, 200, [255, 240, 200], [0, 0, 0], line.box),
      line.box
    );
    const r = await applyTextEdits(file, [
      { page: 1, box: line.box, text: "New value", fontSize: line.fontSize, background: bg },
    ]);
    expect(r.success).toBe(true);
    const out = await bytesOf(r.blob!);
    // The cover rectangle is filled with the sampled colour, not plain white.
    expect(streamTexts(out).some((t) => /1\s+0\.9411\d*\s+0\.7843\d*\s+rg/.test(t))).toBe(true);
    expect((await pageTexts(out))[0]).toContain("New value");
  });
});

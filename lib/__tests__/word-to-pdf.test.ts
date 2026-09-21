// @vitest-environment node
// Word to PDF promises real, selectable text — not a picture of a document —
// with the structure of the .docx re-created. These tests build .docx files
// with the `docx` package (so what goes in is unambiguous), convert them, and
// then read the output back two ways:
//   * pdf.js text extraction, for what the reader sees and where it sits;
//   * the raw content stream, for which font each glyph run was drawn with.
// Runs in the Node environment like the rest of the PDF suite.
import { describe, it, expect, vi } from "vitest";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, PDFString } from "pdf-lib";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { wordToPdf, DOC_FORMAT_MESSAGE } from "@/lib/tools/word-to-pdf";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

// ─── Building .docx inputs ──────────────────────────────────────────────────

type DocxModule = typeof import("docx");

/** Build a .docx File from a callback given the `docx` module. */
async function makeDocx(
  build: (d: DocxModule) => { children: unknown[]; numbering?: unknown },
  name = "sample.docx"
): Promise<File> {
  const docx = await import("docx");
  const { children, numbering } = build(docx);
  const doc = new docx.Document({
    ...(numbering ? { numbering: numbering as never } : {}),
    sections: [{ children: children as never[] }],
  });
  const buf = await docx.Packer.toBuffer(doc);
  return new File([new Uint8Array(buf)], name, { type: DOCX_MIME });
}

/** A real 4x4 PNG, so the image path embeds something pdf-lib can actually decode. */
function tinyPng(): Uint8Array {
  const w = 4;
  const h = 4;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (stride + 1) + 1 + x * 4;
      raw[i] = 200;
      raw[i + 1] = 40;
      raw[i + 2] = 60;
      raw[i + 3] = 255;
    }
  }
  const crc32 = (buf: Buffer) => {
    let crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      crc ^= buf[n];
      for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ])
  );
}

// ─── Reading the PDF back ───────────────────────────────────────────────────

async function openPdfjs(bytes: Uint8Array) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return real.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

interface PlacedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  page: number;
  pageW: number;
  pageH: number;
}

async function placedItems(bytes: Uint8Array): Promise<PlacedItem[]> {
  const doc = await openPdfjs(bytes);
  const out: PlacedItem[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const [x0, y0, x1, y1] = page.view;
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!("str" in it) || !it.str.length) continue;
      out.push({
        str: it.str,
        x: it.transform[4] - x0,
        y: it.transform[5] - y0,
        width: it.width,
        page: i,
        pageW: x1 - x0,
        pageH: y1 - y0,
      });
    }
  }
  return out;
}

/**
 * Text as a reader sees it, rebuilt line by line: every drawn piece is its own
 * pdf.js item (spaces included), so items are grouped by baseline and joined in
 * x order rather than blindly concatenated.
 */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const items = await placedItems(bytes);
  const pages = new Map<number, Map<string, PlacedItem[]>>();
  for (const it of items) {
    const byLine = pages.get(it.page) ?? new Map<string, PlacedItem[]>();
    const key = it.y.toFixed(1);
    byLine.set(key, [...(byLine.get(key) ?? []), it]);
    pages.set(it.page, byLine);
  }
  const maxPage = Math.max(0, ...pages.keys());
  const out: string[] = [];
  for (let p = 1; p <= maxPage; p++) {
    const byLine = pages.get(p) ?? new Map<string, PlacedItem[]>();
    const lines = [...byLine.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, line]) => line.sort((a, b) => a.x - b.x).map((i) => i.str).join(""));
    out.push(lines.join("\n"));
  }
  return out;
}

/** WinAnsi bytes 0x80–0x9F that don't line up with Latin-1 (curly quotes, bullets, dashes). */
const WINANSI_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†",
  0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ",
  0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
  0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

const fromWinAnsi = (bytes: Buffer) =>
  [...bytes].map((b) => WINANSI_HIGH[b] ?? String.fromCharCode(b)).join("");

function streamText(doc: PDFDocument, pageIndex: number): string {
  const page = doc.getPage(pageIndex);
  const contents = page.node.get(PDFName.of("Contents"));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  const parts: string[] = [];
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    let bytes = Buffer.from(stream.getContents());
    const filter = stream.dict.get(PDFName.of("Filter"));
    if (filter && filter.toString().includes("FlateDecode")) bytes = zlib.inflateSync(bytes);
    parts.push(bytes.toString("latin1"));
  }
  return parts.join("\n");
}

/** Every `Tj` on a page, with the BaseFont name it was drawn with. */
function glyphRuns(doc: PDFDocument, pageIndex: number): { text: string; font: string }[] {
  const page = doc.getPage(pageIndex);
  const resources = page.node.get(PDFName.of("Resources"));
  const fontDict = (resources instanceof PDFDict ? doc.context.lookup(resources.get(PDFName.of("Font"))) : undefined) as
    | PDFDict
    | undefined;
  const baseFonts = new Map<string, string>();
  fontDict?.entries().forEach(([key, value]) => {
    const f = doc.context.lookup(value instanceof PDFRef ? value : value) as PDFDict | undefined;
    const base = f?.get(PDFName.of("BaseFont"));
    baseFonts.set(key.asString().replace(/^\//, ""), base ? base.toString().replace(/^\//, "") : "?");
  });

  const stream = streamText(doc, pageIndex);
  const re = /\/([A-Za-z0-9_+.-]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  const runs: { text: string; font: string }[] = [];
  let font = "?";
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream))) {
    if (m[1]) {
      font = baseFonts.get(m[1]) ?? m[1];
    } else if (m[2]) {
      runs.push({ text: fromWinAnsi(Buffer.from(m[2], "hex")), font });
    } else if (m[3] !== undefined) {
      runs.push({ text: fromWinAnsi(Buffer.from(m[3].replace(/\\([()\\])/g, "$1"), "latin1")), font });
    }
  }
  return runs;
}

async function convert(file: File, opts?: Parameters<typeof wordToPdf>[1]) {
  const r = await wordToPdf(file, opts);
  if (!r.success) throw new Error(`conversion failed: ${r.error}`);
  const bytes = await bytesOf(r.blob!);
  return { result: r, bytes, doc: await PDFDocument.load(bytes) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("word to pdf: text and structure", () => {
  it("keeps headings and paragraphs, in document order", async () => {
    const file = await makeDocx(({ Paragraph, HeadingLevel, TextRun }) => ({
      children: [
        new Paragraph({ text: "Quarterly Report", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun("Revenue grew steadily across every region.")] }),
        new Paragraph({ text: "Outlook", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun("We expect the trend to continue.")] }),
      ],
    }));
    const { result, bytes } = await convert(file);
    expect(result.filename).toBe("sample.pdf");

    const text = (await pageTexts(bytes)).join(" ").replace(/\s+/g, " ");
    for (const s of ["Quarterly Report", "Revenue grew steadily across every region.", "Outlook", "We expect the trend to continue."]) {
      expect(text).toContain(s);
    }
    expect(text.indexOf("Quarterly Report")).toBeLessThan(text.indexOf("Revenue grew"));
    expect(text.indexOf("Revenue grew")).toBeLessThan(text.indexOf("Outlook"));
    expect(text.indexOf("Outlook")).toBeLessThan(text.indexOf("We expect"));

    // A heading has to look like a heading: bigger than the body text.
    const items = await placedItems(bytes);
    const heading = items.find((i) => i.str.includes("Quarterly"))!;
    const body = items.find((i) => i.str.includes("Revenue"))!;
    expect(heading.y).toBeGreaterThan(body.y);
  });

  it("draws bold, italic and underlined runs with the matching font", async () => {
    const file = await makeDocx(({ Paragraph, TextRun }) => ({
      children: [
        new Paragraph({
          children: [
            new TextRun("Plainword "),
            new TextRun({ text: "Boldword", bold: true }),
            new TextRun(" "),
            new TextRun({ text: "Italicword", italics: true }),
            new TextRun(" "),
            new TextRun({ text: "Underword", underline: {} }),
          ],
        }),
      ],
    }));
    const { doc, bytes } = await convert(file);
    const runs = glyphRuns(doc, 0);
    const fontOf = (word: string) => runs.find((r) => r.text.includes(word))?.font;

    expect(fontOf("Plainword")).toBe("Helvetica");
    expect(fontOf("Boldword")).toBe("Helvetica-Bold");
    expect(fontOf("Italicword")).toBe("Helvetica-Oblique");
    expect(fontOf("Underword")).toBe("Helvetica");

    // The underlined word is drawn as text with a rule under it, not as a picture.
    expect((await pageTexts(bytes))[0]).toContain("Underword");
    const stream = streamText(doc, 0);
    expect(stream).toMatch(/ re\b|\bl\b/); // a line/rect op exists for the underline
  });

  it("keeps bullets and numbers on lists, including one level of nesting", async () => {
    const file = await makeDocx(({ Paragraph, LevelFormat, AlignmentType }) => ({
      numbering: {
        config: [
          {
            reference: "steps",
            levels: [
              { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT },
              { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2.", alignment: AlignmentType.LEFT },
            ],
          },
        ],
      },
      children: [
        new Paragraph({ text: "Apples", bullet: { level: 0 } }),
        new Paragraph({ text: "Pears", bullet: { level: 0 } }),
        new Paragraph({ text: "Conference", bullet: { level: 1 } }),
        new Paragraph({ text: "Preheat", numbering: { reference: "steps", level: 0 } }),
        new Paragraph({ text: "Combine", numbering: { reference: "steps", level: 0 } }),
        new Paragraph({ text: "Slowly", numbering: { reference: "steps", level: 1 } }),
      ],
    }));
    const { doc, bytes } = await convert(file);
    const runs = glyphRuns(doc, 0);
    const markers = runs.map((r) => r.text);

    expect(markers.filter((t) => t === "•").length).toBe(2); // two top-level bullets
    expect(markers).toContain("·"); // the nested bullet uses a different glyph
    expect(markers).toContain("1.");
    expect(markers).toContain("2.");
    expect(markers).toContain("a."); // nested ordered item

    const items = await placedItems(bytes);
    const top = items.find((i) => i.str.startsWith("Apples"))!;
    const nested = items.find((i) => i.str.startsWith("Conference"))!;
    expect(nested.x).toBeGreaterThan(top.x); // nesting is visible as indentation

    const text = (await pageTexts(bytes)).join(" ");
    for (const s of ["Apples", "Pears", "Conference", "Preheat", "Combine", "Slowly"]) expect(text).toContain(s);
  });

  it("re-creates a table, with wrapped cell text and borders", async () => {
    const long = "A description long enough that it has to wrap onto more than one line inside its cell.";
    const file = await makeDocx(({ Paragraph, Table, TableRow, TableCell }) => ({
      children: [
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Item")] }),
                new TableCell({ children: [new Paragraph("Qty")] }),
                new TableCell({ children: [new Paragraph("Notes")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Widget")] }),
                new TableCell({ children: [new Paragraph("3")] }),
                new TableCell({ children: [new Paragraph(long)] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Gizmo")] }),
                new TableCell({ children: [new Paragraph("12")] }),
                new TableCell({ children: [new Paragraph("Backordered")] }),
              ],
            }),
          ],
        }),
      ],
    }));
    const { doc, bytes } = await convert(file);
    const text = (await pageTexts(bytes)).join(" ").replace(/\s+/g, " ");
    for (const s of ["Item", "Qty", "Notes", "Widget", "3", "Gizmo", "12", "Backordered"]) expect(text).toContain(s);
    expect(text).toContain("A description long enough");
    expect(text).toContain("inside its cell.");

    // The long cell wrapped rather than spilling: its words sit on several
    // baselines, all inside the column the header "Notes" starts.
    const items = await placedItems(bytes);
    const notes = items.find((i) => i.str === "Notes")!;
    const longCell = items.filter((i) => /description|wrap|inside|cell/.test(i.str));
    expect(new Set(longCell.map((i) => Math.round(i.y))).size).toBeGreaterThan(1);
    for (const i of longCell) {
      expect(i.x).toBeGreaterThanOrEqual(notes.x - 0.5);
      expect(i.x + i.width).toBeLessThanOrEqual(612 - 72 + 0.5);
    }

    // Cell borders are stroked paths, one per cell (9 here), not an image.
    const strokes = [...streamText(doc, 0).matchAll(/\bS\b/g)];
    expect(strokes.length).toBeGreaterThanOrEqual(9);
  });

  it("draws hyperlinks as blue underlined text with a working link annotation", async () => {
    const file = await makeDocx(({ Paragraph, TextRun, ExternalHyperlink }) => ({
      children: [
        new Paragraph({
          children: [
            new TextRun("See "),
            new ExternalHyperlink({ children: [new TextRun("RizzPDF")], link: "https://www.rizzpdf.com/tools" }),
            new TextRun(" for more."),
          ],
        }),
      ],
    }));
    const { doc, bytes } = await convert(file);
    expect((await pageTexts(bytes))[0]).toContain("RizzPDF");

    const annots = doc.getPage(0).node.Annots()!.asArray();
    expect(annots.length).toBeGreaterThan(0);
    const annot = doc.context.lookup(annots[0]) as PDFDict;
    expect(annot.get(PDFName.of("Subtype"))!.toString()).toBe("/Link");
    const action = doc.context.lookup(annot.get(PDFName.of("A"))) as PDFDict;
    const uri = action.get(PDFName.of("URI")) as PDFString;
    expect(uri.decodeText()).toBe("https://www.rizzpdf.com/tools");

    // Blue fill colour set somewhere on the page (rg with a dominant blue channel).
    const stream = streamText(doc, 0);
    const blues = [...stream.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)].map((m) => m.slice(1).map(Number));
    expect(blues.some(([r, g, b]) => b > 0.5 && b > r && b > g)).toBe(true);
  });

  it("embeds pictures from the document", async () => {
    const png = tinyPng();
    const file = await makeDocx(({ Paragraph, ImageRun }) => ({
      children: [
        new Paragraph({ text: "Below is a picture." }),
        new Paragraph({
          children: [new ImageRun({ type: "png", data: png, transformation: { width: 120, height: 120 } })],
        }),
      ],
    }));
    const { doc, bytes } = await convert(file);
    expect((await pageTexts(bytes))[0]).toContain("Below is a picture.");

    const resources = doc.getPage(0).node.get(PDFName.of("Resources")) as PDFDict;
    const xobjects = doc.context.lookup(resources.get(PDFName.of("XObject"))) as PDFDict | undefined;
    const images = xobjects
      ? xobjects.values().filter((v) => {
          const s = doc.context.lookup(v);
          return s instanceof PDFRawStream && s.dict.get(PDFName.of("Subtype"))?.toString() === "/Image";
        })
      : [];
    expect(images.length).toBeGreaterThan(0);
  });
});

describe("word to pdf: pagination", () => {
  it("flows a long document onto several pages, always inside the margins", async () => {
    const MARGIN = 54;
    const file = await makeDocx(({ Paragraph, HeadingLevel }) => ({
      children: [
        new Paragraph({ text: "A Long Document", heading: HeadingLevel.HEADING_1 }),
        ...Array.from({ length: 90 }, (_, i) =>
          new Paragraph(
            `Paragraph ${i + 1}: this sentence is deliberately wordy so that the paragraph wraps ` +
              "over more than one line and the document runs past the bottom of a single page."
          )
        ),
        new Paragraph("Supercalifragilisticexpialidociousantidisestablishmentarianismpneumonoultramicroscopicsilicovolcanoconiosis"),
      ],
    }));
    const { bytes } = await convert(file, { pageSize: "A4", margin: MARGIN });

    const items = await placedItems(bytes);
    const pages = new Set(items.map((i) => i.page));
    expect(pages.size).toBeGreaterThan(1);

    // Content actually continues onto later pages, in order.
    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain("Paragraph 1:");
    expect(texts[texts.length - 1]).toContain("Paragraph 90:");

    for (const it of items.filter((i) => i.str.trim())) {
      expect(it.x).toBeGreaterThanOrEqual(MARGIN - 0.5);
      expect(it.x + it.width).toBeLessThanOrEqual(it.pageW - MARGIN + 0.5);
      expect(it.y).toBeGreaterThanOrEqual(MARGIN - 1);
      expect(it.y).toBeLessThanOrEqual(it.pageH - MARGIN + 0.5);
    }

    // The unbreakably long word was broken up instead of running off the page.
    const joined = texts.join(" ").replace(/\s+/g, "");
    expect(joined).toContain("Supercalifragilistic");
  });
});

describe("word to pdf: inputs it can't convert", () => {
  it("explains that an old binary .doc is not a .docx", async () => {
    // The OLE2 compound-file signature every Word 97–2003 .doc starts with.
    const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const r = await wordToPdf(new File([ole2], "report.doc", { type: "application/msword" }));
    expect(r.success).toBe(false);
    expect(r.error).toBe(DOC_FORMAT_MESSAGE);
    expect(r.error).toMatch(/\.docx/);
  });

  it("names the characters the standard PDF fonts can't draw", async () => {
    const file = await makeDocx(({ Paragraph }) => ({
      children: [new Paragraph("Meeting notes"), new Paragraph("会議のメモ")],
    }));
    const r = await wordToPdf(file);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/characters the built-in PDF fonts can't draw/);
    expect(r.error).toContain("会");
    expect(r.error).not.toMatch(/WinAnsi|Error:|undefined/);
  });

  it("rejects a file that isn't a Word document at all", async () => {
    const r = await wordToPdf(new File([new Uint8Array([1, 2, 3, 4, 5])], "notes.docx", { type: DOCX_MIME }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/docx/i);
  });
});

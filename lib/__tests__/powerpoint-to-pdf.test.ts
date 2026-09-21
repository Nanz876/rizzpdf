// @vitest-environment node
// PowerPoint to PDF. Runs in the Node environment like the rest of the PDF
// suite (jsdom's File has no arrayBuffer()), with jsdom's DOMParser bolted on
// as a global because that's the XML parser the converter uses in the browser.
// Decks are built here with jszip — minimal but valid Open XML — so the tests
// stay self-contained.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from "pdf-lib";

const require = createRequire(import.meta.url);

beforeAll(() => {
  // jsdom ships no type declarations; require() keeps TypeScript happy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { JSDOM } = require("jsdom") as any;
  globalThis.DOMParser = new JSDOM("").window.DOMParser;
});

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { powerpointToPdf, readSlideCount } from "@/lib/tools/powerpoint-to-pdf";

// ─── Deck builder ───────────────────────────────────────────────────────────

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const EMU = 914400; // per inch

/** An 8×8 red PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGO4o6HxHx9mGBkKAIMRisGi/0sOAAAAAElFTkSuQmCC";
const pngBytes = () => Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));

interface TextOpts {
  x?: number; y?: number; cx?: number; cy?: number;
  size?: number; bold?: boolean; align?: string; color?: string;
}

function textShape(text: string, o: TextOpts = {}) {
  const { x = 0.5, y = 0.5, cx = 8, cy = 1.5, size = 24, bold = false, align = "l", color } = o;
  const fill = color ? `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` : "";
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="TextBox"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${Math.round(x * EMU)}" y="${Math.round(y * EMU)}"/><a:ext cx="${Math.round(cx * EMU)}" cy="${Math.round(cy * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>
      <a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${size * 100}"${bold ? ' b="1"' : ""}>${fill}</a:rPr><a:t>${text}</a:t></a:r></a:p>
    </p:txBody></p:sp>`;
}

function picShape(rid = "rId1") {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="4" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
    <p:spPr><a:xfrm><a:off x="${EMU}" y="${2 * EMU}"/><a:ext cx="${2 * EMU}" cy="${2 * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
  </p:pic>`;
}

function slideXml(shapes: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${A} ${R} ${P}><p:cSld><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
  ${shapes}
</p:spTree></p:cSld><p:clrMapOvr/></p:sld>`;
}

interface SlideSpec {
  /** Full slide XML (use `slideXml`), or deliberately broken XML. */
  xml: string;
  /** File number, i.e. ppt/slides/slide{n}.xml. Defaults to presentation order. */
  n?: number;
  image?: boolean;
}

interface DeckOpts {
  /** Slide size in EMU. `null` omits <p:sldSz> entirely. */
  size?: { cx: number; cy: number } | null;
  name?: string;
}

/** A minimal but structurally valid .pptx, as a File. */
async function makeDeck(slides: SlideSpec[], opts: DeckOpts = {}): Promise<File> {
  const { size = { cx: 12192000, cy: 6858000 }, name = "deck.pptx" } = opts;
  const zip = new JSZip();
  const numbered = slides.map((s, i) => ({ ...s, n: s.n ?? i + 1 }));

  const sldIds = numbered
    .map((s, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
    .join("");
  const sldSz = size ? `<p:sldSz cx="${size.cx}" cy="${size.cy}"/>` : "";
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${A} ${R} ${P}><p:sldIdLst>${sldIds}</p:sldIdLst>${sldSz}</p:presentation>`
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${numbered
      .map(
        (s, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${s.n}.xml"/>`
      )
      .join("")}</Relationships>`
  );

  for (const s of numbered) {
    zip.file(`ppt/slides/slide${s.n}.xml`, s.xml);
    if (s.image) {
      zip.file(`ppt/media/image${s.n}.png`, pngBytes());
      zip.file(
        `ppt/slides/_rels/slide${s.n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${s.n}.png"/></Relationships>`
      );
    }
  }

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${numbered
    .map(
      (s) =>
        `<Override PartName="/ppt/slides/slide${s.n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("")}
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`
  );

  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

// ─── Output helpers ─────────────────────────────────────────────────────────

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function pageTexts(blob: Blob): Promise<string[]> {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await bytesOf(blob);
  const doc = await real.getDocument({ data: data.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " ").trim());
  }
  return out;
}

/** Widths/heights of every image XObject on a page (pdf-lib, no canvas needed). */
async function imagesOnPage(blob: Blob, pageIndex: number): Promise<{ w: number; h: number }[]> {
  const doc = await PDFDocument.load(await bytesOf(blob));
  const res = doc.getPage(pageIndex).node.Resources();
  const xobjects = res?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!xobjects) return [];
  const out: { w: number; h: number }[] = [];
  for (const [, ref] of xobjects.entries()) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const dict = stream.dict;
    if (dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
    out.push({
      w: Number(dict.get(PDFName.of("Width"))?.toString() ?? 0),
      h: Number(dict.get(PDFName.of("Height"))?.toString() ?? 0),
    });
  }
  return out;
}

const pageSizes = async (blob: Blob) =>
  (await PDFDocument.load(await bytesOf(blob))).getPages().map((p) => ({
    w: Math.round(p.getWidth()),
    h: Math.round(p.getHeight()),
  }));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("powerpoint to pdf: slides and order", () => {
  it("makes one page per slide, in order, with the slide's text", async () => {
    const deck = await makeDeck([
      { xml: slideXml(textShape("Quarterly Review", { size: 32, bold: true, align: "ctr" })) },
      { xml: slideXml(textShape("Revenue grew by twelve percent")) },
      { xml: slideXml(textShape("Questions and Answers")) },
    ]);
    const r = await powerpointToPdf(deck);
    expect(r.success).toBe(true);
    expect(r.filename).toBe("deck.pdf");

    const texts = await pageTexts(r.blob!);
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("Quarterly Review");
    expect(texts[1]).toContain("Revenue grew by twelve percent");
    expect(texts[2]).toContain("Questions and Answers");
  });

  it("orders slides by the presentation's slide id list, not by file name", async () => {
    // 11 slides: a plain file-name sort would read slide10 and slide11 right
    // after slide1, so the page order pins the rels-based ordering rule.
    const deck = await makeDeck(
      Array.from({ length: 11 }, (_, i) => ({ xml: slideXml(textShape(`Slide ${i + 1}`)) }))
    );
    const r = await powerpointToPdf(deck);
    expect(r.success).toBe(true);
    const texts = await pageTexts(r.blob!);
    expect(texts).toHaveLength(11);
    texts.forEach((t, i) => expect(t).toContain(`Slide ${i + 1}`));
  });

  it("follows the id list even when it disagrees with the slideN.xml numbering", async () => {
    const deck = await makeDeck([
      { n: 3, xml: slideXml(textShape("First in the deck")) },
      { n: 1, xml: slideXml(textShape("Second in the deck")) },
      { n: 12, xml: slideXml(textShape("Third in the deck")) },
    ]);
    const r = await powerpointToPdf(deck);
    const texts = await pageTexts(r.blob!);
    expect(texts[0]).toContain("First in the deck");
    expect(texts[1]).toContain("Second in the deck");
    expect(texts[2]).toContain("Third in the deck");
  });

  it("reports the slide count without converting", async () => {
    const deck = await makeDeck([
      { xml: slideXml(textShape("a")) },
      { xml: slideXml(textShape("b")) },
    ]);
    await expect(readSlideCount(deck)).resolves.toBe(2);
  });

  it("reports progress slide by slide", async () => {
    const deck = await makeDeck([
      { xml: slideXml(textShape("a")) },
      { xml: slideXml(textShape("b")) },
      { xml: slideXml(textShape("c")) },
    ]);
    const seen: [number, number][] = [];
    await powerpointToPdf(deck, { onProgress: (done, total) => seen.push([done, total]) });
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});

describe("powerpoint to pdf: page geometry", () => {
  it("uses the declared slide size (EMU converted to points)", async () => {
    // 10in × 7.5in 4:3 deck → 720 × 540 pt.
    const deck = await makeDeck([{ xml: slideXml(textShape("4:3 deck")) }], {
      size: { cx: 9144000, cy: 6858000 },
    });
    const r = await powerpointToPdf(deck);
    expect(await pageSizes(r.blob!)).toEqual([{ w: 720, h: 540 }]);
  });

  it("uses a 13.33in × 7.5in widescreen page when the deck declares no size", async () => {
    const deck = await makeDeck([{ xml: slideXml(textShape("no size")) }], { size: null });
    const r = await powerpointToPdf(deck);
    expect(await pageSizes(r.blob!)).toEqual([{ w: 960, h: 540 }]);
  });

  it("places text where the shape says, in the shape's colour", async () => {
    // Shape at 1in from the left, 1in from the top of a 7.5in-tall slide →
    // the baseline must sit in the upper half of the page, not at the origin.
    const deck = await makeDeck([
      { xml: slideXml(textShape("Positioned", { x: 1, y: 1, cx: 6, cy: 1, color: "C00000" })) },
    ]);
    const r = await powerpointToPdf(deck);
    const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = await bytesOf(r.blob!);
    const doc = await real.getDocument({ data: data.slice(), isEvalSupported: false, verbosity: 0 }).promise;
    const content = await (await doc.getPage(1)).getTextContent();
    const item = content.items.find((it) => "str" in it && it.str.includes("Positioned"));
    expect(item).toBeTruthy();
    // transform = [a, b, c, d, e, f] — e/f are x/y in PDF points.
    const [, , , , x, y] = (item as { transform: number[] }).transform;
    expect(x).toBeGreaterThan(70); // ≈ 1in + text inset
    expect(x).toBeLessThan(110);
    expect(y).toBeGreaterThan(540 * 0.6); // near the top of a 540pt-tall page
    expect(y).toBeLessThan(540);
  });
});

describe("powerpoint to pdf: images", () => {
  it("embeds a slide's PNG at the picture's size", async () => {
    const deck = await makeDeck([
      { xml: slideXml(textShape("With a picture") + picShape()), image: true },
      { xml: slideXml(textShape("No picture here")) },
    ]);
    const r = await powerpointToPdf(deck);
    expect(r.success).toBe(true);
    const images = await imagesOnPage(r.blob!, 0);
    expect(images).toEqual([{ w: 8, h: 8 }]);
    expect(await imagesOnPage(r.blob!, 1)).toEqual([]);
    // Text on the same slide survives alongside the image.
    expect((await pageTexts(r.blob!))[0]).toContain("With a picture");
  });

  it("skips an image format pdf-lib can't embed instead of losing the slide", async () => {
    const deck = await makeDeck([{ xml: slideXml(textShape("Has a WMF") + picShape()) }]);
    // Swap the PNG part for a WMF the converter can't embed.
    const zip = await JSZip.loadAsync(await deck.arrayBuffer());
    zip.file("ppt/media/image1.wmf", new Uint8Array([0xd7, 0xcd, 0xc6, 0x9a, 0x00, 0x00]));
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.wmf"/></Relationships>`
    );
    const patched = new File([await zip.generateAsync({ type: "arraybuffer" })], "deck.pptx");

    const r = await powerpointToPdf(patched);
    expect(r.success).toBe(true);
    expect(await imagesOnPage(r.blob!, 0)).toEqual([]);
    expect((await pageTexts(r.blob!))[0]).toContain("Has a WMF");
    expect(r.warning).toMatch(/\.wmf/i);
  });
});

describe("powerpoint to pdf: shape kinds", () => {
  it("draws text inside a grouped shape, mapped through the group's transform", async () => {
    // Group occupies 1in..5in horizontally on the slide, with a child coordinate
    // space of 0..4in, so the child at 0 must land at ≈1in (72pt), not at 0.
    const group = `<p:grpSp>
      <p:nvGrpSpPr><p:cNvPr id="9" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm>
        <a:off x="${EMU}" y="${EMU}"/><a:ext cx="${4 * EMU}" cy="${2 * EMU}"/>
        <a:chOff x="0" y="0"/><a:chExt cx="${4 * EMU}" cy="${2 * EMU}"/>
      </a:xfrm></p:grpSpPr>
      ${textShape("Inside a group", { x: 0, y: 0, cx: 4, cy: 1, size: 18 })}
    </p:grpSp>`;
    const r = await powerpointToPdf(await makeDeck([{ xml: slideXml(group) }]));
    expect(r.success).toBe(true);
    expect((await pageTexts(r.blob!))[0]).toContain("Inside a group");
  });

  it("lays out a table's cell text on its grid", async () => {
    const cell = (t: string) =>
      `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1400"/><a:t>${t}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    const table = `<p:graphicFrame>
      <p:nvGraphicFramePr><p:cNvPr id="7" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
      <p:xfrm><a:off x="${EMU}" y="${EMU}"/><a:ext cx="${6 * EMU}" cy="${2 * EMU}"/></p:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>
        <a:tblGrid><a:gridCol w="${3 * EMU}"/><a:gridCol w="${3 * EMU}"/></a:tblGrid>
        <a:tr h="${EMU}">${cell("Region")}${cell("Revenue")}</a:tr>
        <a:tr h="${EMU}">${cell("North")}${cell("41000")}</a:tr>
      </a:tbl></a:graphicData></a:graphic>
    </p:graphicFrame>`;
    const r = await powerpointToPdf(await makeDeck([{ xml: slideXml(table) }]));
    expect(r.success).toBe(true);
    const text = (await pageTexts(r.blob!))[0];
    for (const cellText of ["Region", "Revenue", "North", "41000"]) expect(text).toContain(cellText);
  });

  it("still draws a shape whose geometry lives on the slide layout", async () => {
    // No <a:xfrm> at all — the position would come from the layout/master, which
    // this converter doesn't resolve, so the text must flow down the slide
    // instead of vanishing.
    const sp = `<p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:rPr lang="en-US"/><a:t>Unpositioned title</a:t></a:r></a:p>
        <a:p><a:pPr lvl="1"><a:buChar char="•"/></a:pPr><a:r><a:rPr sz="1800"/><a:t>a bullet under it</a:t></a:r></a:p>
      </p:txBody></p:sp>`;
    const r = await powerpointToPdf(await makeDeck([{ xml: slideXml(sp) }]));
    expect(r.success).toBe(true);
    const text = (await pageTexts(r.blob!))[0];
    expect(text).toContain("Unpositioned title");
    expect(text).toContain("a bullet under it");
  });

  it("wraps long text inside the shape's box instead of overflowing the slide", async () => {
    const words = "wrap".concat(" wrap".repeat(120));
    const r = await powerpointToPdf(
      await makeDeck([{ xml: slideXml(textShape(words, { x: 1, y: 1, cx: 4, cy: 4, size: 18 })) }])
    );
    const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = await bytesOf(r.blob!);
    const doc = await real.getDocument({ data: data.slice(), isEvalSupported: false, verbosity: 0 }).promise;
    const items = (await (await doc.getPage(1)).getTextContent()).items.filter((it) => "str" in it);
    expect(items.length).toBeGreaterThan(5); // broken into many lines
    for (const it of items) {
      const [, , , , x, y] = (it as { transform: number[] }).transform;
      expect(x).toBeGreaterThanOrEqual(70);
      expect(x).toBeLessThan(1 * 72 + 4 * 72 + 12); // inside the 4in-wide box
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(540);
    }
  });
});

describe("powerpoint to pdf: robustness", () => {
  it("turns a corrupt slide into a blank page and converts the rest", async () => {
    const deck = await makeDeck([
      { xml: slideXml(textShape("Good one")) },
      { xml: "<?xml version=\"1.0\"?><p:sld><p:cSld><p:spTree></p:sld>" }, // unbalanced
      { xml: slideXml(textShape("Good three")) },
    ]);
    const r = await powerpointToPdf(deck);
    expect(r.success).toBe(true);
    const texts = await pageTexts(r.blob!);
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("Good one");
    expect(texts[1]).toBe("");
    expect(texts[2]).toContain("Good three");
    expect(r.warning).toMatch(/slide/i);
    expect(r.warning).toContain("2");
  });

  it("reports characters the built-in PDF fonts can't encode", async () => {
    const deck = await makeDeck([{ xml: slideXml(textShape("Roadmap 路线图 2026")) }]);
    const r = await powerpointToPdf(deck);
    expect(r.success).toBe(true);
    expect(r.warning).toMatch(/characters/i);
    expect(r.warning).toMatch(/Chinese|embedded font/i);
    const text = (await pageTexts(r.blob!))[0];
    expect(text).toContain("Roadmap");
    expect(text).toContain("2026");
  });

  it("rejects a file that isn't a .pptx with a clear message", async () => {
    const pdfish = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "slides.pdf");
    const r = await powerpointToPdf(pdfish);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/PowerPoint/i);
    expect(r.error).toMatch(/\.pptx/i);
  });

  it("explains that the old binary .ppt format can't be read", async () => {
    const ole = new File(
      [new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])],
      "old-deck.ppt"
    );
    const r = await powerpointToPdf(ole);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/\.ppt\b/);
    expect(r.error).toMatch(/save it as \.pptx/i);
  });

  it("tells the user when a ZIP isn't a presentation at all", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<document/>");
    const docx = new File([await zip.generateAsync({ type: "arraybuffer" })], "report.docx");
    const r = await powerpointToPdf(docx);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Word document/i);
  });
});

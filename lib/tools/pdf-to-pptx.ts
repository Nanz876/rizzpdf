// PDF to PowerPoint: renders each PDF page to a PNG and lays one page per slide
// in a real .pptx (an Office Open XML zip built by hand with JSZip). This mirrors
// every page faithfully — fonts, vectors and images all look right — but the
// slides hold a picture of each page, not re-flowed editable text boxes. The
// marketing copy says exactly that; see the tool page.
//
// Rendering uses a canvas, so this stays on the main thread (never the worker),
// like compress and PDF-to-image. JSZip and pdf.js are dynamically imported.
import { toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";
import { getPdfjsLib } from "@/lib/tools/pdf-text";

// EMU (English Metric Units) are OOXML's absolute unit: 914400 per inch.
const EMU_PER_PT = 12700;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))), "image/png")
  );
}

export interface RenderedPage {
  png: Uint8Array;
  widthPt: number;
  heightPt: number;
}

async function renderPages(
  file: File,
  dpi: number,
  onProgress?: (done: number, total: number) => void
): Promise<RenderedPage[]> {
  const pdfjsLib = await getPdfjsLib();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: RenderedPage[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 }); // points (1/72")
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      // pdf.js paints onto a transparent canvas; a page that draws no background of
      // its own would come through transparent on the slide. Fill white so each
      // slide shows the page as a reader sees it.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx as any, viewport, canvas, background: "#ffffff" }).promise;
      const blob = await canvasToBlob(canvas);
      out.push({ png: new Uint8Array(await blob.arrayBuffer()), widthPt: base.width, heightPt: base.height });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }
  return out;
}

const CONTENT_TYPES = (pages: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
${Array.from({ length: pages }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n")}
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

const presentation = (pages: number, wEmu: number, hEmu: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${Array.from({ length: pages }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst>
<p:sldSz cx="${wEmu}" cy="${hEmu}"/>
<p:notesSz cx="${hEmu}" cy="${wEmu}"/>
</p:presentation>`;

const presentationRels = (pages: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${Array.from({ length: pages }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("\n")}
</Relationships>`;

const SLIDE_MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;

const SLIDE_MASTER_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const SLIDE_LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`;

const SLIDE_LAYOUT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

const slideXml = (wEmu: number, hEmu: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
<p:pic>
<p:nvPicPr><p:cNvPr id="2" name="Page"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>
</p:spTree></p:cSld>
</p:sld>`;

const slideRels = (img: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${img}"/>
</Relationships>`;

/** Assemble a .pptx (one slide per rendered page) from already-rendered pages. No DOM; exported for tests. */
export async function buildPptx(pages: RenderedPage[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // Slide size = first page size, in EMU. Every page is drawn to fill its slide,
  // so mixed page sizes still each fill the (fixed) slide area.
  const wEmu = Math.round(pages[0].widthPt * EMU_PER_PT);
  const hEmu = Math.round(pages[0].heightPt * EMU_PER_PT);

  zip.file("[Content_Types].xml", CONTENT_TYPES(pages.length));
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("ppt/presentation.xml", presentation(pages.length, wEmu, hEmu));
  zip.file("ppt/_rels/presentation.xml.rels", presentationRels(pages.length));
  zip.file("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", SLIDE_MASTER_RELS);
  zip.file("ppt/slideLayouts/slideLayout1.xml", SLIDE_LAYOUT);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", SLIDE_LAYOUT_RELS);

  pages.forEach((p, i) => {
    const n = i + 1;
    zip.file(`ppt/media/image${n}.png`, p.png);
    zip.file(`ppt/slides/slide${n}.xml`, slideXml(wEmu, hEmu));
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, slideRels(`image${n}.png`));
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

export interface PdfToPptxOptions {
  /** Render resolution. Higher is sharper but larger. Default 150. */
  dpi?: number;
  /** Per-page progress callback. */
  onProgress?: (done: number, total: number) => void;
}

export async function pdfToPptx(file: File, opts: PdfToPptxOptions = {}): Promise<ToolResult> {
  try {
    const pages = await renderPages(file, opts.dpi ?? 150, opts.onProgress);
    if (!pages.length) return { success: false, error: "This PDF has no pages to convert." };
    const blob = await buildPptx(pages);
    return { success: true, blob, filename: file.name.replace(/\.pdf$/i, "") + ".pptx" };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Conversion failed. Make sure the file is a valid PDF.") };
  }
}

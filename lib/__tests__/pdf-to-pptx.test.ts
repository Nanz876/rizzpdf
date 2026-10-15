// @vitest-environment node
// The canvas-rendering half of PDF to PowerPoint needs a browser and is covered
// by the in-browser smoke test. Here we verify the .pptx packaging (buildPptx):
// that it produces a well-formed OOXML zip with one slide + one image per page.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildPptx, type RenderedPage } from "@/lib/tools/pdf-to-pptx";

// A 1×1 PNG is enough — we only check it's stored, not decoded.
const PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function pages(n: number): RenderedPage[] {
  return Array.from({ length: n }, () => ({ png: PNG_1x1, widthPt: 612, heightPt: 792 }));
}

describe("buildPptx", () => {
  it("packages one slide and one image per page with matching rels", async () => {
    const blob = await buildPptx(pages(3));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    for (let n = 1; n <= 3; n++) {
      expect(zip.file(`ppt/slides/slide${n}.xml`)).toBeTruthy();
      expect(zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)).toBeTruthy();
      expect(zip.file(`ppt/media/image${n}.png`)).toBeTruthy();
    }
    // No stray 4th slide.
    expect(zip.file("ppt/slides/slide4.xml")).toBeNull();

    const ct = await zip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain('PartName="/ppt/slides/slide3.xml"');
    expect(ct).toContain('Extension="png"');

    const pres = await zip.file("ppt/presentation.xml")!.async("string");
    // Slide size in EMU: 612pt × 12700, 792pt × 12700.
    expect(pres).toContain(`<p:sldSz cx="${612 * 12700}" cy="${792 * 12700}"/>`);
    // Three slide ids referencing rId2..rId4 (rId1 is the master).
    expect((pres.match(/<p:sldId /g) ?? []).length).toBe(3);

    const presRels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
    expect(presRels).toContain('Target="slides/slide3.xml"');
    expect(presRels).toContain('Target="slideMasters/slideMaster1.xml"');
  });

  it("embeds the actual image bytes", async () => {
    const zip = await JSZip.loadAsync(await (await buildPptx(pages(1))).arrayBuffer());
    const bytes = await zip.file("ppt/media/image1.png")!.async("uint8array");
    expect(bytes.length).toBe(PNG_1x1.length);
    expect(bytes[1]).toBe(0x50); // "P" of the PNG signature
  });
});

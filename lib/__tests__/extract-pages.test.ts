// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPages } from "@/lib/pdf-tools";

async function makePdf(n: number): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`Page ${i}`, { x: 20, y: 160, size: 24, font });
  }
  const bytes = await doc.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], "doc.pdf", { type: "application/pdf" });
}

const pageCount = async (blob: Blob) =>
  (await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()))).getPageCount();

describe("extractPages", () => {
  it("keeps only the selected pages, in the order given", async () => {
    const r = await extractPages(await makePdf(5), [3, 1]);
    expect(r.success).toBe(true);
    expect(r.filename).toBe("doc_extracted.pdf");
    expect(await pageCount(r.blob!)).toBe(2);
  });

  it("ignores out-of-range page numbers", async () => {
    const r = await extractPages(await makePdf(3), [2, 99, 0, -1]);
    expect(r.success).toBe(true);
    expect(await pageCount(r.blob!)).toBe(1);
  });

  it("errors when nothing valid is selected", async () => {
    const r = await extractPages(await makePdf(3), [10, 20]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/at least one page/i);
  });

  it("can duplicate a page when it's listed twice", async () => {
    const r = await extractPages(await makePdf(2), [1, 1, 2]);
    expect(await pageCount(r.blob!)).toBe(3);
  });
});

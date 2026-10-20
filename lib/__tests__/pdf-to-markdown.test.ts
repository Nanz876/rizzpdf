// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { pdfToMarkdown, pagesToMarkdown, NO_TEXT_FOR_CONVERT } from "@/lib/tools/pdf-to-markdown";

const FIX = path.resolve(__dirname, "../../test-fixtures");
async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

describe("PDF to Markdown", () => {
  it("turns font-size hierarchy into headings, and bullets into a list", async () => {
    const r = await pdfToMarkdown(await fixture("audit/structured-doc.pdf"));
    expect(r.success).toBe(true);
    expect(r.filename).toBe("structured-doc.md");
    const md = r.markdown!;
    expect(md).toMatch(/^# Quarterly Report$/m);
    expect(md).toMatch(/^## Summary$/m);
    expect(md).toMatch(/^## Highlights$/m);
    expect(md).toMatch(/^- Revenue up 18 percent\n- Churn down to 2\.1 percent$/m);
    // Wrapped lines are merged into one paragraph.
    expect(md).toMatch(/^Revenue grew steadily .* launch in the second month\.$/m);
  });

  it("rebuilds a grid of text as a Markdown table", async () => {
    const r = await pdfToMarkdown(await fixture("audit/table-doc.pdf"));
    const md = r.markdown!;
    expect(md).toContain("| Item | Qty | Price |\n| --- | --- | --- |\n| Widget | 3 | 9.00 |");
    expect(md).toContain("| Gizmo | 2 | 14.50 |");
    expect(md).toMatch(/^Thank you for your order\.$/m);
  });

  it("keeps numbered lists numbered", async () => {
    const md = (await pdfToMarkdown(await fixture("smoke/plain-text.pdf"))).markdown!;
    expect(md).toMatch(/^1\. Selectable body text/m);
    expect(md).toMatch(/^3\. Expected result/m);
  });

  it("points scanned PDFs at OCR instead of returning an empty file", async () => {
    const r = await pdfToMarkdown(await fixture("audit/scanned-no-text.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toBe(NO_TEXT_FOR_CONVERT);
  });

  it("asks for an unlock on password-protected files", async () => {
    const r = await pdfToMarkdown(await fixture("audit/user-password.pdf"));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password-protected/);
  });
});

describe("pagesToMarkdown", () => {
  const item = (str: string, x: number, y: number, size = 11) => ({ str, x, y, w: str.length * size * 0.5, size, bold: false, italic: false });
  it("escapes text that would otherwise become Markdown syntax", () => {
    const md = pagesToMarkdown([
      { width: 612, height: 792, rows: [{ y: 100, size: 11, items: [item("# not a heading *or* emphasis", 72, 100)] }] },
    ]);
    expect(md).toBe("\\# not a heading \\*or\\* emphasis\n");
  });
});

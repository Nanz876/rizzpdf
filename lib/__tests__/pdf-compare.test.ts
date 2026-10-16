// @vitest-environment node
import { describe, it, expect } from "vitest";
import { diffTokens, buildCompare, pageToText } from "@/lib/tools/pdf-compare";
import type { PageText } from "@/lib/tools/pdf-text";

const words = (s: string) => s.split(" ");

function page(lines: string[]): PageText {
  return {
    width: 612,
    height: 792,
    rows: lines.map((text, i) => ({
      y: 50 + i * 14,
      size: 11,
      items: [{ str: text, x: 72, y: 50 + i * 14, w: text.length * 5, size: 11, bold: false, italic: false }],
    })),
  };
}

describe("diffTokens", () => {
  it("marks a replaced word as remove + add, keeping the rest same", () => {
    const ops = diffTokens(words("the quick brown fox"), words("the slow brown fox"));
    expect(ops).toEqual([
      { op: "same", text: "the" },
      { op: "remove", text: "quick" },
      { op: "add", text: "slow" },
      { op: "same", text: "brown fox" },
    ]);
  });

  it("is all-same for identical input", () => {
    expect(diffTokens(words("a b c"), words("a b c"))).toEqual([{ op: "same", text: "a b c" }]);
  });

  it("handles pure insertion and pure deletion", () => {
    expect(diffTokens(words("a c"), words("a b c"))).toEqual([
      { op: "same", text: "a" },
      { op: "add", text: "b" },
      { op: "same", text: "c" },
    ]);
    expect(diffTokens(words("a b c"), words("a c"))).toEqual([
      { op: "same", text: "a" },
      { op: "remove", text: "b" },
      { op: "same", text: "c" },
    ]);
  });
});

describe("buildCompare", () => {
  it("reports identical when both documents have the same text", () => {
    const r = buildCompare([page(["hello world"])], [page(["hello world"])]);
    expect(r.identical).toBe(true);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.pages[0].changed).toBe(false);
  });

  it("counts added and removed words and flags changed pages", () => {
    const r = buildCompare([page(["hello world"])], [page(["hello brave new world"])]);
    expect(r.identical).toBe(false);
    expect(r.added).toBe(2); // "brave new"
    expect(r.removed).toBe(0);
    expect(r.changedPages).toBe(1);
    expect(r.pages[0].right.some((t) => t.op === "add" && t.text === "brave new")).toBe(true);
  });

  it("treats a page missing from one side as all-added or all-removed", () => {
    const r = buildCompare([page(["only in original"])], [page(["only in original"]), page(["brand new page"])]);
    expect(r.pages).toHaveLength(2);
    expect(r.pages[1].status).toBe("added");
    expect(r.pages[1].changed).toBe(true);
    expect(r.added).toBe(3);
    expect(r.pages[1].left).toHaveLength(0);
  });

  it("aligns around an inserted page instead of cascading every page after it", () => {
    const A = page(["alpha one two three"]);
    const B = page(["bravo four five six"]);
    const C = page(["charlie seven eight nine"]);
    const X = page(["xray hundred thousand million"]);
    // X is inserted between A and B in the changed document.
    const r = buildCompare([A, B, C], [A, X, B, C]);

    // Only the inserted page is a change — B and C still line up, not re-diffed.
    expect(r.changedPages).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.added).toBe(4); // just X's four words

    const inserted = r.pages.find((p) => p.status === "added")!;
    expect(inserted.rightPage).toBe(2);
    expect(inserted.left).toHaveLength(0);

    // B matched across the shift: original page 2 ↔ changed page 3, unchanged.
    const b = r.pages.find((p) => p.leftPage === 2)!;
    expect(b.status).toBe("same");
    expect(b.rightPage).toBe(3);
  });

  it("aligns around a deleted page the same way", () => {
    const A = page(["alpha one two three"]);
    const B = page(["bravo four five six"]);
    const C = page(["charlie seven eight nine"]);
    const r = buildCompare([A, B, C], [A, C]); // B deleted

    expect(r.changedPages).toBe(1);
    expect(r.added).toBe(0);
    const removedPage = r.pages.find((p) => p.status === "removed")!;
    expect(removedPage.leftPage).toBe(2);
    expect(removedPage.right).toHaveLength(0);
    // C still matches, despite its index shifting from 3 to 2.
    const c = r.pages.find((p) => p.leftPage === 3)!;
    expect(c.status).toBe("same");
    expect(c.rightPage).toBe(2);
  });
});

describe("pageToText", () => {
  it("joins rows with single spaces", () => {
    expect(pageToText(page(["line one", "line two"]))).toBe("line one line two");
  });
});

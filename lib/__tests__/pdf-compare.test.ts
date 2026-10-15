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
    expect(r.pages[1].changed).toBe(true);
    expect(r.added).toBe(3);
    expect(r.pages[1].left).toHaveLength(0);
  });
});

describe("pageToText", () => {
  it("joins rows with single spaces", () => {
    expect(pageToText(page(["line one", "line two"]))).toBe("line one line two");
  });
});

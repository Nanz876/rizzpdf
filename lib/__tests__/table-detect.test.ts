// @vitest-environment node
// Table detection is gutter-based: a column is a band of whitespace that every
// row leaves open, and cells are placed by their horizontal centre. That makes
// detection alignment-agnostic — right-aligned numeric columns (invoices,
// statements) and centred columns line up as readily as left-aligned ones,
// which the earlier start-x clustering could not do.
import { describe, it, expect } from "vitest";
import { detectTableRuns, tableGrid, columnIndex, type Segment } from "@/lib/tools/pdf-text";

/** Build a segment with text occupying [x, x+width]. */
const seg = (x: number, width: number, text: string): Segment => ({ x, end: x + width, text });

describe("detectTableRuns — alignment", () => {
  it("detects a left-aligned table", () => {
    const rows: Segment[][] = [
      [seg(54, 22, "Item"), seg(250, 20, "Qty"), seg(400, 26, "Price")],
      [seg(54, 34, "Widget"), seg(250, 6, "3"), seg(400, 24, "9.00")],
      [seg(54, 30, "Gizmo"), seg(250, 6, "2"), seg(400, 30, "14.50")],
    ];
    const runs = detectTableRuns(rows);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ start: 0, end: 2 });
    expect(runs[0].cols).toHaveLength(2); // three columns
    expect(tableGrid(rows, runs[0].cols)).toEqual([
      ["Item", "Qty", "Price"],
      ["Widget", "3", "9.00"],
      ["Gizmo", "2", "14.50"],
    ]);
  });

  it("detects a right-aligned numeric table whose cell starts drift per row", () => {
    // The amount column is right-aligned at x≈360, so each number starts at a
    // different x — the case the old start-x clustering missed entirely.
    const rightAt = (right: number, width: number, text: string) => seg(right - width, width, text);
    const rows: Segment[][] = [
      [seg(40, 21, "Item"), seg(160, 17, "Qty"), rightAt(360, 38, "Amount")],
      [seg(40, 34, "Widget"), rightAt(175, 6, "3"), rightAt(360, 43, "1,250.00")],
      [seg(40, 36, "Gadget"), rightAt(175, 12, "12"), rightAt(360, 28, "90.50")],
      [seg(40, 32, "Gizmo"), rightAt(175, 6, "1"), rightAt(360, 49, "10,000.00")],
    ];
    const runs = detectTableRuns(rows);
    expect(runs).toHaveLength(1);
    expect(runs[0].cols).toHaveLength(2); // three columns
    expect(tableGrid(rows, runs[0].cols)).toEqual([
      ["Item", "Qty", "Amount"],
      ["Widget", "3", "1,250.00"],
      ["Gadget", "12", "90.50"],
      ["Gizmo", "1", "10,000.00"],
    ]);
  });

  it("detects a centred column", () => {
    const centreAt = (cx: number, width: number, text: string) => seg(cx - width / 2, width, text);
    const rows: Segment[][] = [
      [seg(40, 20, "Name"), centreAt(300, 30, "Status")],
      [seg(40, 50, "Alpha widget"), centreAt(300, 14, "OK")],
      [seg(40, 40, "Beta"), centreAt(300, 40, "Pending")],
    ];
    const runs = detectTableRuns(rows);
    expect(runs).toHaveLength(1);
    expect(tableGrid(rows, runs[0].cols)).toEqual([
      ["Name", "Status"],
      ["Alpha widget", "OK"],
      ["Beta", "Pending"],
    ]);
  });

  it("does not treat prose (one segment per row) as a table", () => {
    const rows: Segment[][] = [
      [seg(54, 400, "The quick brown fox jumped over the lazy dog and ran.")],
      [seg(54, 380, "Another ordinary sentence of running body text here.")],
    ];
    expect(detectTableRuns(rows)).toHaveLength(0);
  });

  it("breaks the run where the shared gutter disappears", () => {
    const rows: Segment[][] = [
      [seg(40, 20, "A"), seg(200, 20, "B")],
      [seg(40, 20, "C"), seg(200, 20, "D")],
      [seg(40, 300, "A full-width paragraph with no column gutter at all here")],
      [seg(40, 20, "E"), seg(200, 20, "F")],
      [seg(40, 20, "G"), seg(200, 20, "H")],
    ];
    const runs = detectTableRuns(rows);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ start: 0, end: 1 });
    expect(runs[1]).toMatchObject({ start: 3, end: 4 });
  });
});

describe("columnIndex", () => {
  it("places a centre by how many cut lines sit to its left", () => {
    const cuts = [118, 244];
    expect(columnIndex(cuts, 50)).toBe(0);
    expect(columnIndex(cuts, 168)).toBe(1);
    expect(columnIndex(cuts, 338)).toBe(2);
  });
});

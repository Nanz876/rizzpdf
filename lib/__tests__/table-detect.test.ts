// @vitest-environment node
// Table detection finds columns as the vertical whitespace stripes that run through
// the WHOLE table block (a union, not a per-row intersection) and places each cell by
// its horizontal centre. That makes detection alignment-agnostic — right-aligned
// numeric and centred columns line up like left-aligned ones — and robust to sparse
// rows (a lone SUBTOTAL) and wrapped headers that would otherwise collapse the columns.
import { describe, it, expect } from "vitest";
import { detectTableRuns, tableGrid, columnIndex, mergeWrappedHeaderRows, type Segment } from "@/lib/tools/pdf-text";

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

describe("sparse rows and stacked tables", () => {
  const rightAt = (right: number, width: number, text: string) => seg(right - width, width, text);

  it("keeps a lone SUBTOTAL row's cells in their own columns (not column A)", () => {
    // Four columns: a left label, then three right-aligned money columns. The last
    // row has values only in the final two columns — the case that used to collapse.
    const rows: Segment[][] = [
      [seg(54, 40, "Item"), rightAt(300, 30, "Unit"), rightAt(400, 30, "Less"), rightAt(520, 30, "Total")],
      [seg(54, 90, "Physiotherapy"), rightAt(300, 44, "12,500.00"), rightAt(400, 40, "3,000.00"), rightAt(520, 40, "9,500.00")],
      [seg(54, 60, "Follow-up"), rightAt(300, 36, "7,500.00"), rightAt(400, 6, "-"), rightAt(520, 36, "7,500.00")],
      [rightAt(400, 60, "SUBTOTAL"), rightAt(520, 44, "18,500.00")],
    ];
    const runs = detectTableRuns(rows);
    expect(runs).toHaveLength(1);
    expect(runs[0].cols).toHaveLength(3); // four columns
    const grid = tableGrid(rows, runs[0].cols);
    // SUBTOTAL sits in the third column, its amount in the fourth — never column A.
    expect(grid[3][0]).toBe("");
    expect(grid[3][1]).toBe("");
    expect(grid[3][2]).toBe("SUBTOTAL");
    expect(grid[3][3]).toBe("18,500.00");
  });

  it("splits two stacked tables on the blank line between them", () => {
    const ys = [100, 120, 140, 200, 220, 240]; // a big gap at index 3
    const rows: Segment[][] = [
      [seg(40, 30, "A1"), seg(200, 30, "B1")],
      [seg(40, 30, "A2"), seg(200, 30, "B2")],
      [seg(40, 30, "A3"), seg(200, 30, "B3")],
      [seg(40, 30, "X1"), seg(150, 30, "Y1"), seg(300, 30, "Z1")],
      [seg(40, 30, "X2"), seg(150, 30, "Y2"), seg(300, 30, "Z2")],
      [seg(40, 30, "X3"), seg(150, 30, "Y3"), seg(300, 30, "Z3")],
    ];
    const runs = detectTableRuns(rows, ys);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ start: 0, end: 2 });
    expect(runs[0].cols).toHaveLength(1); // first table: 2 columns
    expect(runs[1]).toMatchObject({ start: 3, end: 5 });
    expect(runs[1].cols).toHaveLength(2); // second table: 3 columns
  });
});

describe("mergeWrappedHeaderRows", () => {
  it("joins a two-line column header into one row, leaving data rows intact", () => {
    const grid = [
      ["DESCRIPTION OF", "UNIT PRICE", "LESS", "TOTAL"],
      ["SERVICE", "RENDERED", "INSURANCE", ""],
      ["Physiotherapy", "12,500.00", "3,000.00", "9,500.00"],
    ];
    expect(mergeWrappedHeaderRows(grid)).toEqual([
      ["DESCRIPTION OF SERVICE", "UNIT PRICE RENDERED", "LESS INSURANCE", "TOTAL"],
      ["Physiotherapy", "12,500.00", "3,000.00", "9,500.00"],
    ]);
  });

  it("leaves a single-line header alone", () => {
    const grid = [["Item", "Qty", "Price"], ["Widget", "3", "9.00"]];
    expect(mergeWrappedHeaderRows(grid)).toEqual(grid);
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

// Compare PDF: a word-level text diff between two PDFs, computed from their text
// layers. Produces per-page added/removed/unchanged runs for a side-by-side view
// and a few summary counts. Pure (no DOM, no network) apart from the pdf.js text
// extraction it shares with the other text tools.
import { extractPageText, rowText, type PageText } from "@/lib/tools/pdf-text";
import { toolErrorMessage } from "@/lib/pdf-load";

export type DiffOp = "same" | "add" | "remove";
export interface DiffToken {
  op: DiffOp;
  text: string;
}
export interface PageDiff {
  page: number;
  /** Tokens for the left (original) document — "same" and "remove" only. */
  left: DiffToken[];
  /** Tokens for the right (changed) document — "same" and "add" only. */
  right: DiffToken[];
  changed: boolean;
}
export interface CompareResult {
  pages: PageDiff[];
  added: number;
  removed: number;
  changedPages: number;
  identical: boolean;
}

/** Flatten a page's rows into a single whitespace-joined string. */
export function pageToText(page: PageText): string {
  return page.rows.map(rowText).join(" ").replace(/\s+/g, " ").trim();
}

/** Split into words while keeping them as comparison units. */
function tokenize(text: string): string[] {
  return text.length ? text.split(/\s+/).filter(Boolean) : [];
}

/**
 * Myers-style LCS over two token arrays, returned as a merged op list. O(n·m)
 * memory — fine for a page of text, which is what we diff (never a whole book at
 * once). Longer inputs are capped so a pathological pair can't hang the tab.
 */
export function diffTokens(a: string[], b: string[]): DiffToken[] {
  const MAX = 4000;
  if (a.length > MAX || b.length > MAX) {
    // Too large for the quadratic table: fall back to a coarse whole-block diff.
    const same = a.join(" ") === b.join(" ");
    if (same) return a.length ? [{ op: "same", text: a.join(" ") }] : [];
    const out: DiffToken[] = [];
    if (a.length) out.push({ op: "remove", text: a.join(" ") });
    if (b.length) out.push({ op: "add", text: b.join(" ") });
    return out;
  }

  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i:] and b[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffToken[] = [];
  const push = (op: DiffOp, text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.op === op) last.text += " " + text;
    else ops.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("remove", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < n) push("remove", a[i++]);
  while (j < m) push("add", b[j++]);
  return ops;
}

/** Build the per-page diff, aligning pages by index and diffing the longer count. */
export function buildCompare(left: PageText[], right: PageText[]): CompareResult {
  const count = Math.max(left.length, right.length);
  const pages: PageDiff[] = [];
  let added = 0;
  let removed = 0;
  let changedPages = 0;

  for (let p = 0; p < count; p++) {
    const a = tokenize(left[p] ? pageToText(left[p]) : "");
    const b = tokenize(right[p] ? pageToText(right[p]) : "");
    const ops = diffTokens(a, b);
    const leftTokens = ops.filter((o) => o.op !== "add");
    const rightTokens = ops.filter((o) => o.op !== "remove");
    const pageAdded = ops.filter((o) => o.op === "add").reduce((n, o) => n + o.text.split(" ").length, 0);
    const pageRemoved = ops.filter((o) => o.op === "remove").reduce((n, o) => n + o.text.split(" ").length, 0);
    const changed = pageAdded > 0 || pageRemoved > 0;
    if (changed) changedPages++;
    added += pageAdded;
    removed += pageRemoved;
    pages.push({ page: p + 1, left: leftTokens, right: rightTokens, changed });
  }

  return { pages, added, removed, changedPages, identical: added === 0 && removed === 0 };
}

export interface ComparePdfResult {
  success: boolean;
  result?: CompareResult;
  error?: string;
}

export async function comparePdfs(original: File, changed: File): Promise<ComparePdfResult> {
  try {
    const [left, right] = await Promise.all([extractPageText(original), extractPageText(changed)]);
    if (!left.some((p) => p.rows.length) && !right.some((p) => p.rows.length)) {
      return {
        success: false,
        error: "Neither PDF has selectable text to compare — they look like scans. Run them through OCR PDF first.",
      };
    }
    return { success: true, result: buildCompare(left, right) };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Couldn't compare these files. Make sure both are valid PDFs.") };
  }
}

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
export type PageStatus = "same" | "changed" | "added" | "removed";
export interface PageDiff {
  /** 1-based position in the aligned, side-by-side sequence. */
  page: number;
  /** 1-based page number in the original document, if this row has one. */
  leftPage?: number;
  /** 1-based page number in the changed document, if this row has one. */
  rightPage?: number;
  status: PageStatus;
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

/** Above this many pages per side, align by index — the quadratic page matcher
 *  below would be too costly, and big docs rarely need fuzzy page alignment. */
const PAGE_ALIGN_MAX = 60;
/** Two pages count as "the same page" when this share of their word sequence matches. */
const PAGE_SIM = 0.4;
/** Words of each page compared when measuring page similarity (bounds the cost). */
const SIM_WORD_CAP = 400;

/** Length of the longest common subsequence of two token arrays (rolling array, O(m) memory). */
function lcsLength(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;
  let prev = new Array(m + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const cur = new Array(m + 1).fill(0);
    for (let j = m - 1; j >= 0; j--) {
      cur[j] = a[i] === b[j] ? prev[j + 1] + 1 : Math.max(prev[j], cur[j + 1]);
    }
    prev = cur;
  }
  return prev[0];
}

/**
 * Whether two pages are "the same page" for alignment: a strong share of their word
 * sequence is common. Order-aware (an LCS, not a set overlap), so a shared header and
 * footer alone can't make two otherwise-different pages match.
 */
function pagesSimilar(a: string[], b: string[]): boolean {
  if (!a.length && !b.length) return true;
  if (!a.length || !b.length) return false;
  const ca = a.length > SIM_WORD_CAP ? a.slice(0, SIM_WORD_CAP) : a;
  const cb = b.length > SIM_WORD_CAP ? b.slice(0, SIM_WORD_CAP) : b;
  return lcsLength(ca, cb) / Math.max(ca.length, cb.length) >= PAGE_SIM;
}

/**
 * Align the two documents' pages so an inserted or deleted page doesn't cascade
 * into every page after it reading as fully changed. An LCS over pages (using
 * `pagesSimilar` as equality) pairs matching pages in order; unpaired left pages are
 * removals, unpaired right pages additions. `li`/`ri` are 0-based indices, or -1 for
 * "no page on this side".
 */
function alignPages(left: string[][], right: string[][]): { li: number; ri: number }[] {
  const n = left.length;
  const m = right.length;
  if (n > PAGE_ALIGN_MAX || m > PAGE_ALIGN_MAX) {
    return Array.from({ length: Math.max(n, m) }, (_, k) => ({
      li: k < n ? k : -1,
      ri: k < m ? k : -1,
    }));
  }

  const eq: boolean[][] = Array.from({ length: n }, () => new Array(m).fill(false));
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      eq[i][j] = pagesSimilar(left[i], right[j]);
      dp[i][j] = eq[i][j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: { li: number; ri: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq[i][j]) out.push({ li: i++, ri: j++ });
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ li: i++, ri: -1 });
    else out.push({ li: -1, ri: j++ });
  }
  while (i < n) out.push({ li: i++, ri: -1 });
  while (j < m) out.push({ li: -1, ri: j++ });
  return out;
}

/** Build the per-page diff, aligning pages by content so edits don't cascade. */
export function buildCompare(left: PageText[], right: PageText[]): CompareResult {
  const leftTok = left.map((p) => tokenize(pageToText(p)));
  const rightTok = right.map((p) => tokenize(pageToText(p)));
  const pairs = alignPages(leftTok, rightTok);

  const pages: PageDiff[] = [];
  let added = 0;
  let removed = 0;
  let changedPages = 0;

  pairs.forEach(({ li, ri }, idx) => {
    const a = li >= 0 ? leftTok[li] : [];
    const b = ri >= 0 ? rightTok[ri] : [];
    const ops = diffTokens(a, b);
    const leftTokens = ops.filter((o) => o.op !== "add");
    const rightTokens = ops.filter((o) => o.op !== "remove");
    const pageAdded = ops.filter((o) => o.op === "add").reduce((n, o) => n + o.text.split(" ").length, 0);
    const pageRemoved = ops.filter((o) => o.op === "remove").reduce((n, o) => n + o.text.split(" ").length, 0);
    added += pageAdded;
    removed += pageRemoved;
    const status: PageStatus =
      li < 0 ? "added" : ri < 0 ? "removed" : pageAdded || pageRemoved ? "changed" : "same";
    const changed = status !== "same";
    if (changed) changedPages++;
    pages.push({
      page: idx + 1,
      leftPage: li >= 0 ? li + 1 : undefined,
      rightPage: ri >= 0 ? ri + 1 : undefined,
      status,
      left: leftTokens,
      right: rightTokens,
      changed,
    });
  });

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

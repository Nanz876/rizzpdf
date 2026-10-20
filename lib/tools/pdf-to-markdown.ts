// PDF to Markdown: rebuilds headings, paragraphs, lists and simple tables from the
// PDF's text layer. Headings come from font size relative to the body text, tables
// from rows that share column positions (see detectTableRuns). Client-side only.
import { toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";
import {
  extractPageText,
  hasText,
  rowSegments,
  rowText,
  detectTableRuns,
  tableGrid,
  type PageText,
  type TextRow,
} from "@/lib/tools/pdf-text";

export const NO_TEXT_FOR_CONVERT =
  "This PDF has no selectable text — it looks like a scanned document. Run it through OCR PDF first, then convert the result.";

const BULLET_RE = /^[•●▪◦‣∙·]\s*/;
const DASH_BULLET_RE = /^[-–*]\s+/;
const NUMBERED_RE = /^(\d{1,3})[.)]\s+/;

type Line = { text: string; x: number; y: number; size: number; bold: boolean; italic: boolean };
type Block = { kind: "heading"; level: number; text: string } | { kind: "para"; lines: Line[] } | { kind: "list"; marker: string; text: string } | { kind: "table"; grid: string[][] };

/** Character-weighted most common font size across the document. */
export function bodySize(pages: PageText[]): number {
  const weight = new Map<number, number>();
  for (const p of pages)
    for (const r of p.rows)
      for (const it of r.items) weight.set(it.size, (weight.get(it.size) ?? 0) + it.str.trim().length);
  if (!weight.size) return 11;
  return [...weight.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/** Heading level for a line of this size, or 0 for body text. */
export function headingLevel(size: number, body: number): number {
  if (size >= body * 1.8) return 1;
  if (size >= body * 1.4) return 2;
  if (size >= body * 1.15) return 3;
  return 0;
}

function toLine(row: TextRow): Line {
  return {
    text: rowText(row),
    x: row.items[0].x,
    y: row.y,
    size: row.size,
    bold: row.items.every((i) => i.bold),
    italic: row.items.every((i) => i.italic),
  };
}

/** Escape characters that would otherwise turn plain text into Markdown syntax. */
function escapeInline(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function escapeLineStart(text: string): string {
  return text.replace(/^(#{1,6}\s|>|[-+*]\s|\d+[.)]\s)/, "\\$1");
}

function escapeCell(text: string): string {
  return escapeInline(text).replace(/\|/g, "\\|");
}

function joinWrapped(lines: Line[]): string {
  return lines
    .map((l) => l.text)
    .reduce((acc, t) => (/[A-Za-z]-$/.test(acc) ? acc.slice(0, -1) + t : acc ? `${acc} ${t}` : t), "");
}

function pageBlocks(page: PageText, body: number): Block[] {
  const segRows = page.rows.map((r) => rowSegments(r));
  const runs = detectTableRuns(segRows);
  const inTable = new Map<number, number>(); // row index → run index
  runs.forEach((run, ri) => {
    for (let i = run.start; i <= run.end; i++) inTable.set(i, ri);
  });

  const blocks: Block[] = [];
  for (let i = 0; i < page.rows.length; i++) {
    const ri = inTable.get(i);
    if (ri !== undefined) {
      const run = runs[ri];
      blocks.push({ kind: "table", grid: tableGrid(segRows.slice(run.start, run.end + 1), run.cols) });
      i = run.end;
      continue;
    }
    const line = toLine(page.rows[i]);
    if (!line.text) continue;

    const level = headingLevel(line.size, body);
    const prev = blocks[blocks.length - 1];
    if (level) {
      // A heading that wraps onto a second line at the same size is still one heading.
      if (prev?.kind === "heading" && prev.level === level) {
        const prevRow = page.rows[i - 1];
        if (prevRow && line.y - prevRow.y <= line.size * 1.6 && !inTable.has(i - 1)) {
          prev.text += ` ${line.text}`;
          continue;
        }
      }
      blocks.push({ kind: "heading", level, text: line.text });
      continue;
    }

    const bullet = line.text.match(BULLET_RE) ?? line.text.match(DASH_BULLET_RE);
    const numbered = line.text.match(NUMBERED_RE);
    if (bullet || numbered) {
      blocks.push({
        kind: "list",
        marker: numbered ? `${numbered[1]}.` : "-",
        text: line.text.slice((bullet ?? numbered)![0].length),
      });
      continue;
    }

    // Wrapped continuation of the previous paragraph or list item.
    const prevLine = prev?.kind === "para" ? prev.lines[prev.lines.length - 1] : null;
    const gap = prevLine ? line.y - prevLine.y : Infinity;
    if (prev?.kind === "para" && prevLine && Math.abs(line.size - prevLine.size) <= 0.5 && line.bold === prevLine.bold && gap > 0 && gap <= line.size * 1.75) {
      prev.lines.push(line);
      continue;
    }
    if (prev?.kind === "list") {
      const prevRow = page.rows[i - 1];
      if (prevRow && line.y - prevRow.y <= line.size * 1.75 && line.x > page.rows[i - 1].items[0].x - 1) {
        prev.text += ` ${line.text}`;
        continue;
      }
    }
    blocks.push({ kind: "para", lines: [line] });
  }
  return blocks;
}

function renderBlock(b: Block): string {
  switch (b.kind) {
    case "heading":
      return `${"#".repeat(b.level)} ${escapeInline(b.text)}`;
    case "list":
      return `${b.marker} ${escapeInline(b.text)}`;
    case "table": {
      const width = Math.max(...b.grid.map((r) => r.length));
      const row = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => escapeCell(cells[i] ?? "")).join(" | ")} |`;
      return [row(b.grid[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...b.grid.slice(1).map(row)].join("\n");
    }
    case "para": {
      const text = escapeLineStart(escapeInline(joinWrapped(b.lines)));
      const first = b.lines[0];
      if (first.bold && b.lines.every((l) => l.bold)) return `**${text}**`;
      if (first.italic && b.lines.every((l) => l.italic)) return `*${text}*`;
      return text;
    }
  }
}

/** Turn extracted pages into a Markdown string. Pure; exported for tests. */
export function pagesToMarkdown(pages: PageText[]): string {
  const body = bodySize(pages);
  const out: string[] = [];
  for (const page of pages) {
    const blocks = pageBlocks(page, body);
    blocks.forEach((b, i) => {
      // Keep consecutive list items tight; everything else is separated by a blank line.
      const sep = i > 0 && b.kind === "list" && blocks[i - 1].kind === "list" ? "\n" : "\n\n";
      out.push(out.length ? sep : "", renderBlock(b));
    });
  }
  return out.join("").trim() + "\n";
}

export async function pdfToMarkdown(file: File): Promise<ToolResult & { markdown?: string }> {
  try {
    const pages = await extractPageText(file, { withStyles: true });
    if (!hasText(pages)) return { success: false, error: NO_TEXT_FOR_CONVERT };
    const markdown = pagesToMarkdown(pages);
    return {
      success: true,
      markdown,
      blob: new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      filename: file.name.replace(/\.pdf$/i, "") + ".md",
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Conversion failed. Make sure the file is a valid PDF.") };
  }
}

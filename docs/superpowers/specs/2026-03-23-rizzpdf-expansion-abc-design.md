# RizzPDF Expansion — Sub-projects A, B, C Design Spec

**Date:** 2026-03-23

---

## Overview

Expand RizzPDF from a single-tool (Unlock PDF) site into a full iLovePDF-competitive toolkit.

- **A — Quick wins:** Homepage redesign, Protect PDF tool, 200MB display limit, mobile app placeholder
- **B — Icons redesign:** Replace all tool icons with iLovePDF-style document+badge icons
- **C — New tools:** PDF to Word, Batch Processing UI

Sub-project D (API) is deferred until A, B, C are complete.

---

## Sub-project A: Quick Wins

### A1 — Homepage redesign

**Current:** Unlock PDF hero section at top (`app/page.tsx`), tool grid below.

**New:** Remove the unlock hero entirely. Replace `app/page.tsx` main section with a category-based tool hub.

**Layout:**
- Navbar (no changes)
- Minimal hero bar: `h1` "Every PDF tool you need" + tagline "100% private · runs in your browser · free for 3 files"
- Three category sections with header + horizontal rule + 4-column `ToolCard` grid:
  - **Organize PDF:** Merge, Split, Organize, Delete Pages, Rotate, Page Numbers
  - **Convert PDF:** PDF to JPG, JPG to PDF, PDF to Word *(NEW badge)*, Compress, PDF to PNG
  - **Edit & Security:** Protect *(NEW badge)*, Unlock, Watermark, Sign, Repair

**Unlock PDF moves:** Create `app/tools/unlock/page.tsx` — copy the existing unlock logic from `app/page.tsx` verbatim (UploadZone + FileCard + PaywallModal + counter). The homepage card links to `/tools/unlock`.

**`app/tools/page.tsx` — required changes alongside A1:**
- Add new tools to TOOLS array: PDF to Word (`/tools/pdf-to-word`), Protect (`/tools/protect`), Batch (`/tools/batch`)
- Recategorize existing tools to match the new taxonomy (see table below)
- Rename CATEGORIES array (line 88) from `["All", "Organize PDF", "Convert PDF", "Edit PDF", "PDF Security"]` to `["All", "Organize PDF", "Convert PDF", "Edit & Security"]`
- Replace the `svg` prop on each TOOLS entry with `icon: ReactNode` (new ToolIcon — see Sub-project B)

**Full category recategorization for `app/tools/page.tsx`:**

| Tool | Old category | New category |
|------|-------------|--------------|
| Compress PDF | `"Organize PDF"` | `"Convert PDF"` |
| Watermark PDF | `"Edit PDF"` | `"Edit & Security"` |
| Page Numbers | `"Edit PDF"` | `"Organize PDF"` |
| Sign PDF | `"Edit PDF"` | `"Edit & Security"` |
| Repair PDF | `"PDF Security"` | `"Edit & Security"` |
| (all others) | unchanged | unchanged |

### A2 — New shared component: `components/ToolCard.tsx`

Used on both `app/page.tsx` and `app/tools/page.tsx`. Replaces the existing inline `<a>` tool tiles.

```tsx
interface ToolCardProps {
  name: string
  description: string
  route: string
  icon: ReactNode        // <ToolIcon .../> from Sub-project B
  badge?: "NEW" | "HOT" | "PRO"
}
```

**Visual spec (matches approved mockup):**
- `<a href={route}>` wrapper
- White card, `rounded-2xl`, `border border-gray-100`, `shadow-sm`
- Hover: `border-red-400 shadow-md -translate-y-px transition-all`
- `padding: 20px 18px 18px`, `min-height: 160px`
- Flex column, `align-items: flex-start`, `justify-content: space-between`
- **Icon:** top-left, 56×56px container, `rounded-xl`, colored bg via ToolIcon's `bgColor`
- **Name:** `text-[15px] font-extrabold text-gray-900`, 14px gap below icon
- **Description:** `text-xs text-gray-500`, `leading-relaxed`
- **Badge pill** (if present): `absolute top-3 right-3`, red/orange bg, white 9px bold text

**Migration from old TOOLS arrays:** Both `app/page.tsx` and `app/tools/page.tsx` currently have a `TOOLS` array with a `svg` field. Rename `svg` → `icon` and change the value from an inline `<svg>` to `<ToolIcon .../>`. Keep all other fields (`name`, `route`, `category`, `desc`/`description`).

### A3 — Protect PDF tool

**Route:** `/tools/protect`

**Functionality:** Browser-only. `pdf-lib` supports password encryption via `PDFDocument.save({ userPassword, ownerPassword })`. Note: pdf-lib uses **RC4-128 encryption** — do not use the word "AES" in UI copy. Use "password protected" generically.

**UI flow:**
1. Upload PDF (UploadZone)
2. WorkspaceBar: filename + size
3. Password input with show/hide toggle
4. "Advanced options" collapsible: owner password field
5. "Protect & Download →" button → downloads `filename_protected.pdf`

**`lib/pdf-tools.ts`:** Add:
```ts
export async function protectPDF(
  file: File,
  userPassword: string,
  ownerPassword?: string
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }>
```

**`components/ToolShell.tsx` `icon` prop:** ToolShell has two icon props — `icon: string` (required, emoji, used for page title) and `svgIcon?: ReactNode` (rendered inside the fixed red banner). For the Protect page pass `icon="🔒"` and `svgIcon={<lock SVG in white>}`. The `bgColor` from ToolIcon does **not** apply inside ToolShell's red banner — pass a plain white SVG there.

### A4 — Increase file size display to 200MB

**Current:** `components/UploadZone.tsx` line 88 shows hardcoded text: `"up to 10MB per file (free)"`. There is no programmatic file size validation in the codebase.

**Change:** Update that string to `"up to 200MB per file"`. No other code changes.

### A5 — Mobile app reminder placeholder

**Location:** `app/page.tsx`, above `<Footer />`

**Design:** Static section:
- Headline: "RizzPDF app — coming soon"
- Subtext: "Take PDF tools anywhere. iOS and Android."
- Two grayed-out placeholder badge buttons: "App Store" and "Google Play" (SVG badge style, `opacity-40 cursor-not-allowed`)
- Email input placeholder: `<input placeholder="your@email.com">` + "Notify me" button (no backend wiring — `onClick` is a no-op for now)

---

## Sub-project B: Icons Redesign

### Confirmed icon style

White document with folded top-right corner, colored format badge pill in bottom-right corner. Two variants:
1. **Single doc** — one document + one badge (used for tools that don't convert between formats)
2. **Double doc** — two overlapping documents with different badges (conversion tools: front = source, back = output)

### Context: where ToolIcon is used

**In `ToolCard`** (homepage + /tools grid): The `bgColor` rounded-square container is fully visible. ToolIcon renders the complete icon.

**In `ToolShell` `svgIcon` prop**: Renders inside a fixed red (`bg-red-600`) banner. Pass a plain white document/symbol SVG here. The `ToolIcon` component has a `bare` prop — when `bare={true}` it renders just the document shape without the colored container, suitable for red banner placement.

### New component: `components/ToolIcon.tsx`

```tsx
interface ToolIconProps {
  variant: "single" | "double"
  bgColor: string           // container bg, e.g. "#fff3f3" — ignored when bare=true
  badgeColor: string        // front/only doc badge color
  badgeLabel: string        // front/only doc badge text, e.g. "PDF"
  badgeColor2?: string      // double variant: back doc badge color
  badgeLabel2?: string      // double variant: back doc badge text
  innerContent?: ReactNode  // rendered inside doc body (lock icon, sig line, etc.)
  size?: number             // container size px, default 56
  bare?: boolean            // omit colored container — render doc only (for ToolShell banner)
}
```

**Render spec for single doc:**
- Outer: `size × size` px, `border-radius: 12px`, `background: bgColor` (hidden if `bare`)
- Doc body: white, `width: 34px, height: 42px`, `border-radius: 4px`, `box-shadow: 0 1px 5px rgba(0,0,0,0.20)`
- Fold: top-right `9×9px` triangle, `background: #e0e0e0`
- Lines: 2–3 horizontal gray lines inside body (decorative)
- Badge: `position: absolute; bottom: -6px; right: -7px`, colored bg, white text, `8px font-weight:800`, `border-radius: 4px`, `padding: 2px 5px`

**Render spec for double doc:**
- Back doc: positioned slightly top-right, `opacity: 0.85`, badge for output format
- Front doc: overlapping, same spec as single doc, badge for source format

### Icon definitions per tool

| Tool | Variant | BG | Badge 1 (front) | Badge 2 (back) | Inner |
|------|---------|----|---------|---------|-------|
| Merge PDF | double | #fff3f3 | PDF #ef4444 | — (no badge on back doc) | — |
| Split PDF | single | #fff7ed | PDF #f97316 | — | — |
| Compress PDF | single | #f0fdf4 | ZIP #22c55e | — | — |
| Rotate PDF | single | #fef2f2 | PDF #ef4444 | — | rotation arrow SVG |
| Organize PDF | single | #fefce8 | PDF #eab308 | — | — |
| Delete Pages | single | #fff7ed | PDF #f97316 | — | — |
| Page Numbers | single | #f0fdfa | PDF #14b8a6 | — | — |
| Repair PDF | single | #f5f3ff | PDF #8b5cf6 | — | — |
| PDF to JPG | double | #f0f9ff | PDF #ef4444 | JPG #3b82f6 | — |
| PDF to PNG | double | #f0fdfa | PDF #ef4444 | PNG #14b8a6 | — |
| JPG to PDF | double | #eff6ff | JPG #3b82f6 | PDF #ef4444 | — |
| PDF to Word | double | #eff6ff | PDF #ef4444 | DOC #2563eb | — |
| Protect PDF | single | #fdf4ff | PDF #a855f7 | — | lock SVG (white on purple bg inside doc) |
| Unlock PDF | single | #fef2f2 | PDF #ef4444 | — | open-lock SVG |
| Watermark PDF | single | #fff0f9 | PDF #ec4899 | — | — |
| Sign PDF | single | #fff7ed | PDF #f97316 | — | signature-curve SVG |
| Batch | single | #f0fdf4 | PDF #22c55e | — | stacked-layers SVG |

### Files to update for B

- `app/page.tsx` — TOOLS array: rename `svg` → `icon`, value becomes `<ToolIcon .../>`
- `app/tools/page.tsx` — same
- `components/ToolShell.tsx`:
  - Update `MORE_TOOLS` array (lines 6–19): add `{ name: "Protect PDF", href: "/tools/protect" }`, `{ name: "PDF to Word", href: "/tools/pdf-to-word" }`, `{ name: "Batch Processing", href: "/tools/batch" }`
  - Individual tool page `svgIcon` props: update to use bare ToolIcon or keep plain white SVGs — either is acceptable

---

## Sub-project C: New Tools

### C1 — PDF to Word

**Route:** `/tools/pdf-to-word`

**Approach:** 100% browser-based.
1. `pdfjs-dist` (already installed) — extract text content per page via `page.getTextContent()`
2. `docx` npm package — generate `.docx` from extracted text

**Required install:** `npm install docx`

**Quality caveat:** Good for text-based PDFs. Complex layouts, scanned PDFs, and image-heavy files produce simplified output. Standard behavior for all browser-based converters.

**`lib/pdf-tools.ts`:** Add:
```ts
export async function pdfToWord(
  file: File
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }>
```

Implementation outline:
```ts
import * as pdfjsLib from "pdfjs-dist"
import { Document, Packer, Paragraph, TextRun } from "docx"

// 1. const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
// 2. For each page (1..pdf.numPages):
//    const content = await page.getTextContent()
//    Group content.items by y-position (±3px threshold) → lines[]
//    Each line → join item.str values with spaces
// 3. Build paragraphs: lines.map(line => new Paragraph({ children: [new TextRun(line)] }))
//    Insert blank Paragraph() between pages
// 4. const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] })
// 5. const blob = await Packer.toBlob(doc)
// 6. return { success: true, blob, filename: file.name.replace(/\.pdf$/i, ".docx") }
```

**UI:** ToolShell layout. Upload → show page count after load → "Convert to Word →" → download `.docx`. No preview needed.

**ToolShell props:** `icon="📝"`, `svgIcon={<double-doc bare SVG, PDF→DOC, white>}`

> **Pre-existing bug to fix:** `ToolShell.tsx` declares `icon: string` in `ToolShellProps` (line 24) but omits it from the destructured function params on line 30 — the prop is silently dropped. When adding new tool pages, add `icon` to the destructure: `{ name, description, icon, svgIcon, steps, children }`. No other changes to ToolShell needed for this.

### C2 — Batch Processing UI

**Route:** `/tools/batch`

**Required install:** `npm install jszip`

**Supported batch operations:**
- Compress PDF (options: quality `"screen" | "ebook" | "printer"`)
- Rotate PDF (options: angle `90 | 180 | 270`)
- PDF to JPG (no extra options)
- Watermark PDF (options: text `string`)
- Protect PDF (options: password `string`)

**`lib/pdf-tools.ts`:** Add type and function:

```ts
type BatchOptions =
  | { tool: "compress"; quality: "screen" | "ebook" | "printer" }
  | { tool: "rotate"; angle: 90 | 180 | 270 }
  | { tool: "pdf-to-jpg" }
  | { tool: "watermark"; text: string }
  | { tool: "protect"; password: string }

export async function batchProcess(
  files: File[],
  options: BatchOptions,
  onProgress: (fileIndex: number, status: "processing" | "done" | "error", error?: string) => void
): Promise<Array<{ blob: Blob; filename: string } | null>>
```

Implementation: run existing single-file functions in batches of 3 concurrent (simple counter-based semaphore, no library). Return `null` for any file that errored.

**UI flow (`app/tools/batch/page.tsx`):**
1. Tool selector: `<select>` at top with 5 options
2. Per-tool options panel (shown/hidden based on selected tool):
   - Compress: 3-option radio (Screen / eBook / Printer quality)
   - Rotate: 3-option radio (90° / 180° / 270°)
   - PDF to JPG: no options
   - Watermark: text input
   - Protect: password input with show/hide
3. UploadZone with `multiple` enabled
4. File list: each row shows filename, size, status badge (idle → processing → done/error)
5. "Process All →" triggers batch job
6. When all done: "Download All as ZIP →" uses jszip to bundle output files

**Free tier counter interaction:**
- Check counter **before** starting: if remaining free uses < number of files, show PaywallModal
- Increment counter by 1 **per file successfully processed** (not per batch job, not for errors)
- Failed files do not consume a use

**PRO badge:** Show a "PRO — unlimited files" pill in the page header. No enforcement — purely informational for now.

---

## Shared Design Decisions

### Category taxonomy — enforced consistently on both homepage and /tools page

| Category | Tools |
|----------|-------|
| Organize PDF | Merge, Split, Organize, Delete Pages, Rotate, Page Numbers |
| Convert PDF | PDF to JPG, PDF to PNG, JPG to PDF, PDF to Word, Compress |
| Edit & Security | Protect, Unlock, Watermark, Sign, Repair, Batch |

### Free tier counter

Existing `rizzpdf_bulk_until` localStorage key and PaywallModal work unchanged. Counter increments once per successfully processed file. Batch processes multiple files — each successful file = 1 increment.

### Paid plan gating — no enforcement yet, UI signaling only

Mark with "PRO" badge but do not block:
- Extreme compression option in Compress tool
- Watermark PDF
- Batch Processing > 3 files

---

## File Summary

### New files

| File | Purpose |
|------|---------|
| `components/ToolCard.tsx` | Square tool card for homepage + /tools grid |
| `components/ToolIcon.tsx` | Document+badge icon component |
| `app/tools/unlock/page.tsx` | Unlock PDF moved here from homepage |
| `app/tools/protect/page.tsx` | New Protect PDF tool |
| `app/tools/pdf-to-word/page.tsx` | New PDF to Word converter |
| `app/tools/batch/page.tsx` | Batch Processing UI |

### Modified files

| File | Key changes |
|------|-------------|
| `app/page.tsx` | Remove unlock hero; add category hub with ToolCard grid; add mobile app placeholder section above footer |
| `app/tools/page.tsx` | Add 3 new tools; rename `svg` → `icon` (ReactNode); recategorize 5 tools (table in A1); rename CATEGORIES array to use "Edit & Security" |
| `lib/pdf-tools.ts` | Add `protectPDF`, `pdfToWord`, `batchProcess` + `BatchOptions` type |
| `components/UploadZone.tsx` | Line 88: update display text to `"up to 200MB per file"` |
| `components/ToolShell.tsx` | Add Protect, PDF to Word, Batch to `MORE_TOOLS` array (lines 6–19) |
| `app/sitemap.ts` | Add 4 new entries using the existing `MetadataRoute.Sitemap` pattern: `/tools/unlock` (priority 0.9), `/tools/protect` (priority 0.8), `/tools/pdf-to-word` (priority 0.8), `/tools/batch` (priority 0.7) — all with `changeFrequency: "monthly"` |

### New packages

| Package | Used for |
|---------|---------|
| `docx` | Generate .docx Word files |
| `jszip` | ZIP bundling for batch downloads |

---

## Out of Scope

- Sub-project D: API (B2B developer product, after A/B/C complete)
- Mobile app backend/notifications (static placeholder only)
- Stripe/Clerk integration changes
- Supabase file history
- Actual PRO feature enforcement (badges only)

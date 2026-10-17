# iLovePDF competitive gap analysis

A black-box comparison of RizzPDF against iLovePDF's public tool lineup, used to
decide what to build next. This is an outside-in feature comparison only — it is
based on iLovePDF's publicly listed tools and visible UX, not on any inspection
of their code or systems.

## Where RizzPDF already matches or beats iLovePDF

RizzPDF's defining advantage is that **everything runs in the browser** — files
never touch a server. iLovePDF uploads every file to its backend (and gates
heavy use behind a login + paid tiers). For privacy-sensitive documents that is
a real, marketable difference, and it also means no per-file size pressure from
server costs.

Tools present on both: Merge, Split, Compress, Rotate, Page numbers, Watermark,
Organize, Delete pages, JPG↔PDF, PDF to Word, Word/Excel/PowerPoint to PDF, OCR,
Crop, Edit text, Redact, Fill form, Flatten, Repair, Protect, Unlock, Sign.

## Gaps identified (iLovePDF had, RizzPDF didn't)

| iLovePDF tool | Built in this pass? | Notes |
|---|---|---|
| Extract pages | ✅ `/tools/extract-pages` | Select pages to keep → new PDF. |
| PDF to Excel | ✅ `/tools/pdf-to-excel` | Table detection → real `.xlsx`, numbers stay numeric. |
| PDF to PowerPoint | ✅ `/tools/pdf-to-powerpoint` | One slide per page (page rendered as a full-slide image). |
| PDF to Markdown | ✅ `/tools/pdf-to-markdown` | Headings/lists/tables → Markdown. Great for LLM pipelines; iLovePDF only just added this. |
| Compare PDF | ✅ `/tools/compare` | Word-level text diff, side by side. |
| PDF to PDF/A | ⬜ not yet | Archival conformance is hard to guarantee purely client-side; needs research. |
| HTML to PDF | ⬜ not yet | Would need to fetch a URL — breaks the "files never leave the browser" promise unless scoped to pasted HTML. |
| Scan to PDF | ⬜ not yet | Phone-camera capture; better suited to the mobile app. |
| AI Summarizer / Translate PDF | ⬜ deliberately deferred | These require a server-side LLM call, which conflicts with the client-only architecture. Worth a separate design discussion (bring-your-own-key, or an explicit opt-in that uploads text only). |

## Design choices worth noting

- **PDF to PowerPoint** honestly advertises "slides hold a picture of each page,"
  not editable text boxes. Faithful, fully client-side, and the copy matches the
  behaviour (per the tool-audit convention in `CLAUDE.md`).
- **PDF to Excel / Markdown** share one text-layout extractor
  (`lib/tools/pdf-text.ts`) with reusable table detection, so the two tools stay
  consistent and the logic is unit-tested once.
- **Compare PDF** computes an LCS word diff entirely in memory; nothing is
  uploaded, matching the rest of the app.
- The AI tools are the one place iLovePDF's server-side model genuinely enables
  something RizzPDF can't do for free in-browser. That's a strategic decision,
  not an oversight — see the deferred row above.

## Not pursued

- Reverse-engineering iLovePDF's client, API, or infrastructure. Everything here
  is built from scratch with `pdf-lib` / `pdf.js` based on their *publicly
  listed features*, which is all that's needed to close the product gap.

# BentoPDF UX teardown

A read-through of BentoPDF's **actual source** (open-source, AGPL-3.0, cloned for study) to capture the "code that sits on top of the tools" — the UX and glue decisions you can't see from a feature list. Each section notes what they do, how RizzPDF currently compares, and whether it's worth adopting. Nothing here is copied from their AGPL code; these are observations and recommendations to build equivalents on RizzPDF's own stack with permissive libraries.

Reference: `github.com/alam00000/bentopdf` (v2.8.8). RizzPDF paths are relative to this repo.

---

## 0. Architecture, at a glance

| | BentoPDF | RizzPDF |
|---|---|---|
| Shell | Static multi-page HTML + vanilla TS, Vite, no framework | Next.js App Router + React |
| Tools | ~135 logic modules / "100+ tools" | 29 tools |
| Heavy ops | WASM engines (PyMuPDF, Ghostscript, CPDF) from CDN | pdf-lib + pdf.js, now + qpdf (WASM) |
| Offline | Full service-worker PWA | none |
| i18n | ~30 languages | none (en only) |
| Differentiators | Visual workflow builder, in-browser content editor | tool chaining ("Keep going with…") |

The headline: BentoPDF's "feel" advantage isn't any one tool — it's a **thick shared UX layer** (feedback, password, big-file rendering, filename handling, offline) that every tool inherits. RizzPDF has a thinner version of the same idea. Most wins below are in that shared layer, not in individual tools.

---

## 1. Feedback system (loader / alert / confirm)

`src/js/ui.ts` centralizes three primitives every tool reuses:

- **`showLoader(text, progress?)`** — a modal spinner that *optionally renders a real progress bar* (`0–100%`, animated width, percentage text). Long ops (OCR, compress, render) report actual progress, not an indeterminate spinner.
- **`showAlert(title, message, type, callback)`** — one error/info modal, with a fresh-cloned OK button so stale listeners never stack.
- **`warningModal` (confirm/cancel)** — a dedicated destructive-action confirm (distinct from alert).

**RizzPDF today:** each tool renders its own inline status strings (`"Converting…"`, `"Compressing…"`) and a red error `<p>`. No progress percentage; no shared confirm modal.

**Worth adopting:** a shared **progress-aware** loader. RizzPDF's long ops (OCR, compress, PDF→Word image extraction, PDF→PPT rendering) already loop per page — they could emit progress into a shared overlay. This is the single biggest "feels responsive" gap on large files. Medium effort (a small React context like the password one), high perceived-quality payoff.

---

## 2. Password / encryption UX  — *(RizzPDF shipped the core this session; 3 refinements remain)*

`src/js/utils/password-prompt.ts` (847 lines) is the most polished thing in the repo. Beyond the inline prompt RizzPDF just added, it has:

1. **Session password cache (`cachedPassword`).** Once a password unlocks one file, it's remembered for the session and *auto-tried* (validated first) on the next encrypted file — so a 10-file batch with one password prompts **once**, not ten times.
2. **Validate-before-decrypt via pdf.js `onPassword`.** It distinguishes "incorrect password" from "decrypt failed," giving accurate messages — and the failure message points at the Decrypt tool as a fallback.
3. **Batch modal** — "Use same password for all files" checkbox with a per-file fallback list; **Skip All / Unlock All**.
4. Modal serialization (`activeModalPromise`) so two files can't both pop a prompt; Esc = skip, Enter = submit, eye toggle, autofocus, "Validating…/Decrypting…" progress.
5. Wording: **"Skip"** not "Cancel" (you skip *this file*, not abort everything).

**RizzPDF today** (`lib/pdf-unlock-file.ts` + `components/PasswordPromptProvider.tsx`, new): inline prompt, retry-on-wrong, cancel, eye toggle, Esc/Enter — all present. **Missing:** (a) session password cache across a multi-file upload (we re-prompt per file), (b) the batch "same password for all" UI, (c) we rely on `decryptPdf` throwing `WrongPasswordError` rather than a pdf.js pre-validation (functionally fine, slightly less precise).

**Worth adopting:** the **session cache** — small change to `unlockFileIfNeeded` (accept/return a cached password), big win for multi-file tools (merge, batch). The batch UI is lower priority since our `UploadZone` loops files sequentially and the cache alone removes most of the pain.

---

## 3. Big-file rendering — *(real perf gap in RizzPDF)*

`src/js/ui.ts` `renderPageThumbnails` + `renderPagesProgressively` render page thumbnails **in batches of 8 with IntersectionObserver lazy-loading** (`lazyLoadMargin: '300px'`) and a cancellable `renderId`. A 300-page PDF shows its first pages immediately and only rasterizes what scrolls into view.

**RizzPDF today:** `renderThumbnails()` in `lib/pdf-tools.ts` loops **every page eagerly** before the UI shows anything. On a big PDF, split/organize/delete-pages/rotate block on a full render up front.

**Worth adopting:** lazy/progressive thumbnail rendering. This is a concrete, measurable responsiveness win on exactly the large files power users bring, and it's self-contained to the thumbnail-grid components. Medium effort.

---

## 4. Per-tool interaction depth

Small touches that read as "polished" when you actually use the tools:

- **Rotate** (`ui.ts`): each page has a stepper (`−`/`+` 1°, arbitrary-angle number input, and a separate **+90°** button), with a "Rotate All" state that applies to lazy-loaded pages too. RizzPDF rotate is coarser (whole-doc / 90° steps).
- **Delete-pages**: clicking a thumbnail two-way-binds into a `"1, 3, 5-7"` text input (and vice-versa) — visual *and* typed selection stay in sync. RizzPDF uses a selection set only.
- **Organize**: SortableJS drag (ghost/chosen/drag classes) + per-page delete button that **renumbers** live.

**Worth adopting selectively.** The delete-pages two-way range binding is a nice, cheap upgrade. The rotate stepper is more than most users need. Low priority vs. the shared-layer wins.

---

## 5. Filename de-duplication

`src/js/utils/deduplicate-filename.ts`: collision-safe output names (`doc.pdf`, `doc (1).pdf`, …) via a `usedNames` set. Used when a tool emits many files (split, convert-to-images) so a ZIP never contains two `page.pdf`.

**RizzPDF today:** split/pdf-to-image name by index (`_part1`, `_page1`) so collisions are unlikely, but a shared helper would harden merge/batch outputs. Trivial effort; adopt when touching batch.

---

## 6. WASM engine provider model — *(and the licensing reality)*

`src/js/utils/wasm-provider.ts` + `config/wasm-cdn-config.ts`: heavy engines load from **jsDelivr CDN by default**, with:
- A **trusted-host allowlist**; untrusted URLs stored in localStorage are scrubbed on load.
- **User-configurable URLs** (Advanced Settings) + **env overrides** (`VITE_WASM_*`) for **air-gapped / self-hosted** deployments.
- URL validation (fetch a known test file, check status, CORS, content-type).

The engines behind their best tools:

| Engine | Powers | License |
|---|---|---|
| **PyMuPDF** (`@bentopdf/pymupdf-wasm`) | compress, extraction | 🔴 AGPL / commercial |
| **Ghostscript** (`@bentopdf/gs-wasm`) | PDF/A, deep compress | 🔴 AGPL / commercial |
| **CPDF / coherentpdf** | structure ops | 🔴 AGPL / commercial |
| Tesseract | OCR | 🟢 Apache-2.0 (RizzPDF uses it too) |

**Takeaway:** BentoPDF's own code *and* its three flagship engines are copyleft. For a commercial RizzPDF, those engines are off the table without AGPL/commercial licensing — which is why this session used **qpdf (Apache-2.0)** for structural compression + linearize instead, and keeps image work on canvas. The architecture lesson worth copying is the *shape*: default source + env override + validation, so self-host/air-gap stays possible. (RizzPDF chose to bundle qpdf from its own origin, which already gives the air-gap property for free.)

---

## 7. Offline / PWA — *(RizzPDF has none; strong brand-fit win)*

`src/js/sw-register.ts` + `sw.js`: a full service worker caches the app for **offline use**, checks for updates every 24h, prompts **"A new version is available. Reload?"**, reloads on `controllerchange`, and is told its trusted CDN hosts via `postMessage`. Dev mode is skipped to avoid HMR conflicts.

**RizzPDF today:** no service worker; the app needs the network to load.

**Worth adopting:** a PWA/offline layer is a *brand-perfect* feature for a "files never leave your browser" tool — "works with no connection, nothing to install." Next supports it (e.g. a service worker + manifest). Medium effort, high marketing value, and it reinforces the core privacy pitch. Strong candidate.

---

## 8. Keyboard shortcuts

`logic/shortcuts.ts` + the shortcuts modal (`ui.ts`): a customizable shortcut system with **search, reset, import/export** of bindings. Power-user polish; niche. Low priority for RizzPDF's audience.

---

## 9. Visual workflow builder — *(their flagship differentiator)*

`src/js/workflow/` is a **Rete.js node-graph editor**: users drag tool "nodes" (compress, crop, encrypt, decrypt, merge, download, download-zip, …) onto a canvas and wire them into a reusable pipeline (`editor.ts`, `engine.ts`, `serialization.ts`, 40+ node types). It's the thing a feature list most undersells.

**RizzPDF today:** the lightweight **"Keep going with …"** chaining in `components/NextSteps.tsx` — hands the last output to the next tool, no re-upload. Much simpler, but covers the 80% case (sequential two-/three-step flows) with far less UI.

**Recommendation:** *don't* build a node editor. It's a huge surface for a feature most users won't touch. Instead, strengthen the chaining you have — e.g. "recently used together" suggestions, or a saved 2–3 step "recipe." The node graph is a cautionary tale about scope, not a target.

---

## 10. In-browser content editor

`src/js/editcore/` (`streamsplice`, `tagsurgery`, `shadingsurgery`, `type3surgery`) is a genuine PDF content-stream editor — it rewrites page operators to edit text/graphics in place. Sophisticated and fragile; far beyond RizzPDF's `edit-text` overlay approach. Not recommended to chase; the ROI is poor and the edge cases are brutal.

---

## 11. i18n & SEO plumbing

- **~30 locales** (`src/js/i18n/*`), with a language switcher and per-locale static page generation at build time.
- **Runtime `config.json`** (`utils/disabled-tools.ts`) lets a self-host deployment disable tools without rebuilding, and maps **renamed tool IDs** (`decrypt-pdf → unlock-pdf`) so old URLs keep working.

**RizzPDF today:** English-only; per-tool `layout.tsx` with strong metadata + JSON-LD already (good). i18n is a large, separable effort; worth it only if analytics show meaningful non-English traffic. The renamed-ID redirect idea is a cheap SEO safety net if RizzPDF ever renames a route.

---

## Prioritized recommendations for RizzPDF

Ranked by (perceived-quality payoff ÷ effort), with licensing/status noted:

1. **✅ Inline password prompt across all tools** — *done this session* (`PasswordPromptProvider` + `unlockFileIfNeeded`). Add the **session password cache** next (small).
2. **Progress-aware shared loader** (§1) — biggest "feels responsive" win; medium effort, no licensing issues.
3. **Lazy/progressive thumbnail rendering** (§3) — fixes real jank on big PDFs; medium effort.
4. **PWA / offline** (§7) — on-brand for "private, in your browser"; medium effort, high marketing value.
5. **DPI-threshold compress heuristics** (from the earlier review) — only re-encode images above a DPI threshold; small, pure technique.
6. **Delete-pages two-way range binding + filename dedup** (§4, §5) — cheap polish; do when touching those tools.
7. **Skip / defer:** node-graph workflow builder (§9), content-stream editor (§10), customizable shortcuts (§8), and anything on PyMuPDF/Ghostscript/CPDF (§6, AGPL/commercial — use qpdf/permissive libs instead).

The through-line: RizzPDF closes most of the "feel" gap by **thickening its shared UX layer** (feedback, password cache, big-file rendering, offline), not by adding more tools — and it does so without touching BentoPDF's AGPL code or copyleft engines.

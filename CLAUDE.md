# RizzPDF

**Stack:** Next.js App Router, Tailwind CSS, pdf-lib + PDF.js (browser), Clerk (auth), Supabase, Stripe
**Dev:** `npm run dev` (port 3000)
**Repo:** `C:/Users/kael_/rizzpdf-app` · GitHub: `https://github.com/Nanz876/rizzpdf.git` (main → auto-deploys to Vercel)

## Core rule
All PDF processing is client-side only. Files never leave the browser. Never add server-side file handling.

## Non-obvious rules

**PDF.js workerSrc:** Use `"/pdf.worker.min.mjs"` — not `new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url)`.

**PDF.js import:** Always dynamic (`await import("pdfjs-dist")`) — avoids SSR DOMMatrix errors.

**Loading PDFs for editing:** Always use `loadPdf()` from `lib/pdf-load.ts`, never `PDFDocument.load(..., { ignoreEncryption: true })`. pdf-lib can't decrypt, so editing an encrypted file silently produces garbled pages. `loadPdf` decrypts restriction-only files losslessly (`@pdfsmaller/pdf-decrypt`) and throws a clear "unlock it first" error for password-protected ones. Place anything on a page (text, images) through `displayedPage()` so rotated and cropped pages work.

**Tool audit tests:** `lib/__tests__/tools.audit.test.ts` checks each tool against what the site advertises, using fixtures from `node scripts/generate-audit-fixtures.mjs` (`test-fixtures/audit/`). If you change a tool's behaviour or its marketing copy, update these tests.

**Monetization tiers:**
- Free: every single-file tool is free and unlimited (no gate). Only batch processing is metered: 3 free runs via `lib/useFreeGate.ts` (localStorage `rizzpdf_free_batch_count`), called from `app/tools/batch/page.tsx`. Use the same hook for any future paid feature; never add per-tool counters.
- Pro $5/mo or $48/yr (the only paid tier; the $1 day pass was retired 2026-09-16): Clerk user + Supabase `subscriptions` table (UNIQUE on `user_id`; webhook upserts with `onConflict: "user_id"` and returns 500 on DB errors so Stripe retries). Stripe API 2025-03+ moved `current_period_end` onto subscription items; always read it via `lib/stripe-rows.ts`.

**Paywall:** `components/PaywallModal.tsx` is the only paywall UI. Gated features render it from `useFreeGate().showPaywall`.

**Tests:** `npm test` (Vitest, jsdom). Unit tests live in `lib/__tests__/`. PDF processing is verified in the browser with `test-fixtures/smoke/`.

**Funnel events:** `logTool("event:paywall_shown")` and `logTool("event:checkout_started:pro")` write to the `tool_usage` table alongside tool names.

**Supabase:** `lib/supabase.ts` has browser + admin clients. Admin uses service role key (server only).

**Web Worker for pdf-lib:** pdf-lib-only tool functions (merge, split, rotate, organize, delete-pages, page-numbers, watermark, sign, protect, unlock's decrypt step, non-permanent crop, flatten, fill-form) run via `runInWorker()` from `lib/worker/run.ts`, which falls back to calling the function directly on the main thread if `Worker` is unavailable or errors. Worker code (`lib/worker/pdf-worker.ts` and anything it imports) must never touch the DOM (`document`, `canvas`, `window`) — canvas/pdf.js rendering (compress, PDF-to-image, permanent crop, thumbnails) stays on the main thread. Register any new worker-safe function in both `lib/worker/pdf-worker.ts`'s `FUNCTIONS` map and `lib/worker/run.ts`'s `DIRECT` map, plus `lib/worker/types.ts`'s `WorkerFnName`.

## Vercel
`https://vercel.com/michael-nanans-projects/rizzpdf`

**Worker import cycle:** code under `lib/` must never import `lib/worker/run` (only pages and components may). The worker bundle imports `lib/` tool code, so a library file that spawns the worker makes the Turbopack production build recurse and hang forever. A test in `lib/__tests__/batch3.test.ts` enforces this.

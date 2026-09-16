# RizzPDF

**Stack:** Next.js App Router, Tailwind CSS, pdf-lib + PDF.js (browser), Clerk (auth), Supabase, Stripe
**Dev:** `npm run dev` (port 3000)
**Repo:** `C:/Users/kael_/rizzpdf-app` · GitHub: `https://github.com/Nanz876/rizzpdf.git` (main → auto-deploys to Vercel)

## Core rule
All PDF processing is client-side only. Files never leave the browser. Never add server-side file handling.

## Non-obvious rules

**PDF.js workerSrc:** Use `"/pdf.worker.min.mjs"` — not `new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url)`.

**PDF.js import:** Always dynamic (`await import("pdfjs-dist")`) — avoids SSR DOMMatrix errors.

**Monetization tiers:**
- Free: 3 operations total across all tools. Enforced only by `lib/useFreeGate.ts` (localStorage `rizzpdf_free_count`); every `app/tools/*/page.tsx` calls `gate.consume()` in its primary handler. Never add per-tool counters.
- Day pass $1/24hr: localStorage `rizzpdf_bulk_session` (paid Stripe session id) — no account needed. `useProStatus` re-validates it against `/api/verify-session` server-side every load (checks payment_status/mode + derives the 24h window from Stripe's `created` timestamp), so a tampered localStorage value can't grant access. Legacy `rizzpdf_bulk_until` timestamp is no longer trusted.
- Pro $5/mo or $48/yr: Clerk user + Supabase `subscriptions` table (UNIQUE on `user_id`; webhook upserts with `onConflict: "user_id"` and returns 500 on DB errors so Stripe retries). Stripe API 2025-03+ moved `current_period_end` onto subscription items; always read it via `lib/stripe-rows.ts`.

**Paywall:** `components/PaywallModal.tsx` is the only paywall UI. Tools render it from `useFreeGate().showPaywall`.

**Tests:** `npm test` (Vitest, jsdom). Unit tests live in `lib/__tests__/`. PDF processing is verified in the browser with `test-fixtures/smoke/`.

**Funnel events:** `logTool("event:paywall_shown")` and `logTool("event:checkout_started:<daypass|pro>")` write to the `tool_usage` table alongside tool names.

**Supabase:** `lib/supabase.ts` has browser + admin clients. Admin uses service role key (server only).

## Vercel
`https://vercel.com/michael-nanans-projects/rizzpdf`

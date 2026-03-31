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
- Free: 3 operations (counter in localStorage `rizzpdf_free_count`)
- Bulk $1/24hr: localStorage `rizzpdf_bulk_until` (timestamp) — no account needed
- Pro $7/mo: Clerk user + Supabase `subscriptions` table

**Paywall:** `components/PaywallModal.tsx` handles the $1 upgrade. Reuse across all tools.

**Supabase:** `lib/supabase.ts` has browser + admin clients. Admin uses service role key (server only).

## Vercel
`https://vercel.com/michael-nanans-projects/rizzpdf`

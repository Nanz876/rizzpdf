# RizzPDF Launch Roadmap — Design Spec

**Date:** 2026-09-16
**Status:** Approved by owner (verbal, this session); pending spec review
**Scope:** Three sequential phases to take RizzPDF from "deployed but unmonetized" to "stable, measured, growing, and on Android". Phase 1 is the only phase that produces an implementation plan from this spec; Phases 2 and 3 are roadmap commitments that get their own spec/plan when reached.

## Context (as of 2026-09-16)

- rizzpdf.com is live on Vercel from `main`. 17 tool pages, 14 blog posts, three tiers (Free / $1 day pass / Pro $5 mo or $48 yr) wired to Stripe, Clerk, Supabase.
- Branch `security-hardening-and-seo` (2 commits, pushed, no PR) contains server-validated day-pass checks and best-effort rate limiting. Production does not have it yet.
- Traffic and revenue are effectively zero. No analytics installed. Search Console verification file exists in `public/`.
- Owner capacity for marketing: 1-3 hours/week. No Apple Developer or Google Play accounts yet.
- Sibling repo `rizzpdf-mobile` (Expo SDK 54) is feature-complete with 15 tools; 1 of 3 Jest suites fails on config; a local-history feature is uncommitted.
- Code review (2026-09-16) findings that drive Phase 1 are listed under "Phase 1 / Inputs".

## Decisions made by the owner

1. Phases run in order: stabilize, then web revenue, then mobile.
2. **All 17 tools are gated:** 3 free operations total (shared counter), then the paywall. Day pass and Pro bypass.
3. Growth is SEO-led with one-off listings; no paid ads, no daily-attention launches.
4. Mobile ships Android first; iOS waits for Android signal or an explicit owner call.
5. Pricing stays as the code has it: $1 day pass, Pro $5/mo or $48/yr. Docs are updated to match; the code is not changed.

---

## Phase 1 — Stabilize

### Inputs (verified code-review findings)

| # | Finding | Location |
|---|---------|----------|
| C1 | PDF-to-Word POSTs the file to a Python/Flask function; violates client-side-only rule; no paywall; no rate limit | `app/tools/pdf-to-word/page.tsx:28`, `api/pdf-to-word.py`, `vercel.json` |
| C2 | Stripe webhook `upsert` has no `onConflict`; duplicate rows make `.single()` fail and demote paying users to free | `app/api/webhooks/stripe/route.ts:51,71`, `lib/tier.ts` |
| H1 | Only batch, compress, unlock, watermark enforce the free limit; unlock counts files not operations | `app/tools/*/page.tsx` |
| H2 | `/privacy` and `/terms` are linked from the footer but do not exist (404) | `components/Footer.tsx:31-32` |
| M1 | Unrelated files committed and publicly served: `public/ICC-Elite-cBot.cs`, `public/icc-elite-visual.txt`, `public/test.pdf`, `public/test.jpg`; unreferenced `public/pdfjs-script.js`; `scripts/alphax-prism*.pine` | `public/`, `scripts/` |
| M2 | ESLint config replaces Next's ignores, so it lints the minified PDF.js worker; 79 real errors hidden in 1600 warnings | `eslint.config.mjs:9-15`, `app/blog/**` |
| M3 | Docs say Pro is $7/mo and "16 tools"; code says $5/mo and has 17 tools. README is the create-next-app template | `CLAUDE.md`, `AGENTS.md`, `README.md`, `components/PaywallModal.tsx:49`, `app/pricing/page.tsx` |
| L1 | `/api/cancel` has no try/catch around the Stripe call | `app/api/cancel/route.ts:24-26` |
| L2 | Rate limiting is per-instance in-memory (documented best-effort) | `lib/rate-limit.ts` |

### 1.1 Money bugs

**Webhook upsert (C2).**
- Before changing code: query the Supabase `subscriptions` table definition (via the admin client in a one-off script under `scripts/`) and confirm a UNIQUE constraint on `user_id`. If absent, add one via a migration SQL file committed to `supabase/migrations/` and applied by the owner in the Supabase dashboard (the repo has no migration tooling).
- Change both `upsert(...)` calls to `upsert(row, { onConflict: "user_id" })`.
- Make `getUserTier` and `getSubscription` in `lib/tier.ts` resilient: use `.maybeSingle()` and, if multiple rows exist, prefer the row with the latest `current_period_end`.

**PDF-to-Word (C1).**
- `app/tools/pdf-to-word/page.tsx` calls `pdfToWord()` from `lib/pdf-tools.ts` (already implemented, currently dead) instead of `fetch("/api/pdf-to-word")`.
- Delete `api/pdf-to-word.py`, `requirements.txt`, and the `functions` block in `vercel.json` (leave the file with `{}` or remove it if nothing else is in it).
- Update the page copy: remove the "sent to our secure server" text; say conversion happens in the browser and that layout fidelity is text-first (no server = no pdf2docx layout engine).
- The tool page is gated like every other tool (1.2).

### 1.2 Uniform free-tier gating (H1)

**New hook `lib/useFreeGate.ts`** (client). Single source of truth for the free limit.

```
useFreeGate(): {
  canRun: boolean;         // true if pro/day-pass, or count < 3, or pro status still loading
  remaining: number;       // Infinity for pro; 3 - count otherwise
  consume(): boolean;      // call on process click; returns false and opens paywall if blocked; increments count otherwise
  showPaywall: boolean;
  closePaywall(): void;
  isPro: boolean; loading: boolean;
}
```
- Storage key stays `rizzpdf_free_count` (existing users keep their count). Value is a non-negative integer; anything unparsable is treated as 0.
- Counting rule: one operation = one click of the tool's primary action (process / convert / merge / etc.), regardless of file count. Batch counts as one operation per run.
- While `useProStatus` is still loading, `consume()` allows the run and does not increment (matches the existing "don't enforce until pro status resolves" fix in commit 8f3f655).
- Pro or valid day pass: `consume()` always returns true and never increments.
- `PaywallModal` is rendered by the hook's consumer exactly as today; the hook only owns state.

**Rollout:** every page under `app/tools/*/page.tsx` uses the hook. The four existing implementations are replaced, not kept alongside. Unlock's file-count gate (3 files max) is removed in favor of the operation rule; its "X of 3 free" banner is rewired to `remaining`.

### 1.3 Legal pages (H2)

- `app/privacy/page.tsx` and `app/terms/page.tsx` with `layout.tsx` metadata, matching the blog page styling.
- Privacy content must state: files are processed in the browser and never uploaded (with the honest exception that nothing is sent except the operation name to `/api/log-tool` and payment data to Stripe); what Clerk and Stripe store; what Supabase stores (subscription status, tool-usage counts, notify-signup emails); how to delete an account (email contact).
- Terms content: service provided as-is, refund policy for the $1 day pass and Pro, acceptable use.
- Both added to `app/sitemap.ts`.

### 1.4 Repo hygiene (M1, M2, M3)

- Copy `public/ICC-Elite-cBot.cs`, `public/icc-elite-visual.txt`, and `scripts/alphax-prism*.pine` to `C:/Users/kael_/trading-scripts/` (outside the repo) before `git rm`. Delete `public/test.pdf`, `public/test.jpg`, `public/pdfjs-script.js` after grepping to confirm no references. Keep `public/google1aad9280ea8df896.html`.
- `eslint.config.mjs`: extend Next's default ignores and add `public/**`. Then fix the remaining real errors (mostly `react/no-unescaped-entities` in blog pages). `npx eslint .` must exit 0.
- `CLAUDE.md` and `AGENTS.md`: Pro is $5/mo ($48/yr); 17 tools; remove the mention of the Python function if any; note the new `useFreeGate` hook as the gating rule.
- `components/PaywallModal.tsx` and `app/pricing/page.tsx`: "16 tools" becomes "17 tools" (or derive from the tool registry if one exists in `app/tools/page.tsx`).
- `README.md`: short project README (what it is, stack, dev commands, env vars list, deploy).

### 1.5 Small hardening and measurement (L1, L2, analytics)

- `app/api/cancel/route.ts`: wrap the Stripe call in try/catch and return a 502 JSON error.
- Rate limiting stays as is. Decision recorded: the only paid path it protects is a $1 Stripe checkout; revisit with Upstash only if Vercel logs show abuse.
- Install `@vercel/analytics` and render `<Analytics />` in `app/layout.tsx`. Enable Web Analytics in the Vercel project (owner action, free tier).
- Funnel events via the existing `/api/log-tool` endpoint and `tool_usage` table: log `paywall_shown`, `checkout_started` (day pass and Pro), and rely on Stripe for `paid`. No new tables; the `tool` column carries the event name prefixed `event:`.

### 1.6 Tests

- Add Vitest (jsdom environment) with `npm test`. No test framework exists today.
- Tests: `useFreeGate` (counting, bypass, loading behaviour, bad localStorage values); webhook `subToRow` mapping; `pdfToWord` produces a `.docx` blob with non-empty text for `test-fixtures/smoke/plain-text.pdf` and `multi-page.pdf`.
- `npx tsc --noEmit`, `npx eslint .`, `npm test`, and `npx next build` must all pass before the PR is opened.

### 1.7 Ship

- Open a PR from `security-hardening-and-seo` to `main` containing all Phase 1 work. Merge on green build. Vercel auto-deploys.
- Post-deploy smoke test on production: every tool runs once with a fixture from `test-fixtures/smoke/`; paywall appears on the fourth operation; `/privacy` and `/terms` return 200; `rizzpdf.com/ICC-Elite-cBot.cs` returns 404.
- Live $1 day-pass checkout is tested only with the owner's go-ahead (real charge).

### Phase 1 error handling and non-goals

- Any tool that fails on a smoke fixture is fixed before merge only if the failure is caused by Phase 1 changes; pre-existing tool bugs are logged as follow-ups, not blockers.
- Non-goals: redesign, new tools, mobile work, distributed rate limiting, moving off localStorage for the free counter (accepted: clearing storage resets the count; the $1 price makes this not worth fighting).

---

## Phase 2 — Web revenue (starts after Phase 1 is live)

Owner capacity is 1-3 hours/week, so the strategy is compounding organic search plus a handful of one-time listings.

1. **Measurement (week 1):** confirm Search Console property, submit sitemap, add Bing Webmaster Tools; verify Vercel Analytics and funnel events are flowing. One weekly 10-minute check of: clicks, tool runs, paywall shown, checkouts, paid.
2. **Content (ongoing):** two blog posts per month targeting long-tail "how to X a PDF without Y" queries, each with a primary tool CTA and internal links to two related posts. Claude drafts; owner approves; merged to `main`. Add internal links among the existing 14 posts once.
3. **Listings (one-time, about 2 hours):** AlternativeTo, SaaSHub, Slant, and a Product Hunt launch. Owner creates accounts and submits; Claude prepares copy, screenshots, and answers.
4. **Exit gate to Phase 3:** first paying customer, or 30 days of clean funnel data, whichever comes first. Each Phase 2 decision after that (pricing changes, new tools) is based on the funnel numbers, not guesses.

Phase 2 gets its own short spec at start; it is not part of the Phase 1 implementation plan.

---

## Phase 3 — Mobile (Android first)

Prerequisites: Phase 2 exit gate met; `/privacy` live (store requirement).

1. Owner creates a Google Play Console account ($25 one-time). Apple Developer ($99/yr) is deferred until Android shows installs or the owner decides otherwise.
2. In `rizzpdf-mobile`: commit the local-history feature (`lib/history.ts`, `app/(tabs)/history.tsx`, `app/tool/[tool].tsx`); fix the Jest transform config so all 3 suites pass; configure RevenueCat Android products matching web tiers; EAS production build; Play internal testing track; production release.
3. Store listing assets (screenshots, short/long description, feature graphic) prepared by Claude, submitted by the owner.
4. iOS repeats step 2-3 with an Apple account when triggered.

Phase 3 gets its own spec and plan at start.

---

## Open items for the owner (not blocking Phase 1 planning)

- Confirm whether the trading-bot files should be preserved at `C:/Users/kael_/trading-scripts/` or somewhere else.
- Enable Vercel Web Analytics in the Vercel dashboard when Phase 1 deploys.
- Say when a real $1 checkout test on production is acceptable.

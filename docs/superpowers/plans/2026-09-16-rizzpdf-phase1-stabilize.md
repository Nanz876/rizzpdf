# RizzPDF Phase 1 (Stabilize) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RizzPDF production-sound: fix the two Stripe entitlement bugs, move PDF-to-Word fully client-side, gate all 17 tools with one shared 3-free-operations hook, add the missing legal pages, clean the repo, add tests and analytics, and ship it to `main`.

**Architecture:** All work happens on the existing `security-hardening-and-seo` branch in `C:/Users/kael_/rizzpdf-app`. A new client hook `lib/useFreeGate.ts` owns the free counter and paywall state; every tool page calls `consume()` in its primary handler and renders the existing `PaywallModal`. Server-side fixes are confined to `app/api/webhooks/stripe/route.ts`, `lib/tier.ts`, and `app/api/cancel/route.ts`. Vitest (jsdom) covers the hook and the webhook row mapper; browser smoke tests cover PDF processing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, pdf-lib, pdfjs-dist 5, docx, Clerk, Supabase JS, Stripe SDK 20, Vitest + @testing-library/react (new), @vercel/analytics (new).

**Spec:** `docs/superpowers/specs/2026-09-16-rizzpdf-launch-roadmap-design.md` (Phase 1).

**Conventions for every task:**
- Shell: Git Bash. Run commands from `C:/Users/kael_/rizzpdf-app`.
- Commit messages end with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never run the dev server with Bash; use the `rizzpdf-dev` entry in `.claude/launch.json` via the browser preview tool.
- Do not make real Stripe charges. Do not run `npm install` for anything not listed in a task.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `vitest.config.ts` | Create | Vitest config: jsdom, `@/` alias |
| `package.json` | Modify | `test` script, new devDependencies, `@vercel/analytics` |
| `lib/useFreeGate.ts` | Create | Shared free-tier counter + paywall state |
| `lib/__tests__/useFreeGate.test.ts` | Create | Hook behaviour tests |
| `lib/stripe-rows.ts` | Create | `subToRow()` (moved out of the route so it can be tested) |
| `lib/__tests__/stripe-rows.test.ts` | Create | Mapper tests incl. period-end on items |
| `app/api/webhooks/stripe/route.ts` | Modify | Use `lib/stripe-rows`, `onConflict: "user_id"` |
| `lib/tier.ts` | Modify | `.maybeSingle()` + newest-period-end row wins |
| `scripts/check-subscriptions-constraint.mjs` | Create | Probe for UNIQUE(user_id) via sentinel upsert |
| `supabase/migrations/20260916_subscriptions_user_id_unique.sql` | Create | Migration (applied by owner only if the probe fails) |
| `app/tools/*/page.tsx` (17 files) | Modify | Use `useFreeGate`, render `PaywallModal` |
| `components/PaywallModal.tsx` | Modify | Copy: "3 free operations", "17 tools", `checkout_started` event |
| `components/SubscribeButton.tsx` | Modify | `checkout_started` event |
| `app/tools/pdf-to-word/page.tsx` | Modify | Client-side `pdfToWord()` |
| `api/pdf-to-word.py`, `requirements.txt` | Delete | Server-side conversion removed |
| `vercel.json` | Delete | Only contained the Python function entry |
| `app/privacy/page.tsx`, `app/terms/page.tsx` | Create | Legal pages |
| `app/sitemap.ts` | Modify | Add `/privacy`, `/terms` |
| `public/ICC-Elite-cBot.cs`, `public/icc-elite-visual.txt`, `public/test.pdf`, `public/test.jpg`, `public/pdfjs-script.js`, `scripts/alphax-prism*.pine` | Delete | Stray files |
| `eslint.config.mjs` | Modify | Ignore `public/**` |
| `app/blog/**/page.tsx` and others | Modify | Fix real lint errors |
| `CLAUDE.md`, `AGENTS.md`, `README.md` | Modify | Accurate docs |
| `app/pricing/page.tsx`, `app/tools/layout.tsx` | Modify | Tool count and free-tier copy |
| `app/api/cancel/route.ts` | Modify | try/catch |
| `app/layout.tsx` | Modify | `<Analytics />` |

---

## Task 1: Test infrastructure (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `lib/__tests__/smoke.test.ts` (temporary, deleted in Task 3)

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/dom@^10
```
Expected: package.json devDependencies gains the four packages, no peer errors that mention react.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "public"],
  },
});
```

- [ ] **Step 3: Add the `test` script**

In `package.json` `"scripts"`, add after `"lint": "eslint"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Write a smoke test**

`lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("has a DOM", () => {
    expect(typeof window).toBe("object");
    expect(typeof localStorage.setItem).toBe("function");
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 6: Confirm tsc still passes with the new config file**

Run: `npx tsc --noEmit`
Expected: no output (exit 0). If it complains about `import.meta` in `vitest.config.ts`, add `"types": ["vitest/globals"]` is NOT the fix; instead exclude the file: add `"vitest.config.ts"` to `"exclude"` in `tsconfig.json`.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json package-lock.json lib/__tests__/smoke.test.ts tsconfig.json
git commit -m "test: add Vitest with jsdom and @/ alias

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 2: Stripe webhook row mapper (period end on items, onConflict)

Background: Stripe API versions from 2025-03 onward removed `current_period_end` from the Subscription object; it now lives on each subscription item (`sub.items.data[0].current_period_end`). The installed SDK (stripe 20) types confirm this. The current `subToRow` reads the old top-level field and writes `1970-01-01` when it is missing, which `getUserTier` then treats as expired. Also `upsert` has no conflict target.

**Files:**
- Create: `lib/stripe-rows.ts`
- Create: `lib/__tests__/stripe-rows.test.ts`
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/stripe-rows.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { subToRow, periodEndFromSubscription } from "@/lib/stripe-rows";

const BASE = {
  id: "sub_123",
  customer: "cus_456",
  status: "active",
  metadata: { userId: "user_abc" },
};

describe("periodEndFromSubscription", () => {
  it("reads current_period_end from the first subscription item (new API)", () => {
    const sub = { ...BASE, items: { data: [{ current_period_end: 1_800_000_000 }] } };
    expect(periodEndFromSubscription(sub)).toBe(1_800_000_000);
  });

  it("falls back to the legacy top-level field (old webhook API versions)", () => {
    const sub = { ...BASE, current_period_end: 1_700_000_000 };
    expect(periodEndFromSubscription(sub)).toBe(1_700_000_000);
  });

  it("prefers the item value when both exist", () => {
    const sub = {
      ...BASE,
      current_period_end: 1_700_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    };
    expect(periodEndFromSubscription(sub)).toBe(1_800_000_000);
  });

  it("returns null when neither exists", () => {
    expect(periodEndFromSubscription(BASE)).toBeNull();
  });
});

describe("subToRow", () => {
  it("maps a subscription to a subscriptions row", () => {
    const row = subToRow({ ...BASE, items: { data: [{ current_period_end: 1_800_000_000 }] } });
    expect(row.user_id).toBe("user_abc");
    expect(row.stripe_subscription_id).toBe("sub_123");
    expect(row.stripe_customer_id).toBe("cus_456");
    expect(row.status).toBe("active");
    expect(row.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString());
    expect(typeof row.updated_at).toBe("string");
  });

  it("never writes a 1970 period end when the field is missing", () => {
    const row = subToRow(BASE);
    expect(row.current_period_end).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- stripe-rows`
Expected: FAIL, "Failed to resolve import "@/lib/stripe-rows"".

- [ ] **Step 3: Create `lib/stripe-rows.ts`**

```ts
// Pure helpers for turning Stripe subscription objects into `subscriptions` rows.
// Kept free of Stripe/Supabase imports so they can be unit tested.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySub = any;

/**
 * Stripe API versions from 2025-03 onward moved `current_period_end` from the
 * Subscription onto each SubscriptionItem. Webhook payloads use the endpoint's
 * configured API version, while `stripe.subscriptions.retrieve()` uses the SDK's,
 * so both shapes can arrive. Returns unix seconds or null.
 */
export function periodEndFromSubscription(sub: AnySub): number | null {
  const fromItem = sub?.items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") return fromItem;
  const legacy = sub?.current_period_end;
  if (typeof legacy === "number") return legacy;
  return null;
}

export function subToRow(sub: AnySub) {
  const end = periodEndFromSubscription(sub);
  return {
    user_id: sub.metadata?.userId as string,
    stripe_subscription_id: sub.id as string,
    stripe_customer_id: sub.customer as string,
    status: sub.status as string,
    current_period_end: end === null ? null : new Date(end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- stripe-rows`
Expected: 6 passed.

- [ ] **Step 5: Use it in the webhook and add the conflict target**

In `app/api/webhooks/stripe/route.ts`:
- Delete the local `subToRow` function (lines 13-23) and add `import { subToRow } from "@/lib/stripe-rows";` after the supabase import.
- Replace line 51 `await supabase.from("subscriptions").upsert(subToRow(obj));` with:
```ts
    const { error } = await supabase
      .from("subscriptions")
      .upsert(subToRow(obj), { onConflict: "user_id" });
    if (error) console.error("[stripe-webhook] upsert failed:", error);
```
- Replace line 71 `await supabase.from("subscriptions").upsert(subToRow(sub));` with:
```ts
    const { error } = await supabase
      .from("subscriptions")
      .upsert(subToRow(sub), { onConflict: "user_id" });
    if (error) console.error("[stripe-webhook] upsert failed:", error);
```
- In the `invoice.payment_succeeded` branch, change the retrieve call so the item period end is present:
```ts
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] });
```
(`items.data` is included by default; the expand is harmless and documents the dependency.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. If `current_period_end: null` conflicts with a Supabase type, there is none (the client is untyped), so no change needed.

- [ ] **Step 7: Commit**

```bash
git add lib/stripe-rows.ts lib/__tests__/stripe-rows.test.ts app/api/webhooks/stripe/route.ts
git commit -m "fix(stripe): read period end from subscription items and upsert on user_id

Stripe moved current_period_end onto subscription items; the old read wrote
1970 and demoted paying users. Upsert now targets user_id so renewals update
the existing row instead of inserting duplicates.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 3: `lib/tier.ts` resilience and the UNIQUE(user_id) probe

**Files:**
- Modify: `lib/tier.ts`
- Create: `scripts/check-subscriptions-constraint.mjs`
- Create (only if probe fails): `supabase/migrations/20260916_subscriptions_user_id_unique.sql`
- Delete: `lib/__tests__/smoke.test.ts`

- [ ] **Step 1: Rewrite `lib/tier.ts`**

```ts
import { createAdminClient } from "./supabase";

export type Tier = "free" | "drop" | "pro";

type SubscriptionRow = {
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string | null;
  current_period_end: string | null;
  updated_at: string | null;
};

/**
 * Returns the single most relevant row for a user. If duplicates ever exist
 * (pre-fix webhook behaviour), the one with the latest period end wins instead
 * of `.single()` throwing and silently demoting the user to free.
 */
export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[tier] getSubscription failed:", error);
    return null;
  }
  return (data as SubscriptionRow | null) ?? null;
}

export async function getUserTier(userId: string): Promise<Tier> {
  const sub = await getSubscription(userId);
  if (
    sub &&
    sub.status === "active" &&
    sub.current_period_end &&
    new Date(sub.current_period_end) > new Date()
  ) {
    return "pro";
  }
  return "free";
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. `app/api/cancel/route.ts` uses `sub?.stripe_subscription_id` and `app/api/user/subscription/route.ts` returns the row; both compile against the new type.

- [ ] **Step 3: Write the constraint probe script**

`scripts/check-subscriptions-constraint.mjs`:
```js
// Probes whether `subscriptions.user_id` has a UNIQUE constraint by upserting a
// sentinel row with onConflict: "user_id" and then deleting it. PostgREST returns
// error 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
// specification") when the constraint is missing.
// Usage: node --env-file=.env.local scripts/check-subscriptions-constraint.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase env vars"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const SENTINEL = "user_constraintprobe000000000000";

const { error } = await supabase.from("subscriptions").upsert(
  {
    user_id: SENTINEL,
    stripe_subscription_id: "probe",
    stripe_customer_id: "probe",
    status: "canceled",
    current_period_end: new Date(0).toISOString(),
    updated_at: new Date().toISOString(),
  },
  { onConflict: "user_id" }
);

await supabase.from("subscriptions").delete().eq("user_id", SENTINEL);

if (error) {
  console.error("UNIQUE(user_id) is MISSING or upsert failed:", error.code, error.message);
  process.exit(2);
}
console.log("OK: subscriptions.user_id has a UNIQUE constraint (upsert with onConflict succeeded).");
```

- [ ] **Step 4: Run the probe**

Run: `node --env-file=.env.local scripts/check-subscriptions-constraint.mjs`
Expected: `OK: subscriptions.user_id has a UNIQUE constraint ...` and exit 0.

If it exits 2 with code `42P10`, create `supabase/migrations/20260916_subscriptions_user_id_unique.sql`:
```sql
-- Deduplicate first (keep the newest period end per user), then enforce uniqueness.
delete from public.subscriptions s
using public.subscriptions t
where s.user_id = t.user_id
  and s.ctid <> t.ctid
  and (s.current_period_end < t.current_period_end
       or (s.current_period_end = t.current_period_end and s.ctid < t.ctid));

alter table public.subscriptions
  add constraint subscriptions_user_id_key unique (user_id);
```
and STOP: tell the owner to run it in the Supabase SQL editor, then re-run the probe before continuing.

- [ ] **Step 5: Remove the smoke test**

```bash
git rm -q lib/__tests__/smoke.test.ts
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: 6 passed (stripe-rows only).

- [ ] **Step 7: Commit**

```bash
git add lib/tier.ts scripts/check-subscriptions-constraint.mjs
git add supabase 2>/dev/null || true
git commit -m "fix(tier): tolerate duplicate subscription rows; add UNIQUE(user_id) probe script

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 4: `useFreeGate` hook

**Files:**
- Create: `lib/useFreeGate.ts`
- Create: `lib/__tests__/useFreeGate.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/useFreeGate.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const proState = { isPro: false, loading: false };
vi.mock("@/lib/useProStatus", () => ({
  useProStatus: () => proState,
}));
const logTool = vi.fn();
vi.mock("@/lib/logTool", () => ({ logTool: (t: string) => logTool(t) }));

import { useFreeGate, FREE_LIMIT, FREE_COUNT_KEY } from "@/lib/useFreeGate";

beforeEach(() => {
  localStorage.clear();
  logTool.mockClear();
  proState.isPro = false;
  proState.loading = false;
});

describe("useFreeGate", () => {
  it("allows 3 operations then blocks and opens the paywall", () => {
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(FREE_LIMIT);

    for (let i = 1; i <= FREE_LIMIT; i++) {
      let ok = false;
      act(() => { ok = result.current.consume(); });
      expect(ok).toBe(true);
      expect(result.current.remaining).toBe(FREE_LIMIT - i);
    }
    expect(result.current.canRun).toBe(false);

    let ok = true;
    act(() => { ok = result.current.consume(); });
    expect(ok).toBe(false);
    expect(result.current.showPaywall).toBe(true);
    expect(logTool).toHaveBeenCalledWith("event:paywall_shown");
    expect(localStorage.getItem(FREE_COUNT_KEY)).toBe(String(FREE_LIMIT));
  });

  it("persists the count in localStorage under rizzpdf_free_count", () => {
    localStorage.setItem(FREE_COUNT_KEY, "2");
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(1);
  });

  it("treats garbage localStorage values as 0", () => {
    localStorage.setItem(FREE_COUNT_KEY, "banana");
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(FREE_LIMIT);
    localStorage.setItem(FREE_COUNT_KEY, "-4");
    const { result: r2 } = renderHook(() => useFreeGate());
    expect(r2.current.remaining).toBe(FREE_LIMIT);
  });

  it("never counts or blocks Pro / day-pass users", () => {
    proState.isPro = true;
    localStorage.setItem(FREE_COUNT_KEY, "99");
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(Infinity);
    let ok = false;
    act(() => { ok = result.current.consume(); });
    expect(ok).toBe(true);
    expect(result.current.showPaywall).toBe(false);
    expect(localStorage.getItem(FREE_COUNT_KEY)).toBe("99");
  });

  it("allows without counting while pro status is still loading", () => {
    proState.loading = true;
    localStorage.setItem(FREE_COUNT_KEY, "3");
    const { result } = renderHook(() => useFreeGate());
    let ok = false;
    act(() => { ok = result.current.consume(); });
    expect(ok).toBe(true);
    expect(localStorage.getItem(FREE_COUNT_KEY)).toBe("3");
  });

  it("openPaywall / closePaywall toggle state", () => {
    const { result } = renderHook(() => useFreeGate());
    act(() => result.current.openPaywall());
    expect(result.current.showPaywall).toBe(true);
    act(() => result.current.closePaywall());
    expect(result.current.showPaywall).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useFreeGate`
Expected: FAIL, cannot resolve `@/lib/useFreeGate`.

- [ ] **Step 3: Create `lib/useFreeGate.ts`**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useProStatus } from "@/lib/useProStatus";
import { logTool } from "@/lib/logTool";

/** Free tier: this many operations across ALL tools, then the paywall. */
export const FREE_LIMIT = 3;
export const FREE_COUNT_KEY = "rizzpdf_free_count";

export function readFreeCount(): number {
  try {
    const n = parseInt(localStorage.getItem(FREE_COUNT_KEY) ?? "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeFreeCount(n: number) {
  try {
    localStorage.setItem(FREE_COUNT_KEY, String(n));
  } catch {
    // Private mode / blocked storage: the count just doesn't persist.
  }
}

/**
 * Single source of truth for the free-tier gate. Call `consume()` in the tool's
 * primary handler; if it returns false, stop (the hook has already opened the
 * paywall). Pro and day-pass users always pass and are never counted. While pro
 * status is still loading, the run is allowed and not counted (never punish a
 * paying user for a slow network).
 */
export function useFreeGate() {
  const { isPro, loading } = useProStatus();
  const [count, setCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    setCount(readFreeCount());
  }, []);

  const remaining = isPro ? Infinity : Math.max(0, FREE_LIMIT - count);
  const canRun = loading || isPro || count < FREE_LIMIT;

  const consume = useCallback((): boolean => {
    if (loading || isPro) return true;
    // Re-read so a second tab's usage is respected.
    const current = readFreeCount();
    if (current >= FREE_LIMIT) {
      setCount(current);
      setShowPaywall(true);
      logTool("event:paywall_shown");
      return false;
    }
    const next = current + 1;
    writeFreeCount(next);
    setCount(next);
    return true;
  }, [loading, isPro]);

  const openPaywall = useCallback(() => setShowPaywall(true), []);
  const closePaywall = useCallback(() => setShowPaywall(false), []);

  return { canRun, remaining, consume, showPaywall, openPaywall, closePaywall, isPro, loading };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- useFreeGate`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/useFreeGate.ts lib/__tests__/useFreeGate.test.ts
git commit -m "feat: useFreeGate hook — shared 3-free-operations counter with paywall state

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 5: Gate the 12 single-action tool pages

These pages share one shape: a `handleX` async function that calls `logTool("x"); setStatus("processing");` and a `WorkspaceBar` with `onPrimary={status === "done" ? reset : handleX}` (sign uses its own button). None of them import `PaywallModal` or `useProStatus` today.

| Page | Handler |
|------|---------|
| `app/tools/merge/page.tsx` | `handleMerge` |
| `app/tools/split/page.tsx` | `handleSplit` |
| `app/tools/rotate/page.tsx` | `handleApply` |
| `app/tools/delete-pages/page.tsx` | `handleDelete` |
| `app/tools/jpg-to-pdf/page.tsx` | `handleConvert` |
| `app/tools/page-numbers/page.tsx` | `handleApply` |
| `app/tools/pdf-to-jpg/page.tsx` | `handleConvert` |
| `app/tools/pdf-to-png/page.tsx` | `handleConvert` |
| `app/tools/protect/page.tsx` | `handleProtect` |
| `app/tools/repair/page.tsx` | `handleRepair` |
| `app/tools/sign/page.tsx` | `handleSign` |
| `app/tools/organize/page.tsx` | `handleSave` (declared as `async function handleSave()`) |

**Files:** Modify each of the 12 pages above.

- [ ] **Step 1: Apply the same three edits to each page**

(a) Imports, after the existing `@/lib/...` imports:
```ts
import PaywallModal from "@/components/PaywallModal";
import { useFreeGate } from "@/lib/useFreeGate";
```

(b) Inside the component, next to the other `useState` calls:
```ts
  const gate = useFreeGate();
```

(c) In the handler, immediately after its early-return guard(s) and BEFORE the `logTool(...)` line, add:
```ts
    if (!gate.consume()) return;
```
Example for merge:
```ts
  const handleMerge = async () => {
    if (files.length < 2) return;
    if (!gate.consume()) return;
    logTool("merge"); setStatus("processing");
```

(d) In the JSX, just before the SEO copy block (or before the closing `</ToolShell>` if there is none), add:
```tsx
      {gate.showPaywall && (
        <PaywallModal onClose={gate.closePaywall} onPay={gate.closePaywall} />
      )}
```

- [ ] **Step 2: Typecheck and lint the touched files**

Run: `npx tsc --noEmit && npx eslint app/tools`
Expected: tsc exit 0; eslint reports no NEW errors in these 12 files (pre-existing warnings are handled in Task 10).

- [ ] **Step 3: Browser check on one page**

Start the `rizzpdf-dev` preview. Open `/tools/merge`. In the browser console run `localStorage.setItem("rizzpdf_free_count","3")`, reload, upload two PDFs from `test-fixtures/smoke/`, click Merge.
Expected: the paywall modal appears and no download starts. Then run `localStorage.removeItem("rizzpdf_free_count")`, reload, repeat: the merge downloads and `localStorage.getItem("rizzpdf_free_count")` is `"1"`.

- [ ] **Step 4: Commit**

```bash
git add app/tools
git commit -m "feat: gate merge, split, rotate, delete-pages, jpg-to-pdf, page-numbers, pdf-to-jpg, pdf-to-png, protect, repair, sign, organize with useFreeGate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 6: Migrate the 4 already-gated pages (compress, watermark, unlock, batch)

**Files:**
- Modify: `app/tools/compress/page.tsx`
- Modify: `app/tools/watermark/page.tsx`
- Modify: `app/tools/unlock/page.tsx`
- Modify: `app/tools/batch/page.tsx`

- [ ] **Step 1: compress** (`app/tools/compress/page.tsx`)

- Remove `import { useProStatus } from "@/lib/useProStatus";` and add `import { useFreeGate } from "@/lib/useFreeGate";`.
- Replace lines 29-30 (`const { isPro, loading: proLoading } = useProStatus();` and `const [showPaywall, setShowPaywall] = useState(false);`) with `const gate = useFreeGate();`.
- Replace line 38 `if (!proLoading && !isPro) { setShowPaywall(true); return; }` with `if (!gate.consume()) return;`. (Today compress is entirely Pro-only; after this it gets the same 3 free operations as every tool.)
- Replace the `{showPaywall && (<PaywallModal onClose={() => setShowPaywall(false)} onPay={() => setShowPaywall(false)} />)}` block with `{gate.showPaywall && <PaywallModal onClose={gate.closePaywall} onPay={gate.closePaywall} />}`.

- [ ] **Step 2: watermark** (`app/tools/watermark/page.tsx`)

- Swap the `useProStatus` import for `useFreeGate` as above.
- Replace lines 27-30 (`useProStatus()`, `showPaywall` state, `freeCount` state, `const FREE_LIMIT = 3;`) with `const gate = useFreeGate();`.
- Delete the `useEffect` that reads `rizzpdf_watermark_count` (lines 32-35).
- In `handleApply`: replace `if (!proLoading && !isPro && freeCount >= FREE_LIMIT) { setShowPaywall(true); return; }` with `if (!gate.consume()) return;` and delete the `if (!isPro) { ... localStorage.setItem("rizzpdf_watermark_count", ...) }` block inside the success branch.
- Line 132 subtitle: replace `${!isPro ? ` · ${FREE_LIMIT - freeCount} free use${...} remaining` : ""}` with `${gate.isPro ? "" : ` · ${gate.remaining} free use${gate.remaining !== 1 ? "s" : ""} remaining`}`.
- Replace the paywall block as in Step 1.
- If `useEffect` is now unused in the import list, remove it.

- [ ] **Step 3: unlock** (`app/tools/unlock/page.tsx`)

Unlock currently caps free users at 3 files added; it moves to the operation rule. Unlocking happens per file inside `FileCard` (each card has its own Unlock button) and via "Unlock All", so the operation is "one Unlock click" and the gate must be checked in both paths.

- Swap the `useProStatus` import for `useFreeGate`; delete `const FREE_LIMIT = 3;`; replace `const [showPaywall, setShowPaywall] = useState(false);` and `const { isPro, loading: proLoading } = useProStatus();` with `const gate = useFreeGate();`.
- Replace `handleFilesAdded` entirely with:
```ts
  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map((f) => ({ id: crypto.randomUUID(), file: f, status: "idle" }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);
```
- In `handleUnlockAll`, after `if (pending.length === 0 || unlockingAll) return;` add `if (!gate.consume()) return;`.
- Open `components/FileCard.tsx` and find where the per-card unlock is triggered (the function that calls `unlockPDF`). Add an optional prop `onBeforeUnlock?: () => boolean` to `FileCardProps`; at the top of that function add `if (onBeforeUnlock && !onBeforeUnlock()) return;`. In unlock's JSX pass `onBeforeUnlock={gate.consume}` to each `<FileCard>`.
- Replace the "free files used" banner (the `{!proLoading && !isPro && files.length > 0 && (...)}` block) with:
```tsx
      {!gate.loading && !gate.isPro && files.length > 0 && (
        <p className="mt-4 text-center text-xs text-gray-400">
          {gate.remaining} of 3 free operations left
          {gate.remaining === 0 && (
            <button onClick={gate.openPaywall} className="ml-2 text-red-600 font-semibold hover:underline">
              Go unlimited for $1 →
            </button>
          )}
        </p>
      )}
```
- Change the ToolShell description from "Free for up to 3 files." to "Free for your first 3 operations."
- Replace the paywall block as in Step 1.

- [ ] **Step 4: batch** (`app/tools/batch/page.tsx`)

- Same import swap; delete `const FREE_LIMIT = 3;` (line 9); replace the `showPaywall` state and `useProStatus()` lines with `const gate = useFreeGate();`.
- Replace `handleFilesAdded` with the ungated version (same shape as unlock's above but building `BatchFile` entries: `{ id: crypto.randomUUID(), file: f, status: "idle" }`).
- In `handleRun`, after `if (files.length === 0 || running) return;` add `if (!gate.consume()) return;` (one batch run = one operation).
- Replace the "free files used" banner block (lines 120-134) with the same `remaining` paragraph used for unlock.
- Replace the paywall block as in Step 1.

- [ ] **Step 5: Confirm nothing else references the old pieces**

Run: `grep -rn "rizzpdf_watermark_count\|FREE_LIMIT\|useProStatus" app/tools components | grep -v useFreeGate`
Expected: no output. (`useProStatus` is still used by `lib/useFreeGate.ts` and `app/dashboard/*`, which is fine and is not in the grep path.)

- [ ] **Step 6: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npx eslint app/tools components && npm test`
Expected: all pass; 12 tests.

- [ ] **Step 7: Browser check**

With the preview running and `rizzpdf_free_count` cleared: on `/tools/unlock` upload 4 files from `test-fixtures/smoke/` (adding 4 must now succeed), click Unlock on three cards (each downloads), click the fourth: paywall appears. On `/tools/compress` with the count at 3: paywall appears on Compress.

- [ ] **Step 8: Commit**

```bash
git add app/tools components/FileCard.tsx
git commit -m "refactor: compress, watermark, unlock, batch use the shared useFreeGate rule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 7: PDF-to-Word client-side (delete the Python function)

**Files:**
- Modify: `app/tools/pdf-to-word/page.tsx`
- Delete: `api/pdf-to-word.py`, `requirements.txt`, `vercel.json`

- [ ] **Step 1: Rewrite `handleConvert` in `app/tools/pdf-to-word/page.tsx`**

- Change the import on line 8 to `import { pdfToWord, downloadBlob } from "@/lib/pdf-tools";`.
- Add the `PaywallModal`/`useFreeGate` imports and `const gate = useFreeGate();` exactly as in Task 5.
- Replace the body of `handleConvert` with:
```ts
  const handleConvert = async () => {
    if (!file) return;
    if (!gate.consume()) return;
    logTool("pdf-to-word"); setStatus("processing"); setError("");
    const result = await pdfToWord(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, ".docx"));
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed.");
      setStatus("error");
    }
  };
```
- Change the ToolShell `description` to: `"Convert your PDF to an editable Word document. Runs entirely in your browser — the file never leaves your device."`
- Replace the paragraph on line 79 (`Your file is sent to our secure server...`) with: `Conversion happens in your browser. Text, headings and paragraphs are preserved; complex layouts, tables and images may need tidying in Word.`
- Add the paywall JSX block before `</ToolShell>`.

- [ ] **Step 2: Delete the server function**

```bash
git rm -q api/pdf-to-word.py requirements.txt vercel.json
```
(`vercel.json` contained only the `functions` entry for the Python file; with no `vercel.json` Vercel uses its Next.js defaults.)

- [ ] **Step 3: Verify nothing else references it**

Run: `grep -rn "pdf-to-word.py\|/api/pdf-to-word\|pdf2docx" --include=*.ts --include=*.tsx --include=*.json --include=*.md . | grep -v node_modules | grep -v docs/superpowers`
Expected: no output.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Browser check with fixtures**

Preview `/tools/pdf-to-word`. Upload `test-fixtures/smoke/plain-text.pdf`, click Convert. Expected: a `.docx` downloads; open it (or unzip and inspect `word/document.xml`) and confirm the fixture's text is present. Repeat with `multi-page.pdf`. Check the browser console shows no errors and the Network tab shows no POST to `/api/pdf-to-word`.

- [ ] **Step 6: Commit**

```bash
git add app/tools/pdf-to-word/page.tsx
git commit -m "fix(pdf-to-word): convert in the browser; remove the Python server function

Restores the files-never-leave-the-browser guarantee and gates the tool like
every other.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 8: Legal pages (`/privacy`, `/terms`) and sitemap

**Files:**
- Create: `app/privacy/page.tsx`
- Create: `app/terms/page.tsx`
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Create `app/privacy/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How RizzPDF handles your files and data. Files are processed in your browser and never uploaded.",
  alternates: { canonical: "https://www.rizzpdf.com/privacy" },
  robots: { index: true, follow: true },
};

const UPDATED = "September 16, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-3xl mx-auto px-5 py-14 space-y-8 text-[15px] leading-relaxed text-gray-700">
        <header>
          <h1 className="text-3xl font-black text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated {UPDATED}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Your files never leave your device</h2>
          <p>
            Every PDF tool on RizzPDF runs inside your web browser using JavaScript. When you merge,
            split, compress, convert, sign, unlock or otherwise edit a PDF, the file is read and
            written on your own computer or phone. We do not upload your files to our servers, we
            cannot see them, and we do not store them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">What we do collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Tool usage counts.</strong> When you run a tool we record the tool name (for example &quot;merge&quot;) and, if you are signed in, your account ID. No file names, contents or sizes are sent.</li>
            <li><strong>Account data.</strong> If you create an account, our sign-in provider Clerk stores your email address and login details.</li>
            <li><strong>Payment data.</strong> Payments are handled by Stripe. We never see or store your card number. We store your Stripe customer and subscription IDs and your subscription status so we can tell whether you are a Pro member.</li>
            <li><strong>Day pass.</strong> If you buy a $1 day pass, your browser stores the Stripe checkout session ID so the pass can be verified for 24 hours. Clearing browser storage removes it.</li>
            <li><strong>Free-tier counter.</strong> Your browser stores how many free operations you have used. This value stays on your device.</li>
            <li><strong>Email signups.</strong> If you enter your email to be notified about new features, we store that email address.</li>
            <li><strong>Analytics.</strong> We use Vercel Web Analytics, which records page views without cookies and without identifying you personally.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Where data is stored</h2>
          <p>
            Account and subscription records live in Supabase (hosted database), authentication in
            Clerk, and payments in Stripe. Each of these providers publishes its own privacy policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Cookies</h2>
          <p>
            We only set cookies needed for sign-in (Clerk). We do not use advertising cookies or
            cross-site tracking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Deleting your data</h2>
          <p>
            Email <a href="mailto:support@rizzpdf.com" className="text-red-600 hover:underline">support@rizzpdf.com</a> from
            your account email and we will delete your account, subscription record and any stored
            email address within 30 days. Because your files are never uploaded, there are no files
            to delete on our side.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Changes</h2>
          <p>We will update the date at the top of this page whenever this policy changes.</p>
        </section>

        <p className="text-sm text-gray-400 pt-6 border-t border-gray-100">
          See also our <Link href="/terms" className="text-red-600 hover:underline">Terms of Service</Link>.
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/terms/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using RizzPDF's free and paid PDF tools.",
  alternates: { canonical: "https://www.rizzpdf.com/terms" },
  robots: { index: true, follow: true },
};

const UPDATED = "September 16, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-3xl mx-auto px-5 py-14 space-y-8 text-[15px] leading-relaxed text-gray-700">
        <header>
          <h1 className="text-3xl font-black text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated {UPDATED}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">The service</h2>
          <p>
            RizzPDF provides browser-based PDF tools. By using the site you agree to these terms. If
            you do not agree, please do not use the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Plans and payment</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Free.</strong> Three operations at no cost, tracked in your browser.</li>
            <li><strong>Day pass.</strong> A one-time $1 payment unlocks unlimited operations for 24 hours in the browser where you paid. It is not tied to an account and cannot be transferred.</li>
            <li><strong>Pro.</strong> A monthly or annual subscription billed through Stripe. You can cancel at any time from your dashboard; access continues until the end of the paid period.</li>
          </ul>
          <p>
            Refunds: if a tool fails to work for you, email{" "}
            <a href="mailto:support@rizzpdf.com" className="text-red-600 hover:underline">support@rizzpdf.com</a>{" "}
            within 7 days of payment and we will refund the day pass or the most recent subscription
            charge.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Acceptable use</h2>
          <p>
            You may only process files you have the right to use. Do not use RizzPDF to remove
            protection from documents you are not authorised to access, or to break the law. Do not
            attempt to disrupt the service or circumvent payment.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">No warranty</h2>
          <p>
            The service is provided &quot;as is&quot;. PDF processing runs on your device and results
            depend on the input file. Keep a copy of your original files. To the fullest extent
            permitted by law, RizzPDF is not liable for any loss arising from use of the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Changes</h2>
          <p>We may update these terms; the date above will change when we do. Continued use means you accept the updated terms.</p>
        </section>

        <p className="text-sm text-gray-400 pt-6 border-t border-gray-100">
          See also our <Link href="/privacy" className="text-red-600 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add to the sitemap**

In `app/sitemap.ts`, after the `/pricing` entry add:
```ts
    { url: `${base}/privacy`,                 lastModified: today, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/terms`,                   lastModified: today, changeFrequency: "yearly",  priority: 0.3 },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Preview `/privacy` and `/terms`: both render, footer links no longer 404, `/sitemap.xml` lists both.

- [ ] **Step 5: Commit**

```bash
git add app/privacy app/terms app/sitemap.ts
git commit -m "feat: add privacy policy and terms of service pages

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 9: Remove stray files

**Files:**
- Delete: `public/ICC-Elite-cBot.cs`, `public/icc-elite-visual.txt`, `public/test.pdf`, `public/test.jpg`, `public/pdfjs-script.js`, `scripts/alphax-prism.pine`, `scripts/alphax-prism-premium.pine`, `scripts/alphax-prism-strategy.pine`

- [ ] **Step 1: Preserve the owner's trading files outside the repo**

```bash
mkdir -p /c/Users/kael_/trading-scripts
cp public/ICC-Elite-cBot.cs public/icc-elite-visual.txt scripts/alphax-prism.pine scripts/alphax-prism-premium.pine scripts/alphax-prism-strategy.pine /c/Users/kael_/trading-scripts/
ls /c/Users/kael_/trading-scripts
```
Expected: 5 files listed.

- [ ] **Step 2: Confirm the public files are unreferenced**

Run: `grep -rn "pdfjs-script\|test\.pdf\|test\.jpg\|ICC-Elite\|icc-elite" app components lib --include=*.ts --include=*.tsx`
Expected: no output.

- [ ] **Step 3: Remove from git**

```bash
git rm -q public/ICC-Elite-cBot.cs public/icc-elite-visual.txt public/test.pdf public/test.jpg public/pdfjs-script.js scripts/alphax-prism.pine scripts/alphax-prism-premium.pine scripts/alphax-prism-strategy.pine
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unrelated trading-bot files and unreferenced test assets from the repo

Copies preserved at C:/Users/kael_/trading-scripts/.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 10: ESLint config and real lint errors

**Files:**
- Modify: `eslint.config.mjs`
- Modify: whichever files `eslint` reports (mostly `app/blog/**/page.tsx`)

- [ ] **Step 1: Ignore vendor and generated files**

Replace the `globalIgnores([...])` call in `eslint.config.mjs` with:
```js
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    "test-fixtures/**",
  ]),
```

- [ ] **Step 2: See the real errors**

Run: `npx eslint . 2>&1 | tail -5`
Expected: roughly 79 errors, ~17 warnings, all in app code.

- [ ] **Step 3: Auto-fix what can be fixed**

Run: `npx eslint . --fix`
Then re-run `npx eslint .` and fix the remainder by hand:
- `react/no-unescaped-entities`: replace `'` with `&apos;` and `"` with `&quot;` inside JSX text.
- `@typescript-eslint/no-unused-vars`: delete the unused import or variable.
- `@typescript-eslint/no-unused-expressions`: turn the expression into a statement or delete it.
Do not disable rules to make errors go away.

- [ ] **Step 4: Verify clean**

Run: `npx eslint .`
Expected: no errors (warnings allowed but list them in the commit body if any remain).

Run: `npx tsc --noEmit && npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(lint): ignore public/ in eslint and fix remaining lint errors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 11: Copy and docs (pricing, tool count, CLAUDE.md, AGENTS.md, README)

**Files:**
- Modify: `components/PaywallModal.tsx`, `app/pricing/page.tsx`, `app/tools/layout.tsx`, `CLAUDE.md`, `AGENTS.md`, `README.md`

- [ ] **Step 1: PaywallModal copy** (`components/PaywallModal.tsx`)

- Line 40-43 paragraph: change `The free tier allows 3 files per tool. Get a` to `You have used your 3 free operations. Get a` and `unlimited files for 24 hours — no account needed.` to `unlimited operations for 24 hours — no account needed.`
- Line 48: `"Unlimited files for 24 hours"` → `"Unlimited operations for 24 hours"`.
- Line 49: `"All 16 PDF tools included"` → `"All 17 PDF tools included"`.
- Line 80: `No thanks, I&apos;ll stick to 3 files` → `No thanks`.

- [ ] **Step 2: Pricing page copy** (`app/pricing/page.tsx`)

- Every `All 16 PDF tools` / `all 16 PDF tools` → `17` (lines 123, 194, 243, 292, 355, 482).
- Line 343-344: label `"Files per session"` → `"Free operations"`, `free: "3 per tool"` → `free: "3 total"`.
- Line 448-449 FAQ: question → `"What counts as an operation on the free tier?"`, answer → `"Each time you click a tool's main action (merge, compress, convert, and so on) is one operation. You get 3 free across all tools per browser; after that a $1 day pass gives you unlimited operations for 24 hours."`

- [ ] **Step 3: Tools layout count** (`app/tools/layout.tsx`)

Replace each `14 free online PDF tools` / `14 free browser-based PDF tools` with `17 free online PDF tools` / `17 free browser-based PDF tools`.

- [ ] **Step 4: CLAUDE.md and AGENTS.md** (identical content; edit both)

Replace the `**Monetization tiers:**` block with:
```markdown
**Monetization tiers:**
- Free: 3 operations total across all tools. Enforced only by `lib/useFreeGate.ts` (localStorage `rizzpdf_free_count`); every `app/tools/*/page.tsx` calls `gate.consume()` in its primary handler. Never add per-tool counters.
- Day pass $1/24hr: localStorage `rizzpdf_bulk_session` (paid Stripe session id) — no account needed. `useProStatus` re-validates it against `/api/verify-session` server-side every load (checks payment_status/mode + derives the 24h window from Stripe's `created` timestamp), so a tampered localStorage value can't grant access. Legacy `rizzpdf_bulk_until` timestamp is no longer trusted.
- Pro $5/mo or $48/yr: Clerk user + Supabase `subscriptions` table (UNIQUE on `user_id`; webhook upserts with `onConflict: "user_id"`). Stripe's `current_period_end` is read from `items.data[0]` via `lib/stripe-rows.ts`.
```
Add under "Non-obvious rules":
```markdown
**Tests:** `npm test` (Vitest, jsdom). Unit tests live in `lib/__tests__/`. PDF processing is verified in the browser with `test-fixtures/smoke/`.

**Funnel events:** `logTool("event:paywall_shown")` and `logTool("event:checkout_started")` write to the `tool_usage` table alongside tool names.
```
Also change `**Paywall:** ... handles the $1 upgrade` to `**Paywall:** \`components/PaywallModal.tsx\` is the only paywall UI; open it via \`useFreeGate().openPaywall\`.`

- [ ] **Step 5: README.md**

Replace the whole file with:
```markdown
# RizzPDF

Free, browser-based PDF tools at [rizzpdf.com](https://www.rizzpdf.com). All PDF processing runs client-side with pdf-lib and PDF.js; files never leave the user's device.

## Stack
Next.js (App Router), React, Tailwind CSS, pdf-lib, pdfjs-dist, docx, Clerk (auth), Supabase (subscriptions), Stripe (payments), Vercel (hosting).

## Develop
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest unit tests
npm run lint
npx tsc --noEmit
```

## Environment
Copy the variables below into `.env.local` (values live in Vercel):
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Deploy
Push to `main`; Vercel builds and deploys automatically.

## Docs
Project rules: `CLAUDE.md`. Specs and plans: `docs/superpowers/`.
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx eslint . && grep -rn "16 PDF tools\|3 per tool\|14 free" app components; echo "grep exit $?"`
Expected: tsc/eslint clean; grep prints nothing and `grep exit 1`.

```bash
git add components/PaywallModal.tsx app/pricing/page.tsx app/tools/layout.tsx CLAUDE.md AGENTS.md README.md
git commit -m "docs: align copy and docs with 17 tools, 3 free operations, and \$5/mo Pro

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 12: Cancel route try/catch, Vercel Analytics, checkout events

**Files:**
- Modify: `app/api/cancel/route.ts`, `app/layout.tsx`, `components/PaywallModal.tsx`, `components/SubscribeButton.tsx`, `package.json`

- [ ] **Step 1: Cancel route**

Replace lines 23-28 of `app/api/cancel/route.ts` with:
```ts
  // Cancel at period end — user keeps Pro until billing cycle ends
  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    console.error("[cancel] stripe update failed:", err);
    return NextResponse.json({ error: "Could not cancel with Stripe. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
```

- [ ] **Step 2: Install and mount Vercel Analytics**

```bash
npm install @vercel/analytics
```
In `app/layout.tsx`: add `import { Analytics } from "@vercel/analytics/next";` and render `<Analytics />` directly after `{children}` inside `<body>`.

- [ ] **Step 3: checkout_started events**

- `components/PaywallModal.tsx`: add `import { logTool } from "@/lib/logTool";` and as the first line of `handlePay()` add `logTool("event:checkout_started:daypass");`.
- `components/SubscribeButton.tsx`: find the function that calls `fetch("/api/subscribe", ...)` and add `logTool("event:checkout_started:pro");` as its first line (add the import).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint . && npm test && npx next build`
Expected: all pass; build lists `/privacy` and `/terms` among the static routes and no `api/pdf-to-word` function.

- [ ] **Step 5: Commit**

```bash
git add app/api/cancel/route.ts app/layout.tsx components/PaywallModal.tsx components/SubscribeButton.tsx package.json package-lock.json
git commit -m "feat: Vercel Analytics, checkout funnel events, and safer cancel route

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 13: Full browser smoke test on the dev server

**Files:** none (verification only). Fix-forward commits allowed if a Phase 1 change broke a tool.

- [ ] **Step 1: Reset state and run every tool once**

Preview `rizzpdf-dev`. In the console: `localStorage.clear()`. Because the free limit is 3, set `localStorage.setItem("rizzpdf_bulk_session","x")` is NOT a bypass (server-validated), so instead, before each tool, run `localStorage.removeItem("rizzpdf_free_count")`. Run each of the 17 tools with a fixture from `test-fixtures/smoke/` (use `multi-page.pdf` for page tools, `image-heavy.pdf` for compress, `protected-user-password.pdf` for unlock, `test-fixtures/smoke/README.md` explains each) and confirm a download happens and the console shows no errors.

- [ ] **Step 2: Paywall path**

Set `rizzpdf_free_count` to `3`, reload `/tools/rotate`, upload, click Rotate. Expected: paywall shows; the "Get day pass — $1" button navigates to a Stripe Checkout URL (do NOT pay; close the tab).

- [ ] **Step 3: Record results**

Append a short results table (tool, pass/fail, note) to the PR description in Task 14. Any failure caused by Phase 1 changes is fixed and committed before moving on; pre-existing failures are listed as follow-ups.

---

## Task 14: PR, merge, production smoke

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin security-hardening-and-seo
gh pr create --base main --head security-hardening-and-seo --title "Phase 1: stabilize — entitlement fixes, uniform free gate, client-side PDF-to-Word, legal pages, cleanup" --body-file - <<'EOF'
## Summary
- Stripe webhook: read period end from subscription items; upsert on user_id (paying users were being demoted to free)
- PDF-to-Word now converts in the browser; Python function removed
- All 17 tools share one 3-free-operations gate (`lib/useFreeGate.ts`)
- /privacy and /terms pages (footer links were 404)
- Removed unrelated public files; eslint clean; Vitest added; Vercel Analytics + funnel events
- Docs and pricing copy aligned (17 tools, $5/mo)

Spec: docs/superpowers/specs/2026-09-16-rizzpdf-launch-roadmap-design.md
Plan: docs/superpowers/plans/2026-09-16-rizzpdf-phase1-stabilize.md

## Verification
- `npx tsc --noEmit`, `npx eslint .`, `npm test`, `npx next build` all pass
- Browser smoke: (paste table from Task 13)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 2: Wait for the Vercel preview build to go green, then merge**

Use the PR status tool to confirm checks pass, then:
```bash
gh pr merge --merge --delete-branch=false
```

- [ ] **Step 3: Production smoke (no purchases)**

```bash
for u in / /tools/pdf-to-word /privacy /terms /sitemap.xml /ICC-Elite-cBot.cs /test.pdf; do printf "%s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "https://rizzpdf.com$u"; done
```
Expected: 200 for the first five, 404 for the last two. Then open rizzpdf.com/tools/merge in the browser, merge two fixtures, and confirm the 4th operation shows the paywall.

- [ ] **Step 4: Owner actions (report these, do not do them)**

1. Enable Web Analytics on the Vercel project `rizzpdf`.
2. In the Stripe dashboard, confirm the webhook endpoint for rizzpdf.com is enabled and its API version; no change is needed thanks to the dual-shape reader, but note it.
3. Decide when a real $1 day-pass purchase test on production is acceptable.
4. If Task 3's probe required the migration, confirm it was applied.

---

## Done criteria

- `main` deploys with all Task 14 Step 3 checks passing.
- `npm test` has 12 passing tests; `tsc`, `eslint`, and `next build` are clean.
- Every tool page imports `useFreeGate` and none reference `useProStatus` directly.
- No file under `api/`, no `requirements.txt`, no `vercel.json`.

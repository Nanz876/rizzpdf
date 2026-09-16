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

import { shouldReplaceSubscriptionRow } from "@/lib/stripe-rows";

describe("shouldReplaceSubscriptionRow", () => {
  const NOW = Date.parse("2026-09-16T00:00:00Z");
  const future = "2026-10-16T00:00:00.000Z";
  const past = "2026-08-16T00:00:00.000Z";
  const row = (id: string, status: string, end: string | null) => ({
    stripe_subscription_id: id,
    status,
    current_period_end: end,
  });

  it("writes when the user has no row yet", () => {
    expect(shouldReplaceSubscriptionRow(null, row("sub_new", "incomplete", future), NOW)).toBe(true);
  });

  it("always updates the same subscription (status changes, cancellation)", () => {
    expect(shouldReplaceSubscriptionRow(row("sub_a", "active", future), row("sub_a", "canceled", future), NOW)).toBe(true);
  });

  it("lets a new active subscription replace an old lapsed one", () => {
    expect(shouldReplaceSubscriptionRow(row("sub_old", "past_due", past), row("sub_new", "active", future), NOW)).toBe(true);
  });

  it("does not let an old subscription's cancellation clobber a live one", () => {
    expect(shouldReplaceSubscriptionRow(row("sub_new", "active", future), row("sub_old", "canceled", past), NOW)).toBe(false);
    expect(shouldReplaceSubscriptionRow(row("sub_new", "active", future), row("sub_old", "unpaid", future), NOW)).toBe(false);
  });

  it("lets a different subscription replace a row that is active but already expired", () => {
    expect(shouldReplaceSubscriptionRow(row("sub_a", "active", past), row("sub_b", "incomplete", future), NOW)).toBe(true);
  });

  it("never replaces a manual lifetime grant with a Stripe subscription", () => {
    expect(shouldReplaceSubscriptionRow(row("lifetime_manual", "active", "2099-01-01T00:00:00.000Z"), row("sub_x", "active", future), NOW)).toBe(false);
  });
});

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

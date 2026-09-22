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

type StoredRow = {
  stripe_subscription_id: string | null;
  status: string | null;
  current_period_end: string | null;
};

/**
 * Pro granted by hand rather than sold through Stripe. These rows carry a
 * placeholder like `lifetime_manual` instead of a real Stripe subscription id,
 * so nothing may ever send that id to Stripe, and no Stripe event may replace
 * the row.
 */
export function isLifetimeGrant(
  row: { stripe_subscription_id?: string | null } | null | undefined
): boolean {
  return !!row?.stripe_subscription_id?.startsWith("lifetime");
}

/**
 * The table holds one row per user, but a user can have more than one Stripe
 * subscription over time (e.g. re-subscribing after a failed card). Decide
 * whether an event for `incoming` may overwrite the stored row:
 * - same subscription: always (that's a real status change)
 * - manual lifetime grants are never overwritten by Stripe events
 * - an old subscription's events must not clobber a different, still-live one
 */
export function shouldReplaceSubscriptionRow(
  existing: StoredRow | null,
  incoming: StoredRow,
  now: number = Date.now()
): boolean {
  if (!existing) return true;
  if (existing.stripe_subscription_id === incoming.stripe_subscription_id) return true;
  if (isLifetimeGrant(existing)) return false;
  if (incoming.status === "active") return true;
  const existingLive =
    existing.status === "active" &&
    !!existing.current_period_end &&
    Date.parse(existing.current_period_end) > now;
  return !existingLive;
}

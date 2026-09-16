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

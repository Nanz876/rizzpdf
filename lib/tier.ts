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
 * of `.single()` erroring and silently demoting the user to free.
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

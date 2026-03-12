import { createAdminClient } from "./supabase";

export type Tier = "free" | "drop" | "pro";

export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .single();

  if (
    data &&
    data.status === "active" &&
    new Date(data.current_period_end) > new Date()
  ) {
    return "pro";
  }
  return "free";
}

export async function getSubscription(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

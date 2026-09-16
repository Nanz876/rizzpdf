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

const { error: delError } = await supabase.from("subscriptions").delete().eq("user_id", SENTINEL);
if (delError) console.error("WARNING: failed to delete sentinel row:", delError);

if (error) {
  console.error("UNIQUE(user_id) is MISSING or upsert failed:", error.code, error.message);
  process.exit(2);
}
console.log("OK: subscriptions.user_id has a UNIQUE constraint (upsert with onConflict succeeded).");

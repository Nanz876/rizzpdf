// Verify subscription row for a given Clerk user ID or email
import { createClient } from "@supabase/supabase-js";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = process.argv[2];
if (!EMAIL) { console.error("Usage: node scripts/check-subscription.mjs <email>"); process.exit(1); }

// Look up Clerk user
const clerkRes = await fetch(
  `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`,
  { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } }
);
const clerkUsers = await clerkRes.json();
if (!Array.isArray(clerkUsers) || clerkUsers.length === 0) { console.error("User not found in Clerk"); process.exit(1); }
const userId = clerkUsers[0].id;

// Query Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", userId).single();

if (error) { console.error("Error:", error); process.exit(1); }

console.log("Subscription row:");
console.log(JSON.stringify(data, null, 2));

const isActive = data.status === "active" && new Date(data.current_period_end) > new Date();
console.log(`\nTier check: ${isActive ? "PRO ✓" : "NOT PRO ✗"}`);

// One-off script: grant lifetime pro access to a user by email
// Usage: node scripts/grant-lifetime.mjs <email>

import { createClient } from "@supabase/supabase-js";

const EMAIL = process.argv[2];
if (!EMAIL) {
  console.error("Usage: node scripts/grant-lifetime.mjs <email>");
  process.exit(1);
}

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CLERK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Run with dotenv or source .env.local first.");
  process.exit(1);
}

// 1. Look up user in Clerk by email
const clerkRes = await fetch(
  `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`,
  { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } }
);
const clerkUsers = await clerkRes.json();

if (!clerkRes.ok || !Array.isArray(clerkUsers) || clerkUsers.length === 0) {
  console.error("User not found in Clerk:", JSON.stringify(clerkUsers));
  process.exit(1);
}

const user = clerkUsers[0];
const userId = user.id;
console.log(`Found Clerk user: ${userId} (${EMAIL})`);

// 2. Upsert lifetime subscription in Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const LIFETIME_END = new Date("2099-01-01T00:00:00Z").toISOString();

const { error } = await supabase.from("subscriptions").upsert(
  {
    user_id: userId,
    stripe_subscription_id: "lifetime_manual",
    stripe_customer_id: "lifetime_manual",
    status: "active",
    current_period_end: LIFETIME_END,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "user_id" }
);

if (error) {
  console.error("Supabase upsert failed:", error);
  process.exit(1);
}

console.log(`Lifetime pro access granted to ${EMAIL} (userId: ${userId})`);
console.log(`current_period_end set to ${LIFETIME_END}`);

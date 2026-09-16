import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase";
import { subToRow, shouldReplaceSubscriptionRow } from "@/lib/stripe-rows";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Clerk user IDs always have this prefix. Validating the shape rejects forged or
// malformed metadata before it can be written against a real account row.
function isValidUserId(id: unknown): id is string {
  return typeof id === "string" && /^user_[A-Za-z0-9]+$/.test(id);
}

const ok = () => NextResponse.json({ received: true });

/**
 * Transient failures return 500 so Stripe retries. Permanent ones (Postgres
 * integrity/data errors, SQLSTATE classes 22 and 23) return 200 after logging,
 * because retrying for days can't fix them and would get the endpoint disabled.
 */
function dbFailure(context: string, error: { code?: string; message?: string }) {
  console.error(`[stripe-webhook] ${context}:`, error);
  const permanent = /^2[23]/.test(error.code ?? "");
  return permanent
    ? ok()
    : NextResponse.json({ error: "db write failed" }, { status: 500 });
}

/**
 * Re-reads the subscription from Stripe and writes its current state. Fetching
 * fresh (instead of trusting the event payload) makes event ordering irrelevant
 * and always returns the SDK's API shape.
 */
async function syncSubscription(subId: string) {
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (err) {
    if ((err as { code?: string })?.code === "resource_missing") return ok();
    console.error("[stripe-webhook] subscription retrieve failed:", err);
    return NextResponse.json({ error: "stripe retrieve failed" }, { status: 500 });
  }

  const userId = sub.metadata?.userId;
  if (!isValidUserId(userId)) return ok();

  const row = subToRow(sub);
  const supabase = createAdminClient();

  const { data: existing, error: readError } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return dbFailure("read failed", readError);

  if (!shouldReplaceSubscriptionRow(existing, row)) {
    console.warn(
      `[stripe-webhook] skipped ${sub.id} (${row.status}); user ${userId} has live row ${existing?.stripe_subscription_id}`
    );
    return ok();
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });
  if (error) return dbFailure("upsert failed", error);
  return ok();
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(obj.id);

    case "invoice.payment_succeeded": {
      // Stripe API 2025-03+ moved the subscription id under parent.subscription_details.
      const subId = obj.parent?.subscription_details?.subscription ?? obj.subscription;
      return typeof subId === "string" ? syncSubscription(subId) : ok();
    }

    default:
      return ok();
  }
}

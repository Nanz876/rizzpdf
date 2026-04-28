import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subToRow(sub: any) {
  return {
    user_id: sub.metadata?.userId as string,
    stripe_subscription_id: sub.id as string,
    stripe_customer_id: sub.customer as string,
    status: sub.status as string,
    current_period_end: new Date((sub.current_period_end ?? 0) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
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

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const userId = obj.metadata?.userId;
    if (!userId) return NextResponse.json({ received: true });
    await supabase.from("subscriptions").upsert(subToRow(obj));
  }

  if (event.type === "customer.subscription.deleted") {
    const userId = obj.metadata?.userId;
    if (!userId) return NextResponse.json({ received: true });
    await supabase
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  if (event.type === "invoice.payment_succeeded") {
    const subId = obj.subscription as string;
    if (!subId) return NextResponse.json({ received: true });
    const sub = await stripe.subscriptions.retrieve(subId);
    const userId = (sub as unknown as Record<string, unknown>).metadata
      ? (sub.metadata as Record<string, string>).userId
      : undefined;
    if (!userId) return NextResponse.json({ received: true });
    await supabase.from("subscriptions").upsert(subToRow(sub));
  }

  return NextResponse.json({ received: true });
}

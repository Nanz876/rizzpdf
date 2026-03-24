import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getSubscription } from "@/lib/tier";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscription(userId);
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  // Cancel at period end — user keeps Pro until billing cycle ends
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ ok: true });
}

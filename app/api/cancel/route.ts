import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getSubscription } from "@/lib/tier";
import { isLifetimeGrant } from "@/lib/stripe-rows";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "cancel"), 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscription(userId);
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  // Lifetime Pro has no Stripe subscription behind it, so there's nothing to
  // cancel — and its placeholder id must never reach the Stripe API.
  if (isLifetimeGrant(sub)) {
    return NextResponse.json(
      { error: "Lifetime Pro doesn't renew, so there's nothing to cancel." },
      { status: 409 }
    );
  }

  // Cancel at period end — user keeps Pro until billing cycle ends
  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    console.error("[cancel] stripe update failed:", err);
    return NextResponse.json(
      { error: "Could not cancel with Stripe. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

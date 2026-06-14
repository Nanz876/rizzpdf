import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "verify-session"), 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ valid: false });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // A day pass must be a PAID one-time payment — not a subscription checkout
    // session, so a Pro-subscription session can't be replayed as a $1 pass.
    const paid = session.payment_status === "paid" && session.mode === "payment";

    // Derive the 24h window from Stripe's own `created` timestamp. The client
    // cannot forge this, so a tampered localStorage value can never grant access —
    // the only way to be valid is to hold a genuine paid session id < 24h old.
    const expiresAt = (session.created ?? 0) * 1000 + DAY_MS;
    const valid = paid && Date.now() < expiresAt;

    return NextResponse.json({ valid, expiresAt });
  } catch {
    return NextResponse.json({ valid: false });
  }
}

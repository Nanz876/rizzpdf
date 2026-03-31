import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ valid: false });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const valid = session.payment_status === "paid";
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false });
  }
}

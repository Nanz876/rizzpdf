import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "checkout"), 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "RizzPDF Day Pass — Batch Processing",
            description: "Unlimited batch processing for 24 hours. All single-file tools are always free. Files never leave your browser. No account required.",
            images: [],
          },
          unit_amount: 100, // $1.00 in cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    allow_promotion_codes: true,
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}

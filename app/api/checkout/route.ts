import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "RizzPDF Bulk Unlock",
            description: "Unlimited PDF password removal for 24 hours. Files never leave your browser.",
            images: [],
          },
          unit_amount: 100, // $1.00 in cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}

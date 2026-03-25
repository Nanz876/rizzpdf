import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const billing = body.billing === "annual" ? "annual" : "monthly";
  const priceId =
    billing === "annual"
      ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID!
      : process.env.STRIPE_PRO_PRICE_ID!;

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: email,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}

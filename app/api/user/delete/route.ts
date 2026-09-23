import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getSubscription } from "@/lib/tier";
import { isLifetimeGrant } from "@/lib/stripe-rows";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Tables keyed by Clerk user id. `notify_signups` is keyed by email with no
// user id on it, so an account deletion can't find those rows — unsubscribing
// from the mailing list is a separate action.
const USER_TABLES = ["subscriptions", "unlocks", "tool_usage"] as const;

/**
 * Erases everything this site stores about the caller, and stops their billing.
 *
 * Deleting the Clerk account is the *client's* job (`user.delete()`), because
 * only the signed-in session may do that. This runs first: once Clerk is gone
 * the token is dead, and any rows left behind — which hold Stripe customer and
 * subscription ids — would be orphaned personal data that nothing can reach.
 *
 * Cancelling comes before deleting on purpose. If the row went first and the
 * Stripe call then failed, the subscription would keep charging a card with no
 * account behind it and no row pointing at it.
 */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "user-delete"), 5, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscription(userId);

  // Cancel immediately rather than at period end: the account is going away,
  // so there's nobody left to use the rest of the period. Lifetime grants have
  // a placeholder id that must never reach Stripe.
  if (sub?.stripe_subscription_id && !isLifetimeGrant(sub)) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      // Already cancelled or already gone is fine — the goal is "not billing".
      const code = (err as { code?: string })?.code;
      const status = (err as { statusCode?: number })?.statusCode;
      const alreadyGone = code === "resource_missing" || status === 404;
      if (!alreadyGone) {
        console.error("[user-delete] stripe cancel failed:", err);
        return NextResponse.json(
          {
            error:
              "Could not cancel your subscription with Stripe, so nothing was deleted. Please try again.",
          },
          { status: 502 }
        );
      }
    }
  }

  const supabase = createAdminClient();
  for (const table of USER_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`[user-delete] failed to clear ${table}:`, error);
      return NextResponse.json(
        { error: "Could not delete your data. Please try again." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}

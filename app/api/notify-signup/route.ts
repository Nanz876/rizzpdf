import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

// Basic, deliberately-strict email shape. Rejects "@", "user@", "@@@" etc.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "notify-signup"), 5, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const supabase = createAdminClient();
  await supabase
    .from("notify_signups")
    .upsert({ email: email.toLowerCase() }, { onConflict: "email" });
  return NextResponse.json({ ok: true });
}

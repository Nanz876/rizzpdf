import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import { getUserTier } from "@/lib/tier";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "unlocks"), 120, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // Sanitize: cap length and coerce to string so we never store junk/huge payloads.
  const filename =
    typeof body.filename === "string" ? body.filename.slice(0, 255) : "untitled.pdf";
  const tier = await getUserTier(userId);
  const supabase = createAdminClient();

  await supabase.from("unlocks").insert({
    user_id: userId,
    filename,
    tier,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("unlocks")
    .select("id, filename, tier, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ unlocks: data ?? [] });
}

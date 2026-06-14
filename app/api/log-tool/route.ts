import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, clientKey, tooMany } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "log-tool"), 120, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { tool } = await req.json().catch(() => ({}));
  // Coerce to a bounded string so telemetry can't be used to store junk payloads.
  if (typeof tool !== "string" || !tool) return NextResponse.json({ ok: false });
  const safeTool = tool.slice(0, 64);
  const { userId } = await auth();
  const supabase = createAdminClient();
  await supabase.from("tool_usage").insert({ tool: safeTool, user_id: userId ?? null });
  return NextResponse.json({ ok: true });
}

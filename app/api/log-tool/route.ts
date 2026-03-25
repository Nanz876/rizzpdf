import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { tool, userId } = await req.json().catch(() => ({}));
  if (!tool) return NextResponse.json({ ok: false });
  const supabase = createAdminClient();
  await supabase.from("tool_usage").insert({ tool, user_id: userId ?? null });
  return NextResponse.json({ ok: true });
}

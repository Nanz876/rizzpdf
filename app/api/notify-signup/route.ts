import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const supabase = createAdminClient();
  await supabase.from("notify_signups").upsert({ email }, { onConflict: "email" });
  return NextResponse.json({ ok: true });
}

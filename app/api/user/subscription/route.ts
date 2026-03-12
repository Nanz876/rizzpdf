import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserTier, getSubscription } from "@/lib/tier";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tier, subscription] = await Promise.all([
    getUserTier(userId),
    getSubscription(userId),
  ]);

  return NextResponse.json({ tier, subscription });
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserTier, getSubscription } from "@/lib/tier";
import { createAdminClient } from "@/lib/supabase";
import SubscribeButton from "@/components/SubscribeButton";
import CancelButton from "@/components/CancelButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const supabase = createAdminClient();

  const [user, tier, subscription] = await Promise.all([
    currentUser(),
    getUserTier(userId),
    getSubscription(userId),
  ]);

  const { data: unlocks } = await supabase
    .from("unlocks")
    .select("id, filename, tier, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const firstName =
    user?.firstName ??
    user?.emailAddresses[0]?.emailAddress?.split("@")[0] ??
    "there";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-black text-gray-900"
          >
            RizzPDF
          </Link>
          <span className="text-sm text-gray-500">Dashboard</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Upgraded banner */}
        {params.upgraded && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-green-800 font-medium">
            🎉 Welcome to Pro! Your subscription is now active.
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hey, {firstName} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s your RizzPDF account.</p>
        </div>

        {/* Plan card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  tier === "pro"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tier === "pro" ? "PRO" : "FREE"}
              </span>
              <span className="font-semibold text-gray-900 capitalize">
                {tier} Plan
              </span>
            </div>
            {tier === "pro" ? (
              <p className="text-sm text-gray-500">
                Unlimited files · 200MB per file · All tools · Full history
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                3 files per tool · No history
              </p>
            )}
          </div>
          {tier !== "pro" && <SubscribeButton />}
          {tier === "pro" && (
            <div className="flex flex-col items-end gap-2">
              <Link
                href="/dashboard/bulk"
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors text-center"
              >
                CSV Bulk Unlock →
              </Link>
              <CancelButton periodEnd={subscription?.current_period_end} />
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/tools"
            className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-red-300 transition-colors group"
          >
            <div className="text-2xl mb-2">🛠️</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
              All PDF Tools
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Merge, split, compress, convert &amp; more
            </p>
          </Link>

          {tier === "pro" ? (
            <Link
              href="/dashboard/bulk"
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-red-300 transition-colors group"
            >
              <div className="text-2xl mb-2">📋</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                CSV Bulk Unlock
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload a CSV of filenames + passwords
              </p>
            </Link>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-5 opacity-60">
              <div className="text-2xl mb-2">📋</div>
              <h3 className="font-semibold text-gray-500">CSV Bulk Unlock</h3>
              <p className="text-sm text-gray-400 mt-1">
                Pro plan only · $5/month
              </p>
            </div>
          )}
        </div>

        {/* File history */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">File History</h2>
            <span className="text-sm text-gray-400">
              {unlocks?.length ?? 0} files
            </span>
          </div>
          {!unlocks || unlocks.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <div className="text-3xl mb-2">📂</div>
              <p>
                No files yet. Go{" "}
                <Link href="/tools" className="text-red-600 hover:underline">
                  use a PDF tool
                </Link>
                !
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {unlocks.map((u) => (
                <li
                  key={u.id}
                  className="px-6 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">📄</span>
                    <span className="text-sm text-gray-800 truncate">
                      {u.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.tier === "pro"
                          ? "bg-red-100 text-red-700"
                          : u.tier === "drop"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {u.tier}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

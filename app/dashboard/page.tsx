"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [bulkUntil, setBulkUntil] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEmail(localStorage.getItem("rizzpdf_user_email"));
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until) setBulkUntil(Number(until));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("rizzpdf_user_email");
    router.push("/");
  };

  const bulkActive = bulkUntil && Date.now() < bulkUntil;
  const bulkExpiry = bulkUntil ? new Date(bulkUntil) : null;
  const minutesLeft = bulkUntil ? Math.max(0, Math.round((bulkUntil - Date.now()) / 1000 / 60)) : 0;
  const hoursLeft = Math.floor(minutesLeft / 60);
  const minsLeft = minutesLeft % 60;

  const displayEmail = mounted ? (email ?? "Guest") : "—";
  const displayInitial = mounted ? (email ? email[0].toUpperCase() : "G") : "—";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent"
          >
            RizzPDF
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
              {displayInitial}
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">
            Welcome back{email ? `, ${email.split("@")[0]}` : ""} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s your RizzPDF dashboard</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Plan</p>
            <p className="text-2xl font-black text-gray-900">{bulkActive ? "Bulk" : "Free"}</p>
            <p className="text-xs text-gray-400 mt-1">{bulkActive ? "Unlimited files" : "Up to 3 files"}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bulk Session</p>
            {bulkActive ? (
              <>
                <p className="text-2xl font-black text-green-600">Active</p>
                <p className="text-xs text-gray-400 mt-1">
                  Expires in {hoursLeft}h {minsLeft}m
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-gray-400">None</p>
                <button
                  onClick={() => router.push("/")}
                  className="text-xs text-purple-600 font-semibold mt-1 hover:underline"
                >
                  Get bulk access →
                </button>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Account</p>
            <p className="text-2xl font-black text-gray-900">Free</p>
            <p className="text-xs text-gray-400 mt-1 truncate">{displayEmail}</p>
          </div>
        </div>

        {/* Bulk session banner */}
        {bulkActive && bulkExpiry && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-5 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-lg">🔓 Bulk mode is active</p>
                <p className="text-purple-100 text-sm mt-0.5">
                  Unlimited files unlocked · expires {bulkExpiry.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => router.push("/")}
                className="bg-white text-purple-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors"
              >
                Unlock more →
              </button>
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-black text-gray-900 mb-4">Recent activity</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl mb-3">
              📄
            </div>
            <p className="font-semibold text-gray-700">No files yet</p>
            <p className="text-sm text-gray-400 mt-1">Files you unlock will appear here</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Unlock your first PDF →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

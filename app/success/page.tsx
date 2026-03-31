"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      router.replace("/");
      return;
    }

    fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then(({ valid }) => {
        if (valid) {
          localStorage.setItem("rizzpdf_bulk_until", String(Date.now() + 24 * 60 * 60 * 1000));
          setVerifying(false);
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400 text-sm">Verifying payment…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-4xl">
          🔓
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-3">
          You&apos;re unlocked!
        </h1>
        <p className="text-gray-500 mb-8">
          Bulk mode is active for the next 24 hours. Unlimited files, no cap.
        </p>

        <button
          onClick={() => router.push("/")}
          className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-8 py-3 rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity"
        >
          Start unlocking →
        </button>

        <p className="mt-4 text-xs text-gray-400">
          Payment processed securely by Stripe
        </p>
      </div>
    </div>
  );
}

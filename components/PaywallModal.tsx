"use client";

import { useState } from "react";

interface PaywallModalProps {
  onClose: () => void;
  onPay: () => void;
}

export default function PaywallModal({ onClose, onPay }: PaywallModalProps) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fadeIn text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
          <span className="text-3xl">🔓</span>
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2">
          Going bulk? Respect.
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Free tier is limited to 3 files. Upgrade for just{" "}
          <span className="font-bold text-purple-600">$1</span> to unlock unlimited
          files for 24 hours — no subscription, no account needed.
        </p>

        {/* Features */}
        <ul className="text-left space-y-2 mb-6">
          {[
            "Unlimited files per session",
            "Up to 50MB per file",
            "Access for 24 hours",
            "No subscription ever",
            "Files never leave your browser",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-purple-500 font-bold">✓</span>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity mb-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Redirecting to Stripe..." : "Unlock for $1 →"}
        </button>

        <button
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          No thanks, I&apos;ll stick to 3 files
        </button>
      </div>
    </div>
  );
}

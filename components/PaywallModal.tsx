"use client";

import { useState } from "react";
import Link from "next/link";

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
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        {/* Icon */}
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6M12 18v-6M9 15h6" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2 className="text-[22px] font-black text-gray-900 mb-2">
          Free limit reached
        </h2>
        <p className="text-gray-500 text-[13px] mb-6 leading-relaxed">
          The free tier allows 3 files per tool. Get a{" "}
          <span className="font-bold text-red-600">$1 day pass</span> for
          unlimited files for 24 hours — no account needed.
        </p>

        {/* Features */}
        <ul className="text-left space-y-2 mb-6">
          {[
            "Unlimited files for 24 hours",
            "All 16 PDF tools included",
            "Up to 50MB per file",
            "No subscription, no account",
            "Files never leave your browser",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-gray-700">
              <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-[15px] transition-colors mb-3 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(220,38,38,0.3)]"
        >
          {loading ? "Redirecting to Stripe…" : "Get day pass — $1 →"}
        </button>

        <Link
          href="/pricing"
          className="block text-[12px] text-red-600 font-semibold hover:underline mb-3"
        >
          See all plans including Pro ($5/mo) →
        </Link>

        <button
          onClick={onClose}
          className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          No thanks, I&apos;ll stick to 3 files
        </button>

        <p className="text-[11px] text-gray-400 mt-4">
          Questions?{" "}
          <a
            href="mailto:support@rizzpdf.com"
            className="text-red-500 hover:underline"
          >
            support@rizzpdf.com
          </a>
        </p>
      </div>
    </div>
  );
}

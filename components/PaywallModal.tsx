"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { logTool } from "@/lib/logTool";

interface PaywallModalProps {
  onClose: () => void;
}

export default function PaywallModal({ onClose }: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const { isSignedIn } = useUser();

  async function handleUpgrade() {
    logTool("event:checkout_started:pro");
    if (!isSignedIn) {
      window.location.href = "/sign-up?redirect=/pricing";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
      }
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
          Free batch runs used
        </h2>
        <p className="text-gray-500 text-[13px] mb-6 leading-relaxed">
          You&apos;ve used your 3 free batch runs. Upgrade to{" "}
          <span className="font-bold text-red-600">Pro for $5/month</span> for
          unlimited batch processing.
        </p>

        {/* Features */}
        <ul className="text-left space-y-2 mb-6">
          {[
            "Unlimited batch processing",
            "Bulk unlock from a CSV",
            "File history and priority support",
            "Every single-file tool stays free, always",
            "Files never leave your browser",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-gray-700">
              <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-[15px] transition-colors mb-3 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(220,38,38,0.3)]"
        >
          {loading ? "Redirecting to Stripe…" : "Get Pro — $5/month →"}
        </button>

        <Link
          href="/pricing"
          className="block text-[12px] text-red-600 font-semibold hover:underline mb-3"
        >
          Compare plans, or save 20% with annual billing →
        </Link>

        <button
          onClick={onClose}
          className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          No thanks
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

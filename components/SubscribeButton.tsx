"use client";

import { useState } from "react";

export default function SubscribeButton() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Billing toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
        <button
          onClick={() => setBilling("monthly")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            billing === "monthly"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling("annual")}
          className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
            billing === "annual"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Annual
          <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
            -20%
          </span>
        </button>
      </div>

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {loading
          ? "Redirecting…"
          : billing === "annual"
          ? "Upgrade to Pro — $48/yr"
          : "Upgrade to Pro — $5/mo"}
      </button>
    </div>
  );
}

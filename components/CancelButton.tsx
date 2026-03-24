"use client";

import { useState } from "react";

export default function CancelButton({ periodEnd }: { periodEnd?: string }) {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel your Pro subscription? You'll keep Pro access until the end of your billing period.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cancel", { method: "POST" });
      if (res.ok) {
        setCancelled(true);
      } else {
        alert("Something went wrong. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (cancelled) {
    return (
      <p className="text-xs text-gray-500 text-right">
        Subscription cancelled.{" "}
        {periodEnd && (
          <>Pro access until <strong>{new Date(periodEnd).toLocaleDateString()}</strong>.</>
        )}
      </p>
    );
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      {loading ? "Cancelling…" : "Cancel subscription"}
    </button>
  );
}

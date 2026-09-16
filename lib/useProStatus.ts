"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

// AbortSignal.timeout is missing before Safari 16 / Chrome 103; calling it there
// would throw and make paying users look free. Fall back to no timeout.
function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(ms)
    : undefined;
}

// Keys from the retired $1 day pass. Cleared once so stale values don't linger.
const RETIRED_KEYS = ["rizzpdf_bulk_session", "rizzpdf_bulk_until", "rizzpdf_free_count"];

/**
 * Pro = signed-in Clerk user with an active subscription. The server is the sole
 * authority (no client-side value that could be edited to fake Pro).
 */
export function useProStatus(): { isPro: boolean; loading: boolean } {
  const { isSignedIn, isLoaded } = useUser();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      RETIRED_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Storage blocked: nothing to clean.
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    const finish = (pro: boolean) => {
      if (cancelled) return;
      setIsPro(pro);
      setLoading(false);
    };

    if (!isSignedIn) {
      finish(false);
      return;
    }

    fetch("/api/user/subscription", { signal: timeoutSignal(8000) })
      .then((r) => r.json())
      .then((data) => finish(data?.tier === "pro"))
      .catch(() => finish(false));

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded]);

  return { isPro, loading };
}

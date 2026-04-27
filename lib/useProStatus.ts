"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const PRO_CACHE_KEY = "rizzpdf_pro_verified";
const PRO_CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours

export function useProStatus(): { isPro: boolean; loading: boolean } {
  const { isSignedIn, isLoaded } = useUser();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    // Check bulk day pass first (no network needed)
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) {
      setIsPro(true);
      setLoading(false);
      return;
    }

    // Not signed in — definitively free
    if (!isSignedIn) {
      localStorage.removeItem(PRO_CACHE_KEY);
      setLoading(false);
      return;
    }

    // Check cached pro status — avoids API round-trip on repeat visits within 8h
    try {
      const cached = localStorage.getItem(PRO_CACHE_KEY);
      if (cached) {
        const { until: cacheExpiry } = JSON.parse(cached);
        if (Date.now() < cacheExpiry) {
          setIsPro(true);
          setLoading(false);
          return;
        }
      }
    } catch (_) {}

    fetch("/api/user/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (data?.tier === "pro") {
          setIsPro(true);
          localStorage.setItem(
            PRO_CACHE_KEY,
            JSON.stringify({ until: Date.now() + PRO_CACHE_TTL })
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  return { isPro, loading };
}

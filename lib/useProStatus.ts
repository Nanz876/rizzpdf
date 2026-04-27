"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

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
      setLoading(false);
      return;
    }

    fetch("/api/user/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (data?.tier === "pro") setIsPro(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  return { isPro, loading };
}

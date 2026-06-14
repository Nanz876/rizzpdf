"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const DAY_PASS_KEY = "rizzpdf_bulk_session";

// Module-level memo so repeated mounts within one tab session don't re-hit the
// network. It lives in JS memory only (cleared on reload) and is therefore not
// forgeable like a localStorage value would be.
let dayPassMemo: { sessionId: string; expiresAt: number } | null = null;

export function useProStatus(): { isPro: boolean; loading: boolean } {
  const { isSignedIn, isLoaded } = useUser();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    const finish = (pro: boolean) => {
      if (cancelled) return;
      setIsPro(pro);
      setLoading(false);
    };

    (async () => {
      // 1. Day pass — validated server-side against Stripe. The grant is bound to
      // a real paid checkout session; a tampered localStorage value fails the
      // server check, so the old "set a future timestamp" bypass no longer works.
      const sessionId = localStorage.getItem(DAY_PASS_KEY);
      if (sessionId) {
        if (
          dayPassMemo &&
          dayPassMemo.sessionId === sessionId &&
          Date.now() < dayPassMemo.expiresAt
        ) {
          return finish(true);
        }
        try {
          const r = await fetch(
            `/api/verify-session?session_id=${encodeURIComponent(sessionId)}`
          );
          const data = await r.json();
          if (data?.valid) {
            dayPassMemo = {
              sessionId,
              expiresAt: Number(data.expiresAt) || Date.now(),
            };
            return finish(true);
          }
          // Invalid or expired — drop the stale key.
          localStorage.removeItem(DAY_PASS_KEY);
          dayPassMemo = null;
        } catch {
          // Network error — fall through to the subscription check.
        }
      }

      // 2. Account subscription — the server is the sole authority (no client-side
      // cache that could be edited to fake Pro).
      if (!isSignedIn) return finish(false);
      try {
        const r = await fetch("/api/user/subscription");
        const data = await r.json();
        return finish(data?.tier === "pro");
      } catch {
        return finish(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded]);

  return { isPro, loading };
}

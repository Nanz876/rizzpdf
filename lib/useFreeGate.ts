"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useProStatus } from "@/lib/useProStatus";
import { logTool } from "@/lib/logTool";

/** Free tier: this many operations across ALL tools, then the paywall. */
export const FREE_LIMIT = 3;
export const FREE_COUNT_KEY = "rizzpdf_free_count";
/** How long a still-loading pro status is trusted before we enforce the limit. */
export const LOADING_GRACE_MS = 5000;

// Same-tab writes don't fire the `storage` event, so we notify subscribers ourselves.
const LOCAL_EVENT = "rizzpdf:free-count";

// Known gap: if localStorage is blocked entirely, the count reads as 0 and the
// limit can't persist. Accepted — the paid tier is $1 and not worth fighting over.
export function readFreeCount(): number {
  try {
    const n = parseInt(localStorage.getItem(FREE_COUNT_KEY) ?? "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeFreeCount(n: number) {
  try {
    localStorage.setItem(FREE_COUNT_KEY, String(n));
  } catch {
    // Private mode / blocked storage: the count just doesn't persist.
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === FREE_COUNT_KEY) onChange();
  };
  window.addEventListener("storage", onStorage); // other tabs
  window.addEventListener(LOCAL_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

const serverSnapshot = () => 0;

/**
 * Single source of truth for the free-tier gate.
 *
 * - Call `consume()` when the user clicks a tool's primary action. If it returns
 *   false, stop: the hook has already opened the paywall.
 * - Call `refund()` if that run then fails (wrong password, corrupt file), so a
 *   failure doesn't cost the user one of their free operations.
 *
 * Pro and day-pass users always pass and are never counted. While pro status is
 * loading the run is never blocked but is still counted; after LOADING_GRACE_MS
 * (e.g. Clerk blocked by an extension) the limit is enforced as for a free user.
 */
export function useFreeGate() {
  const { isPro, loading } = useProStatus();
  const count = useSyncExternalStore(subscribe, readFreeCount, serverSnapshot);
  const [showPaywall, setShowPaywall] = useState(false);
  const [graceExpired, setGraceExpired] = useState(false);
  // Whether the most recent consume() actually counted an operation, i.e. whether
  // a failure of that run may be refunded. Never lets a refund exceed what was counted.
  const lastConsumeCounted = useRef(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setGraceExpired(true), LOADING_GRACE_MS);
    return () => clearTimeout(t);
  }, [loading]);

  const stillLoading = loading && !graceExpired;
  const remaining = isPro ? Infinity : Math.max(0, FREE_LIMIT - count);
  const canRun = stillLoading || isPro || count < FREE_LIMIT;

  const consume = useCallback((): boolean => {
    lastConsumeCounted.current = false;
    if (isPro) return true;
    const current = readFreeCount();
    if (current < FREE_LIMIT) {
      writeFreeCount(current + 1);
      lastConsumeCounted.current = true;
      return true;
    }
    if (stillLoading) return true;
    setShowPaywall(true);
    logTool("event:paywall_shown");
    return false;
  }, [isPro, stillLoading]);

  const refund = useCallback(() => {
    if (!lastConsumeCounted.current) return;
    lastConsumeCounted.current = false;
    writeFreeCount(Math.max(0, readFreeCount() - 1));
  }, []);

  const openPaywall = useCallback(() => setShowPaywall(true), []);
  const closePaywall = useCallback(() => setShowPaywall(false), []);

  return {
    canRun,
    remaining,
    consume,
    refund,
    showPaywall,
    openPaywall,
    closePaywall,
    isPro,
    loading: stillLoading,
  };
}

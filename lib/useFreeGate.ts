"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useProStatus } from "@/lib/useProStatus";
import { logTool } from "@/lib/logTool";

/** Free tier: this many operations across ALL tools, then the paywall. */
export const FREE_LIMIT = 3;
export const FREE_COUNT_KEY = "rizzpdf_free_count";

// Same-tab writes don't fire the `storage` event, so we notify subscribers ourselves.
const LOCAL_EVENT = "rizzpdf:free-count";

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
 * Single source of truth for the free-tier gate. Call `consume()` in the tool's
 * primary handler; if it returns false, stop (the hook has already opened the
 * paywall). Pro and day-pass users always pass and are never counted. While pro
 * status is still loading, the run is never blocked (don't punish a paying user
 * for a slow network) but is still counted, so fast clicks can't skip the meter.
 */
export function useFreeGate() {
  const { isPro, loading } = useProStatus();
  const count = useSyncExternalStore(subscribe, readFreeCount, serverSnapshot);
  const [showPaywall, setShowPaywall] = useState(false);

  const remaining = isPro ? Infinity : Math.max(0, FREE_LIMIT - count);
  const canRun = loading || isPro || count < FREE_LIMIT;

  const consume = useCallback((): boolean => {
    if (isPro) return true;
    const current = readFreeCount();
    if (loading) {
      if (current < FREE_LIMIT) writeFreeCount(current + 1);
      return true;
    }
    if (current >= FREE_LIMIT) {
      setShowPaywall(true);
      logTool("event:paywall_shown");
      return false;
    }
    writeFreeCount(current + 1);
    return true;
  }, [loading, isPro]);

  const openPaywall = useCallback(() => setShowPaywall(true), []);
  const closePaywall = useCallback(() => setShowPaywall(false), []);

  return { canRun, remaining, consume, showPaywall, openPaywall, closePaywall, isPro, loading };
}

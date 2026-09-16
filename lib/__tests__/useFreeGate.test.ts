import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const proState = { isPro: false, loading: false };
vi.mock("@/lib/useProStatus", () => ({
  useProStatus: () => proState,
}));
const logTool = vi.fn();
vi.mock("@/lib/logTool", () => ({ logTool: (t: string) => logTool(t) }));

import { useFreeGate, FREE_LIMIT, FREE_COUNT_KEY } from "@/lib/useFreeGate";

beforeEach(() => {
  localStorage.clear();
  logTool.mockClear();
  proState.isPro = false;
  proState.loading = false;
});

describe("useFreeGate", () => {
  it("allows 3 operations then blocks and opens the paywall", () => {
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(FREE_LIMIT);

    for (let i = 1; i <= FREE_LIMIT; i++) {
      let ok = false;
      act(() => { ok = result.current.consume(); });
      expect(ok).toBe(true);
      expect(result.current.remaining).toBe(FREE_LIMIT - i);
    }
    expect(result.current.canRun).toBe(false);

    let ok = true;
    act(() => { ok = result.current.consume(); });
    expect(ok).toBe(false);
    expect(result.current.showPaywall).toBe(true);
    expect(logTool).toHaveBeenCalledWith("event:paywall_shown");
    expect(localStorage.getItem(FREE_COUNT_KEY)).toBe(String(FREE_LIMIT));
  });

  it("persists the count in localStorage under rizzpdf_free_count", () => {
    localStorage.setItem(FREE_COUNT_KEY, "2");
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(1);
  });

  it("treats garbage localStorage values as 0", () => {
    localStorage.setItem(FREE_COUNT_KEY, "banana");
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(FREE_LIMIT);
    localStorage.setItem(FREE_COUNT_KEY, "-4");
    const { result: r2 } = renderHook(() => useFreeGate());
    expect(r2.current.remaining).toBe(FREE_LIMIT);
  });

  it("never counts or blocks Pro / day-pass users", () => {
    proState.isPro = true;
    localStorage.setItem(FREE_COUNT_KEY, "99");
    const { result } = renderHook(() => useFreeGate());
    expect(result.current.remaining).toBe(Infinity);
    let ok = false;
    act(() => { ok = result.current.consume(); });
    expect(ok).toBe(true);
    expect(result.current.showPaywall).toBe(false);
    expect(localStorage.getItem(FREE_COUNT_KEY)).toBe("99");
  });

  it("allows without counting while pro status is still loading", () => {
    proState.loading = true;
    localStorage.setItem(FREE_COUNT_KEY, "3");
    const { result } = renderHook(() => useFreeGate());
    let ok = false;
    act(() => { ok = result.current.consume(); });
    expect(ok).toBe(true);
    expect(localStorage.getItem(FREE_COUNT_KEY)).toBe("3");
  });

  it("openPaywall / closePaywall toggle state", () => {
    const { result } = renderHook(() => useFreeGate());
    act(() => result.current.openPaywall());
    expect(result.current.showPaywall).toBe(true);
    act(() => result.current.closePaywall());
    expect(result.current.showPaywall).toBe(false);
  });
});

"use client";

// App-wide progress overlay for long, page-countable operations (rendering
// thumbnails of a big PDF, converting to PowerPoint/Word, compressing). Tools
// wrap the work in runWithProgress() and call report(done, total) as they go,
// so the user sees a real bar instead of a frozen tab. Short ops shouldn't use
// this — a tool's own inline status is better for those (see OCR).
import { createContext, useCallback, useContext, useState } from "react";

/** Report progress: `done` of `total` units complete. Call with total 0 for an indeterminate phase. */
export type ProgressReport = (done: number, total: number) => void;

interface ProgressContext {
  runWithProgress: <T>(label: string, task: (report: ProgressReport) => Promise<T>) => Promise<T>;
}

const Ctx = createContext<ProgressContext | null>(null);

export function useProgress(): ProgressContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress must be used within <ProgressProvider>");
  return ctx;
}

interface State {
  label: string;
  done: number;
  total: number;
}

export default function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null);

  const runWithProgress = useCallback(
    async <T,>(label: string, task: (report: ProgressReport) => Promise<T>): Promise<T> => {
      setState({ label, done: 0, total: 0 });
      // Coalesce rapid reports into one state update per frame so a fast loop
      // doesn't thrash React.
      let frame: number | null = null;
      let latest: State = { label, done: 0, total: 0 };
      const report: ProgressReport = (done, total) => {
        latest = { label, done, total };
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          setState(latest);
        });
      };
      try {
        return await task(report);
      } finally {
        if (frame !== null) cancelAnimationFrame(frame);
        setState(null);
      }
    },
    []
  );

  const pct = state && state.total > 0 ? Math.min(100, Math.round((state.done / state.total) * 100)) : null;

  return (
    <Ctx.Provider value={{ runWithProgress }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{state.label}</p>
              {pct !== null && <p className="text-sm font-bold text-red-600 tabular-nums">{pct}%</p>}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              {pct !== null ? (
                <div className="h-full rounded-full bg-red-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
              ) : (
                // Indeterminate phase: a sliding sliver.
                <div className="h-full w-1/3 rounded-full bg-red-600 animate-[progress-slide_1.2s_ease-in-out_infinite]" />
              )}
            </div>
            {pct !== null && state.total > 0 && (
              <p className="mt-2 text-xs text-gray-400 tabular-nums">
                {state.done} / {state.total}
              </p>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes progress-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </Ctx.Provider>
  );
}

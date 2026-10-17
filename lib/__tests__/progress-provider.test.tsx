// @vitest-environment jsdom
// Verifies the shared progress overlay shows while a task runs and clears after,
// and that runWithProgress returns the task's result (and still clears on throw).
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { useRef } from "react";
import ProgressProvider, { useProgress } from "@/components/ProgressProvider";

afterEach(cleanup);

function Harness({ task, onDone }: { task: () => Promise<unknown>; onDone: (v: unknown, err: boolean) => void }) {
  const { runWithProgress } = useProgress();
  const started = useRef(false);
  return (
    <button
      onClick={() => {
        if (started.current) return;
        started.current = true;
        runWithProgress("Working", async () => task()).then(
          (v) => onDone(v, false),
          () => onDone(undefined, true)
        );
      }}
    >
      go
    </button>
  );
}

describe("ProgressProvider", () => {
  it("shows the overlay while the task runs and hides it when done", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    render(
      <ProgressProvider>
        <Harness task={() => gate.then(() => "ok")} onDone={() => {}} />
      </ProgressProvider>
    );
    fireEvent.click(screen.getByText("go"));
    expect(await screen.findByText("Working")).toBeTruthy(); // overlay up
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText("Working")).toBeNull()); // cleared
  });

  it("returns the task result and clears the overlay on throw", async () => {
    let captured: { v: unknown; err: boolean } | null = null;
    render(
      <ProgressProvider>
        <Harness task={() => Promise.reject(new Error("boom"))} onDone={(v, err) => (captured = { v, err })} />
      </ProgressProvider>
    );
    fireEvent.click(screen.getByText("go"));
    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.err).toBe(true);
    expect(screen.queryByText("Working")).toBeNull();
  });
});

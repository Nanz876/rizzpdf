// @vitest-environment jsdom
// Verifies the inline password modal end-to-end at the React level: a consumer
// calls requestPassword(), the modal appears, and submitting / cancelling /
// retrying resolves the promise the way unlockFileIfNeeded depends on.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { useRef } from "react";
import PasswordPromptProvider, { usePasswordPrompt } from "@/components/PasswordPromptProvider";

afterEach(cleanup);

// A tiny harness: a button that fires requestPassword and records the resolved value.
function Harness({ wrong = false, onResolved }: { wrong?: boolean; onResolved: (v: string | null) => void }) {
  const requestPassword = usePasswordPrompt();
  const last = useRef<Promise<string | null> | null>(null);
  return (
    <button
      onClick={() => {
        last.current = requestPassword("secret.pdf", wrong);
        last.current.then(onResolved);
      }}
    >
      ask
    </button>
  );
}

function setup(wrong = false) {
  let resolved: string | null | undefined;
  render(
    <PasswordPromptProvider>
      <Harness wrong={wrong} onResolved={(v) => (resolved = v)} />
    </PasswordPromptProvider>
  );
  fireEvent.click(screen.getByText("ask"));
  return () => resolved;
}

describe("PasswordPromptProvider modal", () => {
  it("shows the prompt with the filename when requestPassword is called", async () => {
    setup();
    expect(await screen.findByText("Password required")).toBeTruthy();
    expect(screen.getByText("secret.pdf")).toBeTruthy();
  });

  it("resolves with the typed password on Unlock", async () => {
    const getResolved = setup();
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "rizz123" } });
    fireEvent.click(screen.getByText("Unlock"));
    await waitFor(() => expect(getResolved()).toBe("rizz123"));
    // Modal is gone afterwards.
    expect(screen.queryByText("Password required")).toBeNull();
  });

  it("resolves with null on Cancel", async () => {
    const getResolved = setup();
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(getResolved()).toBeNull());
    expect(screen.queryByText("Password required")).toBeNull();
  });

  it("submits on Enter in the password field", async () => {
    const getResolved = setup();
    const input = screen.getByPlaceholderText("Password");
    fireEvent.change(input, { target: { value: "hunter2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(getResolved()).toBe("hunter2"));
  });

  it("won't submit an empty password", async () => {
    const getResolved = setup();
    fireEvent.click(screen.getByText("Unlock"));
    // Nothing resolves and the modal stays up.
    await act(async () => { await Promise.resolve(); });
    expect(getResolved()).toBeUndefined();
    expect(screen.getByText("Password required")).toBeTruthy();
  });

  it("shows the 'incorrect password' hint when asked again after a wrong try", async () => {
    setup(true);
    expect(await screen.findByText(/Incorrect password/i)).toBeTruthy();
  });
});

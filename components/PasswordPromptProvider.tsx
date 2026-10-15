"use client";

// App-wide inline password prompt. Any tool can ask for a PDF's password without
// sending the user off to the Unlock tool: UploadZone (and a couple of custom
// intakes) call requestPassword() through this context, and a single modal
// handles the ask. The password never leaves the browser — it's used in-memory
// to decrypt and is discarded when the modal closes.
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { RequestPassword } from "@/lib/pdf-unlock-file";

interface PasswordPromptContext {
  requestPassword: RequestPassword;
}

const Ctx = createContext<PasswordPromptContext | null>(null);

/** Ask for a PDF password via the app-wide modal. Resolves to the password, or null if cancelled. */
export function usePasswordPrompt(): RequestPassword {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePasswordPrompt must be used within <PasswordPromptProvider>");
  return ctx.requestPassword;
}

interface PromptState {
  filename: string;
  wrong: boolean;
}

export default function PasswordPromptProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const resolverRef = useRef<((password: string | null) => void) | null>(null);

  const requestPassword = useCallback<RequestPassword>((filename, wrong) => {
    setState({ filename, wrong });
    setValue("");
    setShow(false);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((password: string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    setValue("");
    resolve?.(password);
  }, []);

  const submit = useCallback(() => {
    if (!value) return;
    settle(value);
  }, [value, settle]);

  return (
    <Ctx.Provider value={{ requestPassword }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === "Escape") settle(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="#ef4444" strokeWidth="2" />
                  <path d="M8 11V7a4 4 0 018 0v4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-gray-900 leading-tight">Password required</h2>
                <p className="text-xs text-gray-400 truncate">{state.filename}</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              This PDF is password-protected. Enter its password to continue — it stays in your browser.
            </p>

            <div className="relative">
              <input
                autoFocus
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Password"
                className={`w-full border rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none ${
                  state.wrong ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-red-400"
                }`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {state.wrong && <p className="text-xs text-red-500 mt-1.5">Incorrect password — try again.</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => settle(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!value}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

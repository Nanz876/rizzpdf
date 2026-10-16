"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import { comparePdfs, type CompareResult, type DiffToken } from "@/lib/tools/pdf-compare";
import { unlockFileIfNeeded } from "@/lib/pdf-unlock-file";
import { usePasswordPrompt } from "@/components/PasswordPromptProvider";

type Status = "idle" | "processing" | "done" | "error";

function FileSlot({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const requestPassword = usePasswordPrompt();
  const take = async (files: FileList | null) => {
    const pdf = files && Array.from(files).find((f) => f.type === "application/pdf");
    if (!pdf) return;
    // Unlock password-protected PDFs inline, same as every other tool.
    const unlocked = await unlockFileIfNeeded(pdf, requestPassword);
    if (unlocked) onPick(unlocked);
  };
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
      className={`flex-1 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors
        ${drag ? "border-red-400 bg-red-50" : file ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-red-300"}`}
    >
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => take(e.target.files)} />
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      {file ? (
        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
      ) : (
        <p className="text-sm text-gray-400">Click or drop a PDF</p>
      )}
    </div>
  );
}

function DiffColumn({ title, tokens, side }: { title: string; tokens: DiffToken[]; side: "left" | "right" }) {
  const markClass = side === "left" ? "bg-red-100 text-red-700 line-through" : "bg-green-100 text-green-700";
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
        {tokens.length === 0 ? (
          <span className="text-gray-300 italic">(no text on this page)</span>
        ) : (
          tokens.map((t, i) => (
            <span key={i} className={t.op === "same" ? "" : `${markClass} rounded px-0.5`}>
              {t.text}{" "}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [original, setOriginal] = useState<File | null>(null);
  const [changed, setChanged] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(true);

  const run = useCallback(async () => {
    if (!original || !changed) return;
    logTool("compare"); setStatus("processing"); setError(""); setResult(null);
    const r = await comparePdfs(original, changed);
    if (r.success && r.result) { setResult(r.result); setStatus("done"); }
    else { setError(r.error ?? "Comparison failed."); setStatus("error"); }
  }, [original, changed]);

  const reset = () => { setOriginal(null); setChanged(null); setResult(null); setStatus("idle"); setError(""); };

  const shownPages = result?.pages.filter((p) => !onlyChanges || p.changed) ?? [];

  return (
    <ToolShell
      name="Compare PDF"
      description="Spot what changed between two PDFs. Added and removed words are highlighted side by side — all in your browser."
      icon="🔍"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6" stroke="white" strokeWidth="1.8"/><path d="M15 15l4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
      steps={result ? undefined : ["Add the original PDF", "Add the changed PDF", "See the differences"]}
    >
      {!result && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <FileSlot label="Original" file={original} onPick={setOriginal} />
            <FileSlot label="Changed" file={changed} onPick={setChanged} />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={run}
            disabled={!original || !changed || status === "processing"}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors"
          >
            {status === "processing" ? "Comparing…" : "Compare PDFs →"}
          </button>
          <p className="text-xs text-gray-400 text-center">Compares the text of each page. Both files stay in your browser.</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-wrap items-center gap-4">
            {result.identical ? (
              <p className="text-sm font-semibold text-green-600">✓ The text of these two PDFs is identical.</p>
            ) : (
              <>
                <span className="text-sm text-gray-600">
                  <span className="font-bold text-green-600">+{result.added}</span> added,{" "}
                  <span className="font-bold text-red-600">−{result.removed}</span> removed across{" "}
                  <span className="font-bold">{result.changedPages}</span> page{result.changedPages !== 1 ? "s" : ""}
                </span>
                <label className="text-sm text-gray-500 flex items-center gap-2 ml-auto">
                  <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
                  Only changed pages
                </label>
              </>
            )}
            <button onClick={reset} className="text-sm text-red-600 font-semibold hover:underline ml-auto">Compare others</button>
          </div>

          {shownPages.map((p) => (
            <div key={p.page} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500">
                {p.status === "added"
                  ? `Page ${p.rightPage} · added`
                  : p.status === "removed"
                  ? `Page ${p.leftPage} · removed`
                  : p.leftPage !== p.rightPage
                  ? `Page ${p.leftPage} → ${p.rightPage}${p.status === "same" ? " · unchanged" : ""}`
                  : `Page ${p.leftPage}${p.status === "same" ? " · unchanged" : ""}`}
              </div>
              <div className="p-5 flex flex-col sm:flex-row gap-6">
                <DiffColumn title="Original" tokens={p.left} side="left" />
                <div className="hidden sm:block w-px bg-gray-100" />
                <DiffColumn title="Changed" tokens={p.right} side="right" />
              </div>
            </div>
          ))}
          {!result.identical && shownPages.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No changed pages to show.</p>
          )}
        </div>
      )}
    </ToolShell>
  );
}

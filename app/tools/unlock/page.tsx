"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import FileCard, { FileEntry } from "@/components/FileCard";
import PaywallModal from "@/components/PaywallModal";
import { unlockPDF, downloadBlob } from "@/lib/pdf-unlock";
import { useProStatus } from "@/lib/useProStatus";

const FREE_LIMIT = 3;

export default function UnlockPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [useSamePassword, setUseSamePassword] = useState(false);
  const [sharedPassword, setSharedPassword] = useState("");
  const [showSharedPassword, setShowSharedPassword] = useState(false);
  const [unlockingAll, setUnlockingAll] = useState(false);
  const { isPro, loading: proLoading } = useProStatus();

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const currentCount = files.length;
      const allowed = proLoading || isPro ? Infinity : FREE_LIMIT;
      if (currentCount >= allowed) { setShowPaywall(true); return; }
      const toAdd = newFiles.slice(0, allowed - currentCount);
      const overflow = newFiles.length - toAdd.length;
      const entries: FileEntry[] = toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, status: "idle" }));
      setFiles((prev) => [...prev, ...entries]);
      if (overflow > 0) setTimeout(() => setShowPaywall(true), 300);
    },
    [files.length, isPro, proLoading]
  );

  const handleRemove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);
  const handleStatusChange = useCallback((id: string, status: FileEntry["status"], error?: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));
  }, []);

  const handleUnlockAll = useCallback(async () => {
    const pending = files.filter((f) => f.status === "idle" || f.status === "error");
    if (pending.length === 0 || unlockingAll) return;
    setUnlockingAll(true);
    for (const entry of pending) {
      handleStatusChange(entry.id, "processing");
      const result = await unlockPDF(entry.file, sharedPassword);
      if (result.success && result.blob && result.filename) {
        downloadBlob(result.blob, result.filename);
        handleStatusChange(entry.id, "done");
      } else {
        handleStatusChange(entry.id, "error", result.error);
      }
    }
    setUnlockingAll(false);
  }, [files, sharedPassword, handleStatusChange, unlockingAll]);

  return (
    <ToolShell
      name="Unlock PDF"
      description="Remove PDF password protection instantly. Free for up to 3 files."
      icon="🔓"
      steps={files.length > 0 ? undefined : ["Upload your PDF", "Enter the password", "Download unlocked file"]}
    >
      <UploadZone onFilesAdded={handleFilesAdded} />

      {!proLoading && !isPro && files.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`w-8 h-1.5 rounded-full ${i < files.length ? "bg-red-500" : "bg-gray-200"}`} />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {files.length}/3 free files used
            {files.length >= FREE_LIMIT && (
              <button onClick={() => setShowPaywall(true)} className="ml-2 text-red-600 font-semibold hover:underline">
                Go bulk for $1 →
              </button>
            )}
          </span>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 border border-gray-200 rounded-2xl p-4 bg-white">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useSamePassword}
              onChange={(e) => setUseSamePassword(e.target.checked)}
              className="w-4 h-4 accent-purple-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700">All files share the same password</span>
          </label>

          {useSamePassword && (
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showSharedPassword ? "text" : "password"}
                  value={sharedPassword}
                  onChange={(e) => setSharedPassword(e.target.value)}
                  placeholder="Shared password (leave blank if not needed)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowSharedPassword(!showSharedPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSharedPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={handleUnlockAll}
                disabled={unlockingAll || files.every((f) => f.status === "done")}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {unlockingAll ? "Unlocking…" : "Unlock All →"}
              </button>
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your files ({files.length})</h2>
            <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-red-500">Clear all</button>
          </div>
          <div className="space-y-3">
            {files.map((entry) => (
              <FileCard
                key={entry.id}
                entry={entry}
                onRemove={handleRemove}
                onStatusChange={handleStatusChange}
                sharedPassword={useSamePassword ? sharedPassword : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onPay={() => setShowPaywall(false)}
        />
      )}
    </ToolShell>
  );
}

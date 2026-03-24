"use client";

import { useState, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import FileCard, { FileEntry } from "@/components/FileCard";
import PaywallModal from "@/components/PaywallModal";

const FREE_LIMIT = 3;

export default function UnlockPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) setIsPro(true);
  }, []);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const currentCount = files.length;
      const allowed = isPro ? Infinity : FREE_LIMIT;
      if (currentCount >= allowed) { setShowPaywall(true); return; }
      const toAdd = newFiles.slice(0, allowed - currentCount);
      const overflow = newFiles.length - toAdd.length;
      const entries: FileEntry[] = toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, status: "idle" }));
      setFiles((prev) => [...prev, ...entries]);
      if (overflow > 0) setTimeout(() => setShowPaywall(true), 300);
    },
    [files.length, isPro]
  );

  const handleRemove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);
  const handleStatusChange = useCallback((id: string, status: FileEntry["status"], error?: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));
  }, []);

  return (
    <ToolShell
      name="Unlock PDF"
      description="Remove PDF password protection instantly. Free for up to 3 files."
      icon="🔓"
      steps={files.length > 0 ? undefined : ["Upload your PDF", "Enter the password", "Download unlocked file"]}
    >
      <UploadZone onFilesAdded={handleFilesAdded} />

      {!isPro && files.length > 0 && (
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
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your files ({files.length})</h2>
            <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-red-500">Clear all</button>
          </div>
          <div className="space-y-3">
            {files.map((entry) => (
              <FileCard key={entry.id} entry={entry} onRemove={handleRemove} onStatusChange={handleStatusChange} />
            ))}
          </div>
        </div>
      )}

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onPay={() => { setIsPro(true); setShowPaywall(false); }}
        />
      )}
    </ToolShell>
  );
}

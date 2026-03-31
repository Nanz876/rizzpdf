"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import PaywallModal from "@/components/PaywallModal";
import { batchProcess, BatchOptions, downloadBlob } from "@/lib/pdf-tools";

const FREE_LIMIT = 3;

type FileStatus = "idle" | "processing" | "done" | "error";

interface BatchFile {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
}

type Tool = BatchOptions["tool"];

const TOOL_LABELS: Record<Tool, string> = {
  compress: "Compress",
  rotate: "Rotate",
  "pdf-to-jpg": "PDF to JPG",
  watermark: "Watermark",
  "page-numbers": "Page Numbers",
  unlock: "Unlock",
};

export default function BatchPage() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [tool, setTool] = useState<Tool>("compress");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [pageNumPosition, setPageNumPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left">("bottom-center");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const resultsRef = useRef<Array<{ blob: Blob; filename: string } | null>>([]);

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
      const entries: BatchFile[] = toAdd.map((f) => ({
        id: crypto.randomUUID(), file: f, status: "idle",
      }));
      setFiles((prev) => [...prev, ...entries]);
      if (overflow > 0) setTimeout(() => setShowPaywall(true), 300);
    },
    [files.length, isPro]
  );

  const buildOptions = (): BatchOptions => {
    if (tool === "compress") return { tool: "compress", quality };
    if (tool === "rotate") return { tool: "rotate", angle };
    if (tool === "watermark") return { tool: "watermark", text: watermarkText || "CONFIDENTIAL" };
    if (tool === "page-numbers") return { tool: "page-numbers", position: pageNumPosition };
    if (tool === "unlock") return { tool: "unlock", password: unlockPassword || undefined };
    return { tool: "pdf-to-jpg" };
  };

  const handleRun = async () => {
    if (files.length === 0 || running) return;
    setRunning(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "idle", error: undefined })));
    resultsRef.current = [];

    const opts = buildOptions();
    const fileList = files.map((f) => f.file);

    const results = await batchProcess(fileList, opts, (i, status, error) => {
      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status, error } : f))
      );
    });

    resultsRef.current = results;
    setRunning(false);
  };

  const handleDownloadAll = () => {
    resultsRef.current.forEach((r) => {
      if (r) downloadBlob(r.blob, r.filename);
    });
  };

  const handleDownloadOne = (i: number) => {
    const r = resultsRef.current[i];
    if (r) downloadBlob(r.blob, r.filename);
  };

  const doneCount = files.filter((f) => f.status === "done").length;
  const allDone = files.length > 0 && doneCount === files.length;
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="Batch Processing"
      description="Apply the same operation to multiple PDFs at once. Free for up to 3 files."
      icon="⚡"
      steps={files.length > 0 ? undefined : ["Upload your PDFs", "Choose an operation", "Download all results"]}
    >
      {/* Upload zone always visible */}
      <UploadZone onFilesAdded={handleFilesAdded} />

      {!isPro && files.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-2">
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-2">
          {/* Options panel */}
          <div className="p-5 border-b border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Operation</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TOOL_LABELS) as Tool[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      tool === t ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-red-300"
                    }`}
                  >
                    {TOOL_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {tool === "compress" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quality</label>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((q) => (
                    <button key={q} onClick={() => setQuality(q)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors capitalize ${
                        quality === q ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-red-300"
                      }`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === "rotate" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Angle</label>
                <div className="flex gap-2">
                  {([90, 180, 270] as const).map((a) => (
                    <button key={a} onClick={() => setAngle(a)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        angle === a ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-red-300"
                      }`}>
                      {a}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === "watermark" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Watermark text</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="CONFIDENTIAL"
                  className="w-full max-w-xs border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
            )}

            {tool === "page-numbers" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
                <div className="flex gap-2">
                  {(["bottom-left", "bottom-center", "bottom-right"] as const).map((p) => (
                    <button key={p} onClick={() => setPageNumPosition(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors capitalize ${
                        pageNumPosition === p ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-red-300"
                      }`}>
                      {p.replace("bottom-", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === "unlock" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password (if any)</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Leave blank if unencrypted"
                  className="w-full max-w-xs border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="px-5 py-3 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-gray-500">{files.length} file{files.length !== 1 ? "s" : ""} ready</span>
            <div className="flex items-center gap-2">
              {allDone && (
                <button
                  onClick={handleDownloadAll}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
                >
                  ↓ Download All
                </button>
              )}
              <button
                onClick={handleRun}
                disabled={running || files.length === 0}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {running ? "Processing…" : allDone ? "Run Again" : `Run ${TOOL_LABELS[tool]}`}
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="divide-y divide-gray-100">
            {files.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                  <p className="text-xs text-gray-400">{fmt(entry.file.size)}</p>
                </div>

                {entry.status === "idle" && (
                  <span className="text-xs text-gray-400">Waiting</span>
                )}
                {entry.status === "processing" && (
                  <span className="text-xs text-blue-500 animate-pulse">Processing…</span>
                )}
                {entry.status === "error" && (
                  <span className="text-xs text-red-500 truncate max-w-[140px]" title={entry.error}>
                    {entry.error ?? "Error"}
                  </span>
                )}
                {entry.status === "done" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-semibold">✓ Done</span>
                    <button
                      onClick={() => handleDownloadOne(i)}
                      className="text-xs text-red-600 hover:underline font-semibold"
                    >
                      Download
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setFiles((prev) => prev.filter((f) => f.id !== entry.id))}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0"
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
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

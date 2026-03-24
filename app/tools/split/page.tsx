"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import SidebarWorkspace from "@/components/pdf/SidebarWorkspace";
import { renderThumbnails, splitPDF, downloadBlob } from "@/lib/pdf-tools";

type Mode = "every-page" | "range";
type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("every-page");
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [splitCount, setSplitCount] = useState(0);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    const t = await renderThumbnails(files[0], 0.35);
    setThumbs(t); setStatus("ready");
  }, []);

  const handleSplit = async () => {
    if (!file) return;
    setStatus("processing");
    const result = await splitPDF(file, mode, mode === "range" ? rangeStr : undefined);
    if (result.success && result.blobs) {
      result.blobs.forEach((blob, i) => downloadBlob(blob, result.filenames![i]));
      setSplitCount(result.blobs.length); setStatus("done");
    } else { setError(result.error ?? "Split failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setMode("every-page"); setRangeStr(""); setStatus("idle"); setError(""); };

  const sidebar = (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Split Mode</p>
      {([
        ["every-page", "Split every page", "Each page becomes a separate PDF"],
        ["range", "Custom ranges", "e.g. 1-3, 4-6, 7-end"],
      ] as const).map(([val, label, desc]) => (
        <button key={val} onClick={() => setMode(val)}
          className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors
            ${mode === val ? "border-red-200 bg-red-50" : "border-transparent hover:bg-gray-50"}`}>
          <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 ${mode === val ? "border-red-600 bg-red-600" : "border-gray-300"}`}/>
          <div>
            <div className="text-xs font-semibold text-gray-800">{label}</div>
            <div className="text-xs text-gray-400">{desc}</div>
          </div>
        </button>
      ))}
      {mode === "range" && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Page ranges</label>
          <input value={rangeStr} onChange={e => setRangeStr(e.target.value)}
            placeholder="1-3, 4-6" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
          <p className="text-xs text-gray-400 mt-1">Separate ranges with commas</p>
        </div>
      )}
    </div>
  );

  return (
    <ToolShell name="Split PDF" description="Split a PDF into multiple files." icon="✂️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Choose split mode", "Download files"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(["ready", "processing", "done", "error"] as Status[]).includes(status) && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
            title="Split PDF" subtitle={`${file.name} · ${thumbs.length} pages`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Splitting…" : status === "done" ? `✓ ${splitCount} files downloaded` : "Split PDF →"}
            onPrimary={status === "done" ? reset : handleSplit}
            primaryDisabled={status === "processing" || (mode === "range" && !rangeStr.trim())} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <SidebarWorkspace sidebar={sidebar}>
            <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
              {thumbs.map((url, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="flex-shrink-0 w-24">
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <img src={url} alt={`Page ${i + 1}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-1">{i + 1}</div>
                  </div>
                  {i < thumbs.length - 1 && mode === "every-page" && (
                    <div className="w-0.5 self-stretch bg-red-400 rounded mx-1 relative flex-shrink-0">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs">✂</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SidebarWorkspace>
        </div>
      )}
    </ToolShell>
  );
}

"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import SidebarWorkspace from "@/components/pdf/SidebarWorkspace";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, downloadBlob, type ToolResult } from "@/lib/pdf-tools";
import type { PageNumberOptions, PageNumberPosition } from "@/lib/pdf-tools";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

const POSITIONS: PageNumberPosition[] = [
  "top-left", "top-center", "top-right",
  "bottom-left", "bottom-center", "bottom-right",
];

// Where the number badge / hotspot sits on the preview for each position.
const spotStyle: Record<PageNumberPosition, React.CSSProperties> = {
  "top-left": { top: 8, left: 8 },
  "top-center": { top: 8, left: "50%", transform: "translateX(-50%)" },
  "top-right": { top: 8, right: 8 },
  "bottom-left": { bottom: 8, left: 8 },
  "bottom-center": { bottom: 8, left: "50%", transform: "translateX(-50%)" },
  "bottom-right": { bottom: 8, right: 8 },
};

export default function PageNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [format, setFormat] = useState<PageNumberOptions["format"]>("1");
  const [fontSize, setFontSize] = useState(12);
  const [startFrom, setStartFrom] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    let t: string[];
    try {
      t = await renderThumbnails(files[0], 0.7);
    } catch (e) {
      setFile(null); setStatus("idle");
      setError(e instanceof Error ? e.message : "This file couldn't be opened.");
      return;
    }
    setPreviewUrl(t[0] ?? null); setPageCount(t.length); setStatus("ready");
  }, []);

  const handleApply = async () => {
    if (!file) return;
    logTool("page-numbers"); setStatus("processing");
    const result = await runInWorker<ToolResult>("addPageNumbers", file, { position, format, fontSize, startFrom });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_numbered.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setPreviewUrl(null); setStatus("idle"); setError(""); };

  const label = (() => {
    const n = startFrom;
    if (format === "1") return `${n}`;
    if (format === "Page 1") return `Page ${n}`;
    return `${n} / ${pageCount}`;
  })();

  const sidebar = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Format</label>
        <div className="flex flex-col gap-1.5">
          {(["1", "Page 1", "1 / N"] as const).map(f => (
            <button key={f} onClick={() => setFormat(f)}
              className={`py-2 px-3 rounded-lg border text-xs font-semibold text-left transition-colors
                ${format === f ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Start from</label>
        <input type="number" min={1} value={startFrom} onChange={e => setStartFrom(parseInt(e.target.value) || 1)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Font size: {fontSize}px</label>
        <input type="range" min={8} max={24} value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))}
          className="w-full accent-red-600" />
      </div>
    </div>
  );

  return (
    <ToolShell name="Page Numbers" description="Click where you want the number — pick any corner or edge — then download." icon="🔢"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><path d="M8 8h8M8 12h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="17" r="2.5" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.2"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click a spot & set format", "Download numbered PDF"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Loading…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><path d="M9 9h1v6M8 15h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="Page Numbers" subtitle={file.name}
            onReset={reset}
            primaryLabel={status === "processing" ? "Adding…" : status === "done" ? "✓ Downloaded!" : "Add Page Numbers →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <SidebarWorkspace sidebar={sidebar}>
            {previewUrl ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative inline-block">
                  <img src={previewUrl} alt="Preview" className="max-h-96 object-contain rounded-lg shadow-sm" draggable={false} />
                  {POSITIONS.map(pos => {
                    const active = pos === position;
                    return (
                      <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        title={pos.replace("-", " ")}
                        className="absolute"
                        style={spotStyle[pos]}
                      >
                        {active ? (
                          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                            {label}
                          </span>
                        ) : (
                          <span className="block w-5 h-5 rounded-full border-2 border-dashed border-gray-300 bg-white/70 hover:border-red-400 hover:bg-red-50 transition-colors" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 text-center">Click any spot to move the number · applies to every page</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Loading preview…</div>
            )}
          </SidebarWorkspace>
        </div>
      )}
    </ToolShell>
  );
}

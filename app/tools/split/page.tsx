"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, splitPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

// Convert a Set of split-after indices (0-based) to range string e.g. "1-2, 3-5, 6"
function splitPointsToRanges(splitAfter: Set<number>, totalPages: number): string {
  if (splitAfter.size === 0) return `1-${totalPages}`;
  const sorted = Array.from(splitAfter).sort((a, b) => a - b);
  const segments: string[] = [];
  let start = 1;
  for (const afterIdx of sorted) {
    const end = afterIdx + 1; // afterIdx is 0-based page index; +1 = 1-based page number
    segments.push(start === end ? `${start}` : `${start}-${end}`);
    start = end + 1;
  }
  if (start <= totalPages) {
    segments.push(start === totalPages ? `${start}` : `${start}-${totalPages}`);
  }
  return segments.join(", ");
}

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [splitAfter, setSplitAfter] = useState<Set<number>>(new Set()); // 0-based page indices
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [splitCount, setSplitCount] = useState(0);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    const t = await renderThumbnails(files[0], 0.45);
    setThumbs(t); setStatus("ready");
    setSplitAfter(new Set());
  }, []);

  const toggleSplit = (afterIdx: number) => {
    setSplitAfter(prev => {
      const next = new Set(prev);
      next.has(afterIdx) ? next.delete(afterIdx) : next.add(afterIdx);
      return next;
    });
  };

  const handleSplit = async () => {
    if (!file) return;
    logTool("split"); setStatus("processing");
    let mode: "every-page" | "range" = "range";
    let ranges: string | undefined;
    if (showAdvanced && rangeStr.trim()) {
      ranges = rangeStr;
    } else if (splitAfter.size === 0) {
      mode = "every-page";
    } else {
      ranges = splitPointsToRanges(splitAfter, thumbs.length);
    }
    const result = await splitPDF(file, mode, ranges);
    if (result.success && result.blobs) {
      result.blobs.forEach((blob, i) => downloadBlob(blob, result.filenames![i]));
      setSplitCount(result.blobs.length); setStatus("done");
    } else { setError(result.error ?? "Split failed."); setStatus("error"); }
  };

  const reset = () => {
    setFile(null); setThumbs([]); setSplitAfter(new Set());
    setRangeStr(""); setStatus("idle"); setError("");
  };

  const segmentCount = splitAfter.size + 1;

  return (
    <ToolShell name="Split PDF" description="Click between pages to add split markers, then split." icon="✂️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click between pages to split", "Download files"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(["ready", "processing", "done", "error"] as Status[]).includes(status) && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
            title="Split PDF"
            subtitle={`${file.name} · ${thumbs.length} pages · ${segmentCount} segment${segmentCount !== 1 ? "s" : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Splitting…" : status === "done" ? `✓ ${splitCount} files downloaded` : `Split into ${segmentCount} →`}
            onPrimary={status === "done" ? reset : handleSplit}
            primaryDisabled={status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />

          {/* Page strip with clickable gaps */}
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Click between pages to add or remove a split point</p>
            <div className="flex items-stretch gap-0 overflow-x-auto pb-3">
              {thumbs.map((url, i) => (
                <div key={i} className="flex items-stretch flex-shrink-0">
                  {/* Page thumbnail */}
                  <div className="flex flex-col items-center">
                    <div className="w-24 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <img src={url} alt={`Page ${i + 1}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-1">{i + 1}</div>
                  </div>

                  {/* Gap / splitter button between pages */}
                  {i < thumbs.length - 1 && (
                    <button
                      onClick={() => toggleSplit(i)}
                      title={splitAfter.has(i) ? "Remove split point" : "Add split point here"}
                      className={`w-10 self-stretch flex flex-col items-center justify-center gap-1 mx-1 rounded-lg border-2 transition-all group
                        ${splitAfter.has(i)
                          ? "border-red-400 bg-red-50 hover:bg-red-100"
                          : "border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50"}`}
                    >
                      {splitAfter.has(i) ? (
                        <>
                          <span className="text-red-500 text-base leading-none">✂</span>
                          <div className="w-0.5 flex-1 bg-red-400 rounded" />
                          <span className="text-red-500 text-base leading-none">✂</span>
                        </>
                      ) : (
                        <span className="text-gray-300 group-hover:text-red-400 text-base transition-colors">+</span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Advanced / range mode toggle */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <span>{showAdvanced ? "▾" : "▸"}</span> Advanced: custom ranges
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <input
                    value={rangeStr}
                    onChange={e => setRangeStr(e.target.value)}
                    placeholder="e.g. 1-3, 4-6, 7-end"
                    className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">Overrides visual splitters above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

"use client";
import { logTool } from "@/lib/logTool";
import { useCallback, useRef, useState } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import SidebarWorkspace from "@/components/pdf/SidebarWorkspace";
import { renderThumbnails, downloadBlob, parseRanges, type ToolResult } from "@/lib/pdf-tools";
import { cropPDF, autoCropMargins, type CropMargins } from "@/lib/tools/crop";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";
type ApplyMode = "all" | "current" | "custom";
type Edge = "top" | "right" | "bottom" | "left";

const clampFraction = (v: number) => Math.min(0.45, Math.max(0, v));

export default function CropPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [margins, setMargins] = useState<CropMargins>({ top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 });
  const [applyMode, setApplyMode] = useState<ApplyMode>("all");
  const [customRange, setCustomRange] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const dragEdges = useRef<Edge[] | null>(null);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    let t: string[];
    try {
      t = await renderThumbnails(files[0], 1.1);
    } catch (e) {
      setFile(null); setStatus("idle");
      setError(e instanceof Error ? e.message : "This file couldn't be opened.");
      return;
    }
    setThumbs(t); setStatus("ready");
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragEdges.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    setMargins((m) => {
      const next = { ...m };
      for (const edge of dragEdges.current!) {
        if (edge === "left") next.left = clampFraction(fx);
        if (edge === "right") next.right = clampFraction(1 - fx);
        if (edge === "top") next.top = clampFraction(fy);
        if (edge === "bottom") next.bottom = clampFraction(1 - fy);
      }
      return next;
    });
  };

  const startDrag = (edges: Edge[]) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragEdges.current = edges;
  };
  const endDrag = () => { dragEdges.current = null; };

  const setMarginPercent = (edge: Edge, pct: number) =>
    setMargins((m) => ({ ...m, [edge]: clampFraction((Number.isFinite(pct) ? pct : 0) / 100) }));

  const handleAutoDetect = async () => {
    if (!file) return;
    setAutoDetecting(true);
    try {
      const detected = await autoCropMargins(file);
      setMargins(detected);
    } catch {
      setError("Couldn't auto-detect margins for this page.");
    } finally {
      setAutoDetecting(false);
    }
  };

  const leftoverWidthPct = Math.round((1 - margins.left - margins.right) * 100);
  const leftoverHeightPct = Math.round((1 - margins.top - margins.bottom) * 100);
  const marginsInvalid = leftoverWidthPct < 5 || leftoverHeightPct < 5;

  let customPages: number[] | null = null;
  let customError = "";
  if (applyMode === "custom") {
    try {
      customPages = customRange.trim() ? parseRanges(customRange, thumbs.length).flat().map((i) => i + 1) : null;
      if (!customPages) customError = "Enter at least one page, e.g. 1-3, 5.";
    } catch (e) {
      customError = e instanceof Error ? e.message : "Invalid page range.";
    }
  }

  const handleApply = async () => {
    if (!file) return;
    const pages: "all" | number[] =
      applyMode === "all" ? "all" : applyMode === "current" ? [1] : (customPages as number[]);
    logTool("crop"); setStatus("processing");
    // Permanent crop re-renders pages via canvas (DOM-only), so it must run on the
    // main thread. Non-permanent crop is pure pdf-lib and can run in the worker.
    const result = permanent
      ? await cropPDF(file, { margins, pages, permanent })
      : await runInWorker<ToolResult>("cropPDF", file, { margins, pages, permanent });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_cropped.pdf"));
      setStatus("done");
    } else {
      setError(result.error ?? "Failed to crop PDF."); setStatus("error");
    }
  };

  const reset = () => {
    setFile(null); setThumbs([]); setStatus("idle"); setError("");
    setMargins({ top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 });
    setApplyMode("all"); setCustomRange(""); setPermanent(false);
  };

  const canApply = !marginsInvalid && !(applyMode === "custom" && (!!customError || !customPages));

  const sidebar = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Margins (%)</label>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "right", "bottom", "left"] as Edge[]).map((edge) => (
            <label key={edge} className="flex items-center gap-1.5 text-xs text-gray-600 capitalize">
              {edge}
              <input
                type="number" min={0} max={45} step={1}
                value={Math.round(margins[edge] * 100)}
                onChange={(e) => setMarginPercent(edge, parseFloat(e.target.value))}
                className="w-14 border border-gray-200 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:border-red-400"
              />
              %
            </label>
          ))}
        </div>
        {marginsInvalid && (
          <p className="text-xs text-red-600 mt-2">Leave at least 5% of the width and height.</p>
        )}
      </div>

      <button
        onClick={handleAutoDetect}
        disabled={autoDetecting}
        className="w-full py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-colors"
      >
        {autoDetecting ? "Detecting…" : "✨ Auto-detect margins"}
      </button>

      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Apply to</label>
        <div className="space-y-1.5">
          {([
            ["all", "All pages"],
            ["current", "This page only"],
            ["custom", "Custom pages"],
          ] as [ApplyMode, string][]).map(([mode, label]) => (
            <label key={mode} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="radio" name="applyMode" checked={applyMode === mode} onChange={() => setApplyMode(mode)} className="accent-red-600" />
              {label}
            </label>
          ))}
        </div>
        {applyMode === "custom" && (
          <div className="mt-2">
            <input
              value={customRange}
              onChange={(e) => setCustomRange(e.target.value)}
              placeholder="e.g. 1-3, 5"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
            />
            {customError && <p className="text-xs text-red-600 mt-1">{customError}</p>}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="accent-red-600 mt-0.5" />
          <span>
            <span className="font-semibold text-gray-700">Permanently remove hidden content</span>
            <br />
            Off by default: cropping only hides the area outside the box — it&apos;s still inside the file. Turning
            this on re-renders the affected pages as images (200 DPI), so the hidden part is truly gone, but text
            on those pages is no longer selectable.
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <ToolShell name="Crop PDF" description="Trim margins by dragging a crop box, or enter exact percentages."
      icon="✂️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M6 4v13a2 2 0 002 2h13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6h13a2 2 0 012 2v13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".5"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Drag the crop box", "Download result"]}>
      {!file && <UploadZone onFilesAdded={handleFile} disabled={status === "loading"} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M6 4v13a2 2 0 002 2h13" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
            title="Crop PDF" subtitle={`${file.name} · ${thumbs.length} pages`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Cropping…" : status === "done" ? "✓ Downloaded!" : "Crop PDF →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={!canApply || status === "processing"}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <SidebarWorkspace sidebar={sidebar}>
            {thumbs[0] ? (
              <div className="flex items-center justify-center">
                <div
                  ref={containerRef}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="relative inline-block max-w-full touch-none select-none"
                >
                  <img src={thumbs[0]} alt="Page 1 preview" className="max-h-[520px] max-w-full object-contain block" draggable={false} />
                  <div
                    className="absolute border-2 border-red-500"
                    style={{
                      top: `${margins.top * 100}%`,
                      left: `${margins.left * 100}%`,
                      right: `${margins.right * 100}%`,
                      bottom: `${margins.bottom * 100}%`,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                    }}
                  >
                    {/* Edge handles */}
                    <div onPointerDown={startDrag(["top"])} className="absolute -top-1.5 left-2 right-2 h-3 cursor-ns-resize" />
                    <div onPointerDown={startDrag(["bottom"])} className="absolute -bottom-1.5 left-2 right-2 h-3 cursor-ns-resize" />
                    <div onPointerDown={startDrag(["left"])} className="absolute -left-1.5 top-2 bottom-2 w-3 cursor-ew-resize" />
                    <div onPointerDown={startDrag(["right"])} className="absolute -right-1.5 top-2 bottom-2 w-3 cursor-ew-resize" />
                    {/* Corner handles */}
                    <div onPointerDown={startDrag(["top", "left"])} className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-500 border-2 border-white cursor-nwse-resize" />
                    <div onPointerDown={startDrag(["top", "right"])} className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 border-2 border-white cursor-nesw-resize" />
                    <div onPointerDown={startDrag(["bottom", "left"])} className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-red-500 border-2 border-white cursor-nesw-resize" />
                    <div onPointerDown={startDrag(["bottom", "right"])} className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-red-500 border-2 border-white cursor-nwse-resize" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Loading preview…</div>
            )}
            <p className="text-xs text-gray-400 text-center mt-3">
              The crop box is set from page 1 and applied to the pages you choose on the left.
            </p>
          </SidebarWorkspace>
        </div>
      )}
    </ToolShell>
  );
}

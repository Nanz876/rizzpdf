"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback, useEffect, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import SidebarWorkspace from "@/components/pdf/SidebarWorkspace";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, downloadBlob, type ToolResult } from "@/lib/pdf-tools";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";
type WmColor = "gray" | "red" | "blue";

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
  const [color, setColor] = useState<WmColor>("gray");
  const [fontSize, setFontSize] = useState(60);
  const [rotation, setRotation] = useState(30); // degrees counter-clockwise
  const [xFrac, setXFrac] = useState(0.5);
  const [yFrac, setYFrac] = useState(0.5);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragging = useRef(false);

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
    setPreviewUrl(t[0] ?? null); setStatus("ready");
  }, []);

  useEffect(() => {
    if (file && status === "ready") {
      renderThumbnails(file, 0.7).then(t => setPreviewUrl(t[0] ?? null)).catch(() => {});
    }
  }, [file, status]);

  // Keyboard nudge of the watermark position once a PDF is loaded (ignored while typing).
  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!e.key.startsWith("Arrow")) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.04 : 0.01;
      if (e.key === "ArrowLeft") setXFrac(v => Math.max(0, v - step));
      else if (e.key === "ArrowRight") setXFrac(v => Math.min(1, v + step));
      else if (e.key === "ArrowUp") setYFrac(v => Math.max(0, v - step));
      else if (e.key === "ArrowDown") setYFrac(v => Math.min(1, v + step));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

  const posFromPointer = (clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return;
    const r = img.getBoundingClientRect();
    setXFrac(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
    setYFrac(Math.max(0, Math.min(1, (clientY - r.top) / r.height)));
  };

  const onWmPtrDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
  };
  const onWmPtrMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    posFromPointer(e.clientX, e.clientY);
  };
  const onWmPtrUp = () => { dragging.current = false; };

  const handleApply = async () => {
    if (!file) return;
    logTool("watermark"); setStatus("processing");
    const result = await runInWorker<ToolResult>("watermarkPDF", file, { text, opacity, color, fontSize, rotation, xFrac, yFrac });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_watermarked.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Failed."); setStatus("error"); }
  };

  const reset = () => {
    setFile(null); setPreviewUrl(null); setStatus("idle"); setError("");
    setRotation(30); setXFrac(0.5); setYFrac(0.5);
  };

  const colorMap: Record<WmColor, string> = { gray: "#6b7280", red: "#dc2626", blue: "#3b82f6" };

  const sidebar = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Watermark text</label>
        <input value={text} onChange={e => setText(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Angle</label>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setRotation(30)}
            className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors
              ${rotation === 30 ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
            Diagonal
          </button>
          <button onClick={() => setRotation(0)}
            className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors
              ${rotation === 0 ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
            Straight
          </button>
        </div>
        <input type="range" min={-90} max={90} step={5} value={rotation}
          onChange={e => setRotation(parseInt(e.target.value))} className="w-full accent-red-600" />
        <div className="text-xs text-gray-400 text-right">{rotation}°</div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Color</label>
        <div className="flex gap-2">
          {(["gray", "red", "blue"] as WmColor[]).map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors capitalize
                ${color === c ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Opacity</label>
        <input type="range" min={0.1} max={0.8} step={0.05} value={opacity}
          onChange={e => setOpacity(parseFloat(e.target.value))}
          className="w-full accent-red-600" />
        <div className="text-xs text-gray-400 text-right">{Math.round(opacity * 100)}%</div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Font size</label>
        <input type="range" min={20} max={120} step={5} value={fontSize}
          onChange={e => setFontSize(parseInt(e.target.value))}
          className="w-full accent-red-600" />
        <div className="text-xs text-gray-400 text-right">{fontSize}px</div>
      </div>
      <button onClick={() => { setXFrac(0.5); setYFrac(0.5); }}
        className="w-full py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors">
        Center watermark
      </button>
    </div>
  );

  return (
    <ToolShell name="Watermark PDF" description="Add a text watermark — drag it anywhere, rotate it, set the opacity." icon="💧"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/><path d="M10 14l2-4 2 4M11 13h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Drag & style the watermark", "Download result"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Loading…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><path d="M7 12l3-4 3 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="Watermark PDF"
            subtitle={`${file.name}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Applying…" : status === "done" ? "✓ Downloaded!" : "Apply Watermark →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={!text.trim() || status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <SidebarWorkspace sidebar={sidebar}>
            {previewUrl ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative inline-block max-w-full select-none" style={{ touchAction: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={imgRef} src={previewUrl} alt="Preview" draggable={false}
                    className="max-h-96 object-contain rounded-lg shadow-sm" />
                  <span
                    onPointerDown={onWmPtrDown}
                    onPointerMove={onWmPtrMove}
                    onPointerUp={onWmPtrUp}
                    onPointerCancel={onWmPtrUp}
                    style={{
                      position: "absolute",
                      left: `${xFrac * 100}%`,
                      top: `${yFrac * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                      color: colorMap[color],
                      opacity,
                      fontSize,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      cursor: "grab",
                      userSelect: "none",
                      padding: "2px 4px",
                      outline: "1px dashed rgba(220,38,38,0.4)",
                    }}
                  >
                    {text || " "}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  Drag the watermark to position it · arrow keys to nudge · applies to every page
                </p>
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

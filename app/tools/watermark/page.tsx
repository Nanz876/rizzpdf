"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import SidebarWorkspace from "@/components/pdf/SidebarWorkspace";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import PaywallModal from "@/components/PaywallModal";
import { renderThumbnails, watermarkPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";
type WmPosition = "center" | "diagonal";
type WmColor = "gray" | "red" | "blue";

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
  const [position, setPosition] = useState<WmPosition>("diagonal");
  const [color, setColor] = useState<WmColor>("gray");
  const [fontSize, setFontSize] = useState(60);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) setIsPro(true);
  }, []);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    const t = await renderThumbnails(files[0], 0.7);
    setPreviewUrl(t[0] ?? null); setStatus("ready");
  }, []);

  useEffect(() => {
    if (file && status === "ready") {
      renderThumbnails(file, 0.7).then(t => setPreviewUrl(t[0] ?? null));
    }
  }, [file, status]);

  const handleApply = async () => {
    if (!file) return;
    if (!isPro) { setShowPaywall(true); return; }
    logTool("watermark"); setStatus("processing");
    const result = await watermarkPDF(file, { text, opacity, position, color, fontSize });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_watermarked.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setPreviewUrl(null); setStatus("idle"); setError(""); };

  const overlayStyle: React.CSSProperties = position === "diagonal"
    ? { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-30deg)" }
    : { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" };

  const colorMap: Record<WmColor, string> = { gray: "#6b7280", red: "#dc2626", blue: "#3b82f6" };

  const sidebar = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Watermark text</label>
        <input value={text} onChange={e => setText(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Position</label>
        <div className="flex gap-2">
          {(["diagonal", "center"] as WmPosition[]).map(p => (
            <button key={p} onClick={() => setPosition(p)}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors
                ${position === p ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
              {p === "diagonal" ? "Diagonal" : "Center"}
            </button>
          ))}
        </div>
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
    </div>
  );

  return (
    <ToolShell name="Watermark PDF" description="Add a text watermark to your PDF pages." icon="💧"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/><path d="M10 14l2-4 2 4M11 13h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Configure watermark", "Download result"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Loading…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><path d="M7 12l3-4 3 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="Watermark PDF" subtitle={file.name}
            onReset={reset}
            primaryLabel={status === "processing" ? "Applying…" : status === "done" ? "✓ Downloaded!" : "Apply Watermark →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={!text.trim() || status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <SidebarWorkspace sidebar={sidebar}>
            {previewUrl ? (
              <div className="relative inline-block max-w-full">
                <img src={previewUrl} alt="Preview" className="max-h-96 object-contain rounded-lg shadow-sm" />
                <div style={overlayStyle} className="pointer-events-none select-none">
                  <span style={{ color: colorMap[color], opacity, fontSize: Math.min(fontSize, 48), fontWeight: 700, whiteSpace: "nowrap" }}>
                    {text}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Loading preview…</div>
            )}
          </SidebarWorkspace>
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

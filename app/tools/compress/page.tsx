"use client";
import { useState, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import PaywallModal from "@/components/PaywallModal";
import { compressPDF, downloadBlob } from "@/lib/pdf-tools";

type Quality = "low" | "medium" | "high";
type Status = "idle" | "ready" | "processing" | "done" | "error";

const QUALITY_OPTS: { value: Quality; label: string; emoji: string; desc: string }[] = [
  { value: "low", label: "Extreme", emoji: "🔥", desc: "Smallest size, lower visual quality" },
  { value: "medium", label: "Recommended", emoji: "✅", desc: "Best balance of size and quality" },
  { value: "high", label: "Less", emoji: "🎯", desc: "Slight compression, best quality" },
];

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>("medium");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [origSize, setOrigSize] = useState(0);
  const [newSize, setNewSize] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) setIsPro(true);
  }, []);

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setOrigSize(files[0].size); setStatus("ready");
  }, []);

  const handleCompress = async () => {
    if (!file) return;
    if (!isPro) { setShowPaywall(true); return; }
    setStatus("processing");
    const result = await compressPDF(file, quality);
    if (result.success && result.blob) {
      setNewSize(result.blob.size);
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_compressed.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Compression failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); setOrigSize(0); setNewSize(0); };

  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell name="Compress PDF" description="Reduce PDF file size while maintaining readability." icon="📦"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.8"/><path d="M12 12l8-4M12 12v8M12 12L4 8" stroke="white" strokeWidth="1.5"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Choose quality level", "Download compressed file"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" stroke="white" strokeWidth="1.8"/></svg>}
            title="Compress PDF" subtitle={`${file.name} · ${fmt(origSize)}${status === "done" ? ` → ${fmt(newSize)}` : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Compressing…" : status === "done" ? "✓ Downloaded!" : "Compress PDF →"}
            onPrimary={status === "done" ? reset : handleCompress}
            primaryDisabled={status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          {status === "done" && newSize > 0 && (
            <div className="px-5 py-3 bg-green-50 border-b border-green-100 text-sm text-green-700 font-medium">
              Saved {Math.round((1 - newSize / origSize) * 100)}% · {fmt(origSize)} → {fmt(newSize)}
            </div>
          )}
          <PdfPreviewArea files={[file]} />
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quality Level</p>
            <div className="grid grid-cols-3 gap-3">
              {QUALITY_OPTS.map(opt => (
                <button key={opt.value} onClick={() => setQuality(opt.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all
                    ${quality === opt.value ? "border-red-500 bg-red-50" : "border-gray-200 bg-white hover:border-red-300"}`}>
                  <div className="text-2xl mb-2">{opt.emoji}</div>
                  <div className={`text-sm font-bold ${quality === opt.value ? "text-red-700" : "text-gray-900"}`}>{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
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

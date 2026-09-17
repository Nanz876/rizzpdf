"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, pdfToJpg, downloadResults } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

const DPI_OPTS: { value: number; label: string; desc: string }[] = [
  { value: 72, label: "Screen 72 DPI", desc: "Smallest files" },
  { value: 150, label: "Standard 150 DPI", desc: "Good for most uses" },
  { value: 300, label: "Print 300 DPI", desc: "Sharp prints, large files" },
];

export default function PdfToJpgPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dpi, setDpi] = useState(150);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    let t: string[];
    try {
      t = await renderThumbnails(files[0], 0.5);
    } catch (e) {
      setFile(null); setStatus("idle");
      setError(e instanceof Error ? e.message : "This file couldn't be opened.");
      return;
    }
    setThumbs(t);
    setSelected(new Set(t.map((_, i) => i + 1)));
    setStatus("ready");
  }, []);

  const togglePage = (pageNum: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(pageNum) ? s.delete(pageNum) : s.add(pageNum); return s; });

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({ dataUrl: url, pageNumber: i + 1 }));

  const handleConvert = async () => {
    if (!file || selected.size === 0) return;
    logTool("pdf-to-jpg"); setStatus("processing");
    const result = await pdfToJpg(file, dpi, [...selected]);
    if (result.success && result.blobs) {
      await downloadResults(result.blobs, result.filenames ?? [], file.name.replace(/\.pdf$/i, "_jpg.zip"));
      setStatus("done");
    } else { setError(result.error ?? "Conversion failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setSelected(new Set()); setStatus("idle"); setError(""); };

  return (
    <ToolShell name="PDF to JPG" description="Convert each PDF page to a JPG image." icon="🖼️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><circle cx="9" cy="9" r="2" fill="white" opacity=".6"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Select pages to convert", "Download JPG images"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><circle cx="8" cy="8" r="1.5" fill="white"/><path d="M3 15l4-4 3 3 2-2 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            title="PDF to JPG" subtitle={`${file.name} · ${thumbs.length} pages`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : `Convert ${selected.size} page${selected.size !== 1 ? "s" : ""} →`}
            onPrimary={status === "done" ? reset : handleConvert}
            primaryDisabled={selected.size === 0 || status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Resolution</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {DPI_OPTS.map(opt => (
                <button key={opt.value} onClick={() => { setDpi(opt.value); if (status === "done" || status === "error") setStatus("ready"); }}
                  className={`p-4 rounded-xl border-2 text-left transition-all
                    ${dpi === opt.value ? "border-red-500 bg-red-50" : "border-gray-200 bg-white hover:border-red-300"}`}>
                  <div className={`text-sm font-bold ${dpi === opt.value ? "text-red-700" : "text-gray-900"}`}>{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Click pages to select / deselect</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(thumbs.map((_, i) => i + 1)))} className="text-xs text-red-600 hover:underline">Select all</button>
                <span className="text-xs text-gray-300">·</span>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">Deselect all</button>
              </div>
            </div>
            <ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={3} />
          </div>
        </div>
      )}

    </ToolShell>
  );
}

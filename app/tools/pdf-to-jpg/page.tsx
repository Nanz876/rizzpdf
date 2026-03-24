"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import { renderThumbnails, pdfToJpg, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function PdfToJpgPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    const t = await renderThumbnails(files[0], 0.4);
    setThumbs(t);
    setSelected(new Set(t.map((_, i) => i + 1)));
    setStatus("ready");
  }, []);

  const togglePage = (pageNum: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(pageNum) ? s.delete(pageNum) : s.add(pageNum); return s; });

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({ dataUrl: url, pageNumber: i + 1 }));

  const handleConvert = async () => {
    if (!file) return;
    setStatus("processing");
    const result = await pdfToJpg(file);
    if (result.success && result.blobs) {
      result.blobs.forEach((blob, i) => {
        if (selected.has(i + 1)) {
          downloadBlob(blob, result.filenames?.[i] ?? `page_${i + 1}.jpg`);
        }
      });
      setStatus("done");
    } else { setError(result.error ?? "Conversion failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setSelected(new Set()); setStatus("idle"); setError(""); };

  return (
    <ToolShell name="PDF to JPG" description="Convert each PDF page to a JPG image." icon="🖼️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><circle cx="9" cy="9" r="2" fill="white" opacity=".6"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Select pages to convert", "Download JPG images"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
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
          <div className="p-5 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Click pages to select / deselect</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(thumbs.map((_, i) => i + 1)))} className="text-xs text-red-600 hover:underline">Select all</button>
                <span className="text-xs text-gray-300">·</span>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">Deselect all</button>
              </div>
            </div>
            <ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={4} />
          </div>
        </div>
      )}
    </ToolShell>
  );
}

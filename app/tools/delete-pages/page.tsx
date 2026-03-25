"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, deletePages, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function DeletePagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading"); setSelected(new Set());
    const t = await renderThumbnails(files[0], 0.5);
    setThumbs(t); setStatus("ready");
  }, []);

  const togglePage = (pageNum: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(pageNum) ? s.delete(pageNum) : s.add(pageNum); return s; });

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({ dataUrl: url, pageNumber: i + 1 }));

  const handleDelete = async () => {
    if (!file || selected.size === 0) return;
    logTool("delete-pages"); setStatus("processing");
    const result = await deletePages(file, [...selected]);
    if (result.success && result.blob) {
      downloadBlob(result.blob, file.name.replace(/\.pdf$/i, "_deleted.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setSelected(new Set()); setStatus("idle"); setError(""); };

  return (
    <ToolShell name="Delete Pages" description="Click pages to select them, then delete." icon="🗑️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click pages to select", "Delete & download"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
            title="Delete Pages"
            subtitle={`${file.name} · ${thumbs.length} pages${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Deleting…" : status === "done" ? "✓ Downloaded!" : `Delete ${selected.size} page${selected.size !== 1 ? "s" : ""}`}
            onPrimary={status === "done" ? reset : handleDelete}
            primaryDisabled={selected.size === 0 || status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Click a page to select it for deletion</p>
            <ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={3} />
          </div>
        </div>
      )}
    </ToolShell>
  );
}

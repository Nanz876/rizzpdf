"use client";
import { useState, useCallback, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { renderThumbnails, mergePDFs, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [allThumbs, setAllThumbs] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    setLoading(true);
    const newThumbs = await Promise.all(newFiles.map(f => renderThumbnails(f, 0.35)));
    setFiles(prev => [...prev, ...newFiles]);
    setAllThumbs(prev => [...prev, ...newThumbs]);
    setLoading(false);
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setAllThumbs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setStatus("processing");
    const result = await mergePDFs(files);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? "merged.pdf");
      setStatus("done");
    } else { setError(result.error ?? "Merge failed."); setStatus("error"); }
  };

  const reset = () => { setFiles([]); setAllThumbs([]); setStatus("idle"); setError(""); };

  const totalPages = allThumbs.reduce((sum, t) => sum + t.length, 0);

  if (files.length === 0) {
    return (
      <ToolShell name="Merge PDF" description="Combine multiple PDFs into one document." icon="🔗"
        svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="rgba(255,255,255,0.3)"/><path d="M13 6h7v12h-7V6z" fill="rgba(255,255,255,0.6)"/><path d="M10 12h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}
        steps={["Upload your PDFs", "Arrange order", "Download merged file"]}>
        <UploadZone onFilesAdded={addFiles} />
      </ToolShell>
    );
  }

  return (
    <ToolShell name="Merge PDF" description="Combine multiple PDFs into one document." icon="🔗"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="rgba(255,255,255,0.3)"/><path d="M13 6h7v12h-7V6z" fill="rgba(255,255,255,0.6)"/><path d="M10 12h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <WorkspaceBar
          icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="white" opacity=".5"/><path d="M13 6h7v12h-7V6z" fill="white"/><path d="M10 12h4" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
          title="Merge PDF" subtitle={`${files.length} files · ${totalPages} pages`}
          onReset={reset}
          secondaryLabel="+ Add more files" onSecondary={() => fileInputRef.current?.click()}
          primaryLabel={status === "processing" ? "Merging…" : status === "done" ? "✓ Downloaded!" : `Merge ${files.length} PDFs →`}
          onPrimary={status === "done" ? reset : handleMerge}
          primaryDisabled={files.length < 2 || status === "processing"} />
        <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={e => { if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ""; } }} />
        {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
        {loading && <p className="text-sm text-gray-400 px-5 py-2">Rendering thumbnails…</p>}
        <div className="p-5 bg-gray-50 space-y-4">
          {files.map((f, fi) => (
            <div key={fi}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{fi + 1}</span>
                  <span className="text-sm font-semibold text-gray-700">{f.name}</span>
                  <span className="text-xs text-gray-400">· {allThumbs[fi]?.length ?? 0} pages</span>
                </div>
                <button onClick={() => removeFile(fi)} className="text-xs text-gray-300 hover:text-red-500 transition-colors">✕ Remove</button>
              </div>
              {allThumbs[fi] && allThumbs[fi].length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allThumbs[fi].map((url, pi) => (
                    <div key={pi} className="flex-shrink-0 w-16">
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <img src={url} alt={`Page ${pi + 1}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                      </div>
                      <div className="text-center text-xs text-gray-400 mt-0.5">{pi + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              {fi < files.length - 1 && <div className="mt-4 border-t border-dashed border-gray-300" />}
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}

"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import Link from "next/link";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, downloadBlob, type ToolResult } from "@/lib/pdf-tools";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function ExtractPagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading"); setSelected(new Set());
    let t: string[];
    try {
      t = await renderThumbnails(files[0], 0.5);
    } catch (e) {
      setFile(null); setStatus("idle");
      setError(e instanceof Error ? e.message : "This file couldn't be opened.");
      return;
    }
    setThumbs(t); setStatus("ready");
  }, []);

  const togglePage = (pageNum: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(pageNum) ? s.delete(pageNum) : s.add(pageNum); return s; });

  const selectAll = () => setSelected(new Set(thumbs.map((_, i) => i + 1)));
  const clearAll = () => setSelected(new Set());

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({ dataUrl: url, pageNumber: i + 1 }));

  const handleExtract = async () => {
    if (!file || selected.size === 0) return;
    logTool("extract-pages"); setStatus("processing");
    // Extract in page order, regardless of click order.
    const ordered = [...selected].sort((a, b) => a - b);
    const result = await runInWorker<ToolResult>("extractPages", file, ordered);
    if (result.success && result.blob) {
      downloadBlob(result.blob, file.name.replace(/\.pdf$/i, "_extracted.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setSelected(new Set()); setStatus("idle"); setError(""); };

  return (
    <ToolShell name="Extract Pages" description="Pick the pages you want to keep, then pull them into a new PDF." icon="📄"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M8 4h6l4 4v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/><path d="M14 4v4h4" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9.5 13.5h5M12 11v5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click the pages to keep", "Extract & download"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M8 4h6l4 4v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/><path d="M14 4v4h4" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/></svg>}
            title="Extract Pages"
            subtitle={`${file.name} · ${thumbs.length} pages${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Extracting…" : status === "done" ? "✓ Downloaded!" : `Extract ${selected.size} page${selected.size !== 1 ? "s" : ""}`}
            onPrimary={status === "done" ? reset : handleExtract}
            primaryDisabled={selected.size === 0 || status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Click a page to add it to the new PDF</p>
              <div className="flex gap-3 text-xs">
                <button onClick={selectAll} className="text-gray-500 hover:text-red-600 font-medium">Select all</button>
                <button onClick={clearAll} className="text-gray-500 hover:text-red-600 font-medium">Clear</button>
              </div>
            </div>
            <ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={3} />
          </div>
        </div>
      )}

      {/* SEO copy block */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-2 space-y-4 text-sm text-gray-600 leading-relaxed">
        <h2 className="text-base font-bold text-gray-900">How to extract pages from a PDF</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Upload your PDF using the drop zone above</li>
          <li>Page thumbnails appear — click each page you want to keep</li>
          <li>Click <strong>Extract</strong> to download a new PDF with just those pages, in order</li>
        </ol>
        <p>
          Everything runs in your browser. Your file is never uploaded to a server, so it&rsquo;s safe for confidential
          documents. Works on Windows, Mac, iPhone and Android with nothing to install.
        </p>
        <p>
          Want to throw pages away instead of keeping them? Use{" "}
          <Link href="/tools/delete-pages" className="text-red-600 hover:underline font-medium">Delete Pages</Link>.
          To break one PDF into several files, try{" "}
          <Link href="/tools/split" className="text-red-600 hover:underline font-medium">Split PDF</Link>.
        </p>
      </div>
    </ToolShell>
  );
}

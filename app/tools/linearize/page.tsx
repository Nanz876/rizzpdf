"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { linearizePDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function LinearizePage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleRun = async () => {
    if (!file) return;
    logTool("linearize"); setStatus("processing"); setError("");
    const result = await linearizePDF(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_web.pdf"));
      setStatus("done");
    } else {
      setError(result.error ?? "Optimization failed.");
      setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="Fast Web View"
      description="Linearize a PDF so the first page shows instantly when opened over the web, before the whole file finishes downloading. Runs entirely in your browser."
      icon="⚡"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click Optimize", "Download web-ready file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" fill="white"/></svg>}
            title="Fast Web View"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Optimizing…" : status === "done" ? "✓ Downloaded!" : "Optimize & Download →"}
            onPrimary={status === "done" ? reset : handleRun}
            primaryDisabled={status === "processing"}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p>Linearization (also called &ldquo;Fast Web View&rdquo;) reorders the file so a browser or viewer can show page one while the rest streams in. The file may end up slightly larger — that&rsquo;s the trade-off for instant first-page display.</p>
            </div>
            {status === "done" && (
              <p className="text-sm text-green-600 font-semibold">✓ Web-optimized PDF downloaded</p>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

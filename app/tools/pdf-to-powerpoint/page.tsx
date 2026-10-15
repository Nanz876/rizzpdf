"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { downloadBlob } from "@/lib/pdf-tools";
import { pdfToPptx } from "@/lib/tools/pdf-to-pptx";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function PdfToPowerPointPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    logTool("pdf-to-powerpoint"); setStatus("processing"); setError("");
    const result = await pdfToPptx(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, ".pptx"));
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed.");
      setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="PDF to PowerPoint"
      description="Turn each PDF page into a slide in a PowerPoint (.pptx) deck. Runs entirely in your browser — the file never leaves your device."
      icon="📽️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5" stroke="white" strokeWidth="1.8"/><path d="M8 20h8M12 16v4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click Convert", "Download .pptx file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5" stroke="white" strokeWidth="1.5"/><path d="M8 20h8M12 16v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="PDF to PowerPoint"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : "Convert & Download →"}
            onPrimary={status === "done" ? reset : handleConvert}
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
              <p>Each page is rendered to a high-resolution image and placed full-bleed on its own slide, so the deck looks exactly like the PDF. Slides hold a picture of each page — not re-flowed editable text boxes.</p>
            </div>
            {status === "done" && (
              <p className="text-sm text-green-600 font-semibold">✓ PowerPoint deck downloaded</p>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

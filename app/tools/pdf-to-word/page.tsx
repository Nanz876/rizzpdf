"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { pdfToWord, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function PdfToWordPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setStatus("processing"); setError("");
    const result = await pdfToWord(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, ".docx"));
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed."); setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="PDF to Word"
      description="Extract text from your PDF and download it as an editable .docx Word document. Runs entirely in your browser."
      icon="📝"
      steps={file ? undefined : ["Upload your PDF", "Click Convert", "Download .docx file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5"/>
                <path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            title="PDF to Word"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : "Convert & Download →"}
            onPrimary={status === "done" ? reset : handleConvert}
            primaryDisabled={status === "processing"}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <div className="p-6 bg-gray-50 space-y-3">
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p>Text and basic formatting are extracted. Complex layouts, images, and tables may not convert perfectly — this is a browser limitation.</p>
            </div>
            {status === "done" && (
              <p className="text-sm text-green-600 font-semibold">✓ Word document downloaded</p>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

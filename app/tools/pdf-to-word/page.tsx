"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { downloadBlob } from "@/lib/pdf-tools";

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
    logTool("pdf-to-word"); setStatus("processing"); setError("");
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/pdf-to-word", { method: "POST", body: form });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const blob = await res.blob();
      downloadBlob(blob, file.name.replace(/\.pdf$/i, ".docx"));
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed.");
      setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="PDF to Word"
      description="Convert your PDF to an editable Word document. Processed on our secure server and deleted immediately."
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
          <PdfPreviewArea files={[file]} />
          <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p>Your file is sent to our secure server for conversion and permanently deleted within 60 seconds. Never stored.</p>
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

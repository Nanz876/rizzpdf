"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { downloadBlob } from "@/lib/pdf-tools";
import { pdfToExcel } from "@/lib/tools/pdf-to-excel";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function PdfToExcelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    logTool("pdf-to-excel"); setStatus("processing"); setError("");
    const result = await pdfToExcel(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, ".xlsx"));
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
      name="PDF to Excel"
      description="Pull tables and data out of a PDF into an editable Excel (.xlsx) workbook. Runs entirely in your browser — the file never leaves your device."
      icon="📊"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" stroke="white" strokeWidth="1.8"/><path d="M4 9h16M4 15h16M10 3v18" stroke="white" strokeWidth="1.5"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click Convert", "Download .xlsx file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" stroke="white" strokeWidth="1.5"/><path d="M4 9h16M4 15h16M10 3v18" stroke="white" strokeWidth="1.3"/></svg>}
            title="PDF to Excel"
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
              <p>Conversion happens in your browser. Each page becomes a sheet; rows that line up into columns are rebuilt as a table, and numbers, currency and percentages come through as real values. Scanned PDFs need OCR first.</p>
            </div>
            {status === "done" && (
              <p className="text-sm text-green-600 font-semibold">✓ Excel workbook downloaded</p>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { repairPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "ready" | "processing" | "done" | "error";
type Warning = string | null;

export default function RepairPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<Warning>(null);

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready");
  }, []);

  const handleRepair = async () => {
    if (!file) return;
    logTool("repair"); setStatus("processing");
    const result = await repairPDF(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_repaired.pdf"));
      if (result.warning) setWarning(result.warning);
      setStatus("done");
    } else { setError(result.error ?? "Repair failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); setWarning(null); };

  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell name="Repair PDF" description="Recover corrupted or damaged PDFs. Lightly damaged files are repaired with structure intact. Severely damaged files are rebuilt from rendered pages." icon="🔧"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 4l1.4 4.2H18l-3.7 2.7 1.4 4.2L12 12.4l-3.7 2.7 1.4-4.2L6 8.2h4.6L12 4z" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
      steps={file ? undefined : ["Upload damaged PDF", "Click repair", "Download fixed file"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 4l1.2 3.6H18l-3.2 2.3 1.2 3.6L12 11.2l-3.2 2.3 1.2-3.6L6.8 7.6H12z" fill="white"/></svg>}
            title="Repair PDF" subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Repairing…" : status === "done" ? "✓ Downloaded!" : "Repair PDF →"}
            onPrimary={status === "done" ? reset : handleRepair}
            primaryDisabled={status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          {warning && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-700 font-medium">
              ⚠️ {warning}
            </div>
          )}
          <PdfPreviewArea files={[file]} />
          <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                <path d="M12 4l1.4 4.2H18l-3.7 2.7 1.4 4.2L12 12.4l-3.7 2.7 1.4-4.2L6 8.2h4.6L12 4z" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-400">{fmt(file.size)}</p>
            </div>
            {status === "done" && <p className="text-sm text-green-600 font-semibold">✓ PDF repaired and downloaded</p>}
            {status === "error" && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

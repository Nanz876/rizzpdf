"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { repairPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

export default function RepairPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesAdded = useCallback((files: File[]) => {
    setFile(files[0]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const handleRepair = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMsg("");

    const result = await repairPDF(file);

    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Could not repair PDF.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setErrorMsg("");
  };

  return (
    <ToolShell
      name="Repair PDF"
      description="Re-serialize your PDF to fix broken references, missing objects, and formatting issues."
      icon="🔧"
    >
      <div className="space-y-5">
        <UploadZone onFilesAdded={handleFilesAdded} disabled={status === "processing"} />

        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
              <button onClick={reset} className="text-sm text-gray-400 hover:text-red-500 transition-colors ml-4">
                Remove
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              This tool re-saves your PDF from scratch, fixing broken cross-references, corrupted
              object streams, and minor structural errors. Works best on PDFs that open but display
              incorrectly or cannot be edited.
            </div>
          </div>
        )}

        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">Repaired PDF downloaded!</p>
            <button onClick={reset} className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 transition-colors">
              Repair another PDF
            </button>
          </div>
        ) : (
          <>
            {status === "error" && <p className="text-center text-red-500 text-sm">{errorMsg}</p>}
            <button
              onClick={handleRepair}
              disabled={!file || status === "processing"}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing" ? "Repairing..." : "Repair PDF"}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

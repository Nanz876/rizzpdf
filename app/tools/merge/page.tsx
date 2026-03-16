"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { mergePDFs, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setStatus("idle");
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setFiles((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setStatus("processing");
    setErrorMsg("");

    const result = await mergePDFs(files);

    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Merge failed.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFiles([]);
    setStatus("idle");
    setErrorMsg("");
  };

  return (
    <ToolShell
      name="Merge PDF"
      description="Combine multiple PDF files into a single document."
      icon="🔗"
    >
      <div className="space-y-5">
        {/* Upload zone */}
        <UploadZone onFilesAdded={handleFilesAdded} disabled={status === "processing"} />

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm">Files to merge</h2>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                {files.length} {files.length === 1 ? "file" : "files"}
              </span>
            </div>

            <div>
              {files.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Order arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors text-xs leading-none"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(i)}
                        disabled={i === files.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors text-xs leading-none"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFile(i)}
                    className="text-sm text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-4"
                    aria-label="Remove file"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action / result */}
        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">
              Merged successfully! Download started automatically.
            </p>
            <button onClick={reset} className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              Merge more PDFs
            </button>
          </div>
        ) : (
          <>
            {status === "error" && (
              <p className="text-center text-red-500 text-sm">{errorMsg}</p>
            )}
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || status === "processing"}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing"
                ? "Merging..."
                : files.length < 2
                ? "Add at least 2 PDFs"
                : `Merge ${files.length} PDFs`}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

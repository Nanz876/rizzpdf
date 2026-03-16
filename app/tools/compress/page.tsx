"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { compressPDF, downloadBlob } from "@/lib/pdf-tools";

type Quality = "low" | "medium" | "high";
type Status = "idle" | "processing" | "done" | "error";

const QUALITY_OPTIONS: { value: Quality; label: string; note: string }[] = [
  { value: "low", label: "Low", note: "Smallest size" },
  { value: "medium", label: "Medium", note: "Balanced" },
  { value: "high", label: "High", note: "Best quality" },
];

const QUALITY_NOTES: Record<Quality, string> = {
  low: "Maximum compression — ideal for sharing or emailing.",
  medium: "Good balance between file size and visual quality.",
  high: "Minimal compression — preserves fine detail and text clarity.",
};

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>("medium");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFilesAdded = useCallback((files: File[]) => {
    setFile(files[0]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCompress = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMsg("");

    const result = await compressPDF(file, quality);

    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Compression failed.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setQuality("medium");
    setStatus("idle");
    setErrorMsg("");
  };

  return (
    <ToolShell
      name="Compress PDF"
      description="Reduce your PDF file size without losing too much quality."
      icon="📦"
    >
      <div className="space-y-5">
        {/* Upload zone */}
        <UploadZone onFilesAdded={handleFilesAdded} disabled={status === "processing"} />

        {/* File info + quality selector */}
        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            {/* Selected file with size */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">
                  Original size: <span className="font-semibold text-gray-600">{formatSize(file.size)}</span>
                </p>
              </div>
              <button
                onClick={reset}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-4"
              >
                Remove
              </button>
            </div>

            {/* Quality selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Compression quality</p>
              <div className="flex gap-3">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setQuality(opt.value)}
                    className={`flex-1 py-3 px-3 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                      quality === opt.value
                        ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-700"
                    }`}
                  >
                    <span className="block">{opt.label}</span>
                    <span className={`block text-xs font-normal mt-0.5 ${quality === opt.value ? "text-purple-100" : "text-gray-400"}`}>
                      {opt.note}
                    </span>
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-3">{QUALITY_NOTES[quality]}</p>
            </div>
          </div>
        )}

        {/* Result / action */}
        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">
              Compressed successfully! Download started automatically.
            </p>
            <p className="text-center text-xs text-gray-400">{QUALITY_NOTES[quality]}</p>
            <button onClick={reset} className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              Compress another PDF
            </button>
          </div>
        ) : (
          <>
            {status === "error" && (
              <p className="text-center text-red-500 text-sm">{errorMsg}</p>
            )}
            <button
              onClick={handleCompress}
              disabled={!file || status === "processing"}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing" ? "Compressing..." : "Compress PDF"}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

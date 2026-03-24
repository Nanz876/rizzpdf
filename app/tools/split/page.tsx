"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { splitPDF, downloadBlob } from "@/lib/pdf-tools";

type Mode = "every-page" | "range";
type Status = "idle" | "processing" | "done" | "error";

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("every-page");
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [splitCount, setSplitCount] = useState(0);

  const handleFilesAdded = useCallback((files: File[]) => {
    setFile(files[0]);
    setStatus("idle");
    setErrorMsg("");
    setSplitCount(0);
  }, []);

  const handleSplit = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMsg("");

    const result = await splitPDF(file, mode, mode === "range" ? rangeStr : undefined);

    if (result.success && result.blobs && result.filenames) {
      result.blobs.forEach((blob, i) => {
        downloadBlob(blob, result.filenames![i]);
      });
      setSplitCount(result.blobs.length);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Split failed.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setMode("every-page");
    setRangeStr("");
    setStatus("idle");
    setErrorMsg("");
    setSplitCount(0);
  };

  const canSplit = file !== null && (mode === "every-page" || rangeStr.trim().length > 0);

  return (
    <ToolShell
      name="Split PDF"
      description="Split a PDF into multiple files by page or custom ranges."
      icon="✂️"
    >
      <div className="space-y-5">
        {/* Upload zone */}
        <UploadZone onFilesAdded={handleFilesAdded} disabled={status === "processing"} />

        {/* File info + options */}
        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            {/* Selected file */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={reset}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-4"
              >
                Remove
              </button>
            </div>

            {/* Mode selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Split mode</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="mode"
                    value="every-page"
                    checked={mode === "every-page"}
                    onChange={() => setMode("every-page")}
                    className="accent-red-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-red-700 transition-colors">
                      Split every page
                    </p>
                    <p className="text-xs text-gray-400">Creates one file per page</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="mode"
                    value="range"
                    checked={mode === "range"}
                    onChange={() => setMode("range")}
                    className="accent-red-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-red-700 transition-colors">
                      Custom ranges
                    </p>
                    <p className="text-xs text-gray-400">Specify page groups to extract</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Range input */}
            {mode === "range" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Page ranges
                </label>
                <input
                  type="text"
                  value={rangeStr}
                  onChange={(e) => setRangeStr(e.target.value)}
                  placeholder="e.g. 1-3, 5, 7-9"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Each group becomes a separate file. Example: <span className="font-mono">1-3, 5, 7-9</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Result / action */}
        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">
              Split into {splitCount} {splitCount === 1 ? "file" : "files"} — downloads started automatically.
            </p>
            <button onClick={reset} className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
              Split another PDF
            </button>
          </div>
        ) : (
          <>
            {status === "error" && (
              <p className="text-center text-red-500 text-sm">{errorMsg}</p>
            )}
            <button
              onClick={handleSplit}
              disabled={!canSplit || status === "processing"}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing" ? "Splitting..." : "Split PDF"}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

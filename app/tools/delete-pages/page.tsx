"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { deletePages, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

function parsePageList(input: string): number[] {
  const pages = new Set<number>();
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = parseInt(range[1]);
      const end = parseInt(range[2]);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const n = parseInt(part);
      if (!isNaN(n) && n > 0) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export default function DeletePagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rangeInput, setRangeInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const parsedPages = parsePageList(rangeInput);

  const handleFilesAdded = useCallback((files: File[]) => {
    setFile(files[0]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const handleDelete = async () => {
    if (!file || parsedPages.length === 0) return;
    setStatus("processing");
    setErrorMsg("");

    const result = await deletePages(file, parsedPages);

    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Failed to delete pages.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setRangeInput("");
    setStatus("idle");
    setErrorMsg("");
  };

  return (
    <ToolShell
      name="Delete Pages"
      description="Remove specific pages from your PDF and download the result."
      icon="🗑️"
    >
      <div className="space-y-5">
        <UploadZone onFilesAdded={handleFilesAdded} disabled={status === "processing"} />

        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
              <button onClick={reset} className="text-sm text-gray-400 hover:text-red-500 transition-colors ml-4">
                Remove
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pages to delete
              </label>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => { setRangeInput(e.target.value); setStatus("idle"); }}
                placeholder="e.g. 1, 3, 5-7, 10"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">
                Separate pages with commas. Use hyphens for ranges (e.g., 5-7).
              </p>
            </div>

            {parsedPages.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-700">
                  Will delete <span className="font-bold">{parsedPages.length} page{parsedPages.length !== 1 ? "s" : ""}</span>:{" "}
                  <span className="font-mono">{parsedPages.join(", ")}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">
              Done! {parsedPages.length} page{parsedPages.length !== 1 ? "s" : ""} deleted and downloaded.
            </p>
            <button onClick={reset} className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 transition-colors">
              Edit another PDF
            </button>
          </div>
        ) : (
          <>
            {status === "error" && <p className="text-center text-red-500 text-sm">{errorMsg}</p>}
            <button
              onClick={handleDelete}
              disabled={!file || parsedPages.length === 0 || status === "processing"}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing" ? "Deleting pages..." : `Delete ${parsedPages.length > 0 ? parsedPages.length + " page" + (parsedPages.length !== 1 ? "s" : "") : "pages"}`}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

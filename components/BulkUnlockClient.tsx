"use client";

import { useState, useRef } from "react";
import { unlockPDF } from "@/lib/pdf-unlock";

interface CsvRow {
  filename: string;
  password: string;
}

interface FileResult {
  filename: string;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  blob?: Blob;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  // Skip header row
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    return {
      filename: parts[0]?.trim() ?? "",
      password: parts.slice(1).join(",").trim(),
    };
  }).filter((r) => r.filename);
}

export default function BulkUnlockClient() {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FileResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const handleCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target?.result as string);
      setCsvRows(rows);
      setResults([]);
      setDone(false);
    };
    reader.readAsText(file);
  };

  const handlePdfs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []);
    setFiles(fileList);
    setResults([]);
    setDone(false);
  };

  const handleRun = async () => {
    if (!csvRows.length || !files.length) return;
    setRunning(true);
    setDone(false);

    const initial: FileResult[] = csvRows.map((r) => ({
      filename: r.filename,
      status: "pending",
    }));
    setResults(initial);

    const resultMap = [...initial];

    for (let i = 0; i < csvRows.length; i++) {
      const { filename, password } = csvRows[i];
      const matchedFile = files.find(
        (f) => f.name.toLowerCase() === filename.toLowerCase()
      );

      resultMap[i] = { filename, status: "processing" };
      setResults([...resultMap]);

      if (!matchedFile) {
        resultMap[i] = { filename, status: "error", error: "File not found in upload" };
        setResults([...resultMap]);
        continue;
      }

      const result = await unlockPDF(matchedFile, password);
      if (result.success && result.blob) {
        resultMap[i] = { filename, status: "done", blob: result.blob };
        // Log to history
        fetch("/api/unlocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: result.filename }),
        }).catch(() => {});
      } else {
        resultMap[i] = { filename, status: "error", error: result.error };
      }
      setResults([...resultMap]);
    }

    setRunning(false);
    setDone(true);
  };

  const handleDownloadAll = async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    results.forEach((r) => {
      if (r.status === "done" && r.blob) {
        const outName = r.filename.replace(/\.pdf$/i, "_unlocked.pdf");
        zip.file(outName, r.blob);
      }
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rizzpdf_unlocked.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const successCount = results.filter((r) => r.status === "done").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-5">
      {/* Step 1: CSV */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">
          Step 1 — Upload your CSV
        </h3>
        <input
          ref={csvRef}
          type="file"
          accept=".csv"
          onChange={handleCsv}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
        />
        {csvRows.length > 0 && (
          <p className="text-sm text-green-600 mt-2 font-medium">
            ✓ {csvRows.length} file{csvRows.length !== 1 ? "s" : ""} found in CSV
          </p>
        )}
      </div>

      {/* Step 2: PDFs */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">
          Step 2 — Upload your PDF files
        </h3>
        <input
          ref={pdfRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handlePdfs}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
        />
        {files.length > 0 && (
          <p className="text-sm text-green-600 mt-2 font-medium">
            ✓ {files.length} PDF{files.length !== 1 ? "s" : ""} uploaded
          </p>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || !csvRows.length || !files.length}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {running ? "Unlocking…" : "Unlock All PDFs"}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">Progress</span>
            {done && (
              <span className="text-xs text-gray-500">
                {successCount} unlocked · {errorCount} failed
              </span>
            )}
          </div>
          <ul className="divide-y divide-gray-50">
            {results.map((r, i) => (
              <li key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">
                    {r.status === "done" ? "✅" :
                     r.status === "error" ? "❌" :
                     r.status === "processing" ? "⏳" : "⏸️"}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{r.filename}</span>
                </div>
                {r.status === "error" && (
                  <span className="text-xs text-red-500 shrink-0">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Download ZIP */}
      {done && successCount > 0 && (
        <button
          onClick={handleDownloadAll}
          className="w-full border-2 border-purple-600 text-purple-600 py-3 rounded-xl font-bold text-sm hover:bg-purple-50 transition-colors"
        >
          ⬇️ Download {successCount} unlocked PDF{successCount !== 1 ? "s" : ""} as ZIP
        </button>
      )}
    </div>
  );
}

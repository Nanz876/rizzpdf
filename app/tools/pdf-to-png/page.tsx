"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { pdfToPng, downloadBlob } from "@/lib/pdf-tools";

type Dpi = 72 | 150 | 300;
type Status = "idle" | "processing" | "done" | "error";

const DPI_OPTIONS: { value: Dpi; label: string; note: string }[] = [
  { value: 72, label: "72 DPI", note: "Web / preview" },
  { value: 150, label: "150 DPI", note: "Standard" },
  { value: 300, label: "300 DPI", note: "High quality" },
];

export default function PdfToPngPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dpi, setDpi] = useState<Dpi>(150);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadedCount, setDownloadedCount] = useState(0);

  const handleFilesAdded = useCallback((files: File[]) => {
    setFile(files[0]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMsg("");

    const result = await pdfToPng(file, dpi);

    if (result.success && result.blobs && result.filenames) {
      for (let i = 0; i < result.blobs.length; i++) {
        await new Promise((r) => setTimeout(r, 150));
        downloadBlob(result.blobs![i], result.filenames![i]);
      }
      setDownloadedCount(result.blobs.length);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Conversion failed.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setDpi(150);
    setStatus("idle");
    setErrorMsg("");
    setDownloadedCount(0);
  };

  return (
    <ToolShell
      name="PDF to PNG"
      description="Convert each PDF page to a high-quality lossless PNG image."
      icon="🎨"
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
              <p className="text-sm font-semibold text-gray-700 mb-3">Resolution</p>
              <div className="flex gap-3">
                {DPI_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDpi(opt.value)}
                    className={`flex-1 py-3 px-3 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                      dpi === opt.value
                        ? "bg-red-600 border-red-600 text-white shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-700"
                    }`}
                  >
                    <span className="block">{opt.label}</span>
                    <span className={`block text-xs font-normal mt-0.5 ${dpi === opt.value ? "text-red-100" : "text-gray-400"}`}>
                      {opt.note}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">PNG is lossless — all detail is perfectly preserved.</p>
            </div>
          </div>
        )}

        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">
              Downloaded {downloadedCount} PNG image{downloadedCount !== 1 ? "s" : ""}!
            </p>
            <button onClick={reset} className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 transition-colors">
              Convert another PDF
            </button>
          </div>
        ) : (
          <>
            {status === "error" && <p className="text-center text-red-500 text-sm">{errorMsg}</p>}
            <button
              onClick={handleConvert}
              disabled={!file || status === "processing"}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing" ? "Converting..." : "Convert to PNG"}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

"use client";

import { useState } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { downloadBlob, pdfToJpg } from "@/lib/pdf-tools";

type DpiOption = 72 | 150 | 300;

export default function PdfToJpgPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dpi, setDpi] = useState<DpiOption>(150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadedCount, setDownloadedCount] = useState<number | null>(null);

  async function handleConvert() {
    if (!file) return;
    setLoading(true);
    setError("");
    setDownloadedCount(null);

    try {
      const result = await pdfToJpg(file, dpi);
      if (!result.success || !result.blobs || !result.filenames) {
        setError(result.error ?? "Conversion failed.");
      } else {
        for (let i = 0; i < result.blobs.length; i++) {
          await new Promise((r) => setTimeout(r, 150));
          downloadBlob(result.blobs![i], result.filenames![i]);
        }
        setDownloadedCount(result.blobs.length);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const dpiOptions: { label: string; value: DpiOption }[] = [
    { label: "72 DPI", value: 72 },
    { label: "150 DPI", value: 150 },
    { label: "300 DPI", value: 300 },
  ];

  return (
    <ToolShell name="PDF to JPG" icon="🖼️" description="Convert every page of your PDF into a JPG image.">
      <div className="space-y-4">
        <UploadZone onFilesAdded={(files) => { setFile(files[0]); setDownloadedCount(null); setError(""); }} />

        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700 font-medium truncate">{file.name}</span>
              <button
                onClick={() => { setFile(null); setDownloadedCount(null); setError(""); }}
                className="text-gray-400 hover:text-red-500 text-xs ml-4 transition-colors"
              >
                Remove
              </button>
            </div>

            {/* DPI selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Output quality</p>
              <div className="flex gap-2">
                {dpiOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDpi(opt.value)}
                    className={
                      dpi === opt.value
                        ? "px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-red-400 transition-colors"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleConvert}
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Converting…" : "Convert to JPG"}
            </button>

            {downloadedCount !== null && (
              <p className="text-center text-green-600 font-semibold">
                Downloaded {downloadedCount} {downloadedCount === 1 ? "image" : "images"}
              </p>
            )}
            {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

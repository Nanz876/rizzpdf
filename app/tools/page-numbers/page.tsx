"use client";

import { useState } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { downloadBlob, addPageNumbers, PageNumberOptions } from "@/lib/pdf-tools";

type PositionOption = "bottom-center" | "bottom-right" | "bottom-left" | "top-center";
type FormatOption = "1" | "Page 1" | "1 / N";

export default function PageNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<PositionOption>("bottom-center");
  const [format, setFormat] = useState<FormatOption>("1");
  const [startFrom, setStartFrom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleAddNumbers() {
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const opts: PageNumberOptions = {
        position,
        format,
        startFrom: startFrom > 0 ? startFrom : 1,
      };
      const result = await addPageNumbers(file, opts);
      if (!result.success || !result.blob) {
        setError(result.error ?? "Failed to add page numbers.");
      } else {
        downloadBlob(result.blob, result.filename ?? "numbered.pdf");
        setSuccess(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const positionOptions: { label: string; value: PositionOption }[] = [
    { label: "Bottom Center", value: "bottom-center" },
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Top Center", value: "top-center" },
  ];

  const formatOptions: FormatOption[] = ["1", "Page 1", "1 / N"];

  return (
    <ToolShell name="Page Numbers" icon="🔢" description="Automatically number every page of your PDF.">
      <div className="space-y-4">
        <UploadZone onFilesAdded={(files) => { setFile(files[0]); setSuccess(false); setError(""); }} />

        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700 font-medium truncate">{file.name}</span>
              <button
                onClick={() => { setFile(null); setSuccess(false); setError(""); }}
                className="text-gray-400 hover:text-red-500 text-xs ml-4 transition-colors"
              >
                Remove
              </button>
            </div>

            {/* Position selector — 2x2 grid */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Number position</p>
              <div className="grid grid-cols-2 gap-2">
                {positionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPosition(opt.value)}
                    className={
                      position === opt.value
                        ? "px-4 py-2 rounded-xl bg-purple-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-purple-400 transition-colors"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Number format</p>
              <div className="flex gap-2 flex-wrap">
                {formatOptions.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={
                      format === f
                        ? "px-4 py-2 rounded-xl bg-purple-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-purple-400 transition-colors"
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Start from */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Start numbering from
              </label>
              <input
                type="number"
                min={1}
                value={startFrom}
                onChange={(e) => setStartFrom(Number(e.target.value))}
                className="w-28 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 focus:outline-none focus:border-purple-400"
              />
            </div>

            <button
              onClick={handleAddNumbers}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Adding page numbers…" : "Add Page Numbers"}
            </button>

            {success && <p className="text-center text-green-600 font-semibold">PDF with page numbers downloaded!</p>}
            {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

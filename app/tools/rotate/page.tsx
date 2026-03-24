"use client";

import { useState } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { downloadBlob, rotatePDF } from "@/lib/pdf-tools";

type Angle = 90 | 180 | 270;
type PageMode = "all" | "specific";

export default function RotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState<Angle>(90);
  const [pageMode, setPageMode] = useState<PageMode>("all");
  const [pageInput, setPageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function parsePages(input: string): number[] {
    const pages: number[] = [];
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) pages.push(i);
        }
      } else {
        const n = Number(part);
        if (!isNaN(n) && n > 0) pages.push(n);
      }
    }
    return [...new Set(pages)].sort((a, b) => a - b);
  }

  async function handleRotate() {
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const pageSelection: "all" | number[] =
        pageMode === "all" ? "all" : parsePages(pageInput);

      if (pageMode === "specific" && Array.isArray(pageSelection) && pageSelection.length === 0) {
        setError("Please enter valid page numbers.");
        setLoading(false);
        return;
      }

      const result = await rotatePDF(file, angle, pageSelection);
      if (!result.success || !result.blob) {
        setError(result.error ?? "Rotation failed.");
      } else {
        downloadBlob(result.blob, result.filename ?? "rotated.pdf");
        setSuccess(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const angleOptions: { label: string; value: Angle }[] = [
    { label: "90° CW", value: 90 },
    { label: "180°", value: 180 },
    { label: "90° CCW", value: 270 },
  ];

  return (
    <ToolShell name="Rotate PDF" icon="🔄" description="Rotate pages in your PDF by 90°, 180°, or 270°.">
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

            {/* Angle selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Rotation angle</p>
              <div className="flex gap-2">
                {angleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAngle(opt.value)}
                    className={
                      angle === opt.value
                        ? "px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-red-400 transition-colors"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Page selection */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Pages to rotate</p>
              <div className="flex gap-2 mb-3">
                {(["all", "specific"] as PageMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPageMode(mode)}
                    className={
                      pageMode === mode
                        ? "px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-red-400 transition-colors"
                    }
                  >
                    {mode === "all" ? "All pages" : "Specific pages"}
                  </button>
                ))}
              </div>
              {pageMode === "specific" && (
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="e.g. 1,3,5-7"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 focus:outline-none focus:border-red-400"
                />
              )}
            </div>

            <button
              onClick={handleRotate}
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Rotating…" : "Rotate PDF"}
            </button>

            {success && <p className="text-center text-green-600 font-semibold">Rotated PDF downloaded!</p>}
            {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

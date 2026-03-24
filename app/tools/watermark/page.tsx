"use client";

import { useState } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { downloadBlob, watermarkPDF, WatermarkOptions } from "@/lib/pdf-tools";

type ColorOption = "gray" | "red" | "blue";
type PositionOption = "center" | "diagonal";

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState<ColorOption>("gray");
  const [position, setPosition] = useState<PositionOption>("diagonal");
  const [opacity, setOpacity] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleWatermark() {
    if (!file) return;
    if (!text.trim()) {
      setError("Please enter watermark text.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const opts: WatermarkOptions = {
        text: text.trim(),
        color,
        position,
        opacity: opacity / 100,
      };
      const result = await watermarkPDF(file, opts);
      if (!result.success || !result.blob) {
        setError(result.error ?? "Watermark failed.");
      } else {
        downloadBlob(result.blob, result.filename ?? "watermarked.pdf");
        setSuccess(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const colorOptions: { label: string; value: ColorOption }[] = [
    { label: "Gray", value: "gray" },
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ];

  const positionOptions: { label: string; value: PositionOption }[] = [
    { label: "Diagonal", value: "diagonal" },
    { label: "Center", value: "center" },
  ];

  return (
    <ToolShell name="Watermark PDF" icon="💧" description="Add a custom text watermark to every page of your PDF.">
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

            {/* Watermark text */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Watermark text
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="CONFIDENTIAL"
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 focus:outline-none focus:border-red-400"
              />
            </div>

            {/* Color selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Color</p>
              <div className="flex gap-2">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={
                      color === opt.value
                        ? "px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-red-400 transition-colors"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Position</p>
              <div className="flex gap-2">
                {positionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPosition(opt.value)}
                    className={
                      position === opt.value
                        ? "px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm"
                        : "px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm hover:border-red-400 transition-colors"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity slider */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Opacity — <span className="text-red-600">{opacity}%</span>
              </p>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-red-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>

            <button
              onClick={handleWatermark}
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Adding watermark…" : "Add Watermark"}
            </button>

            {success && <p className="text-center text-green-600 font-semibold">Watermarked PDF downloaded!</p>}
            {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

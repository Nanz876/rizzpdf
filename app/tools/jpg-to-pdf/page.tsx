"use client";

import { useState, useRef, DragEvent } from "react";
import ToolShell from "@/components/ToolShell";
import { downloadBlob, jpgToPdf } from "@/lib/pdf-tools";

export default function JpgToPdfPage() {
  const [images, setImages] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png"].includes(f.type)
    );
    if (valid.length === 0) return;
    setImages((prev) => [...prev, ...valid]);
    setSuccess(false);
    setError("");
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setSuccess(false);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleConvert() {
    if (images.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const result = await jpgToPdf(images);
      if (!result.success || !result.blob) {
        setError(result.error ?? "Conversion failed.");
      } else {
        downloadBlob(result.blob, result.filename ?? "converted.pdf");
        setSuccess(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ToolShell name="JPG to PDF" description="Combine JPEG and PNG images into a single PDF file." icon="📄">
      <div className="space-y-4">
        {/* Custom drag-drop zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-purple-500 bg-purple-50"
              : "border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4"
              />
            </svg>
            <p className="text-gray-600 font-medium text-sm">
              Drag &amp; drop images here, or{" "}
              <span className="text-purple-600 font-semibold">browse</span>
            </p>
            <p className="text-gray-400 text-xs">JPEG and PNG files accepted</p>
          </div>
        </div>

        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              {images.length} {images.length === 1 ? "image" : "images"} selected
            </p>
            <div>
              {images.map((img, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-700 truncate flex-1">{img.name}</span>
                  <button
                    onClick={() => removeImage(i)}
                    className="text-gray-400 hover:text-red-500 text-xs ml-4 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleConvert}
              disabled={loading || images.length === 0}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Converting…" : "Convert to PDF"}
            </button>

            {success && <p className="text-center text-green-600 font-semibold">PDF downloaded!</p>}
            {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

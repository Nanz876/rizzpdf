"use client";

import { useCallback, useState } from "react";

interface UploadZoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200MB — matches the copy below

export default function UploadZone({ onFilesAdded, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState("");

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const all = Array.from(files);
      const pdfs = all.filter((f) => f.type === "application/pdf");
      const sized = pdfs.filter((f) => f.size <= MAX_FILE_BYTES);

      const notPdf = all.length - pdfs.length;
      const tooBig = pdfs.length - sized.length;
      if (notPdf || tooBig) {
        const parts: string[] = [];
        if (notPdf) parts.push(`${notPdf} non-PDF file${notPdf > 1 ? "s" : ""} skipped`);
        if (tooBig) parts.push(`${tooBig} file${tooBig > 1 ? "s" : ""} over 200MB skipped`);
        setRejected(parts.join(" · "));
      } else {
        setRejected("");
      }

      if (sized.length) onFilesAdded(sized);
    },
    [onFilesAdded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 cursor-pointer
        ${isDragging
          ? "border-red-500 bg-red-50 drag-active scale-[1.01]"
          : "border-gray-200 bg-gray-50 hover:border-red-400 hover:bg-red-50/30"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <input
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={onInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <div>
          <p className="text-lg font-bold text-gray-800">
            {isDragging ? "Drop it like it&apos;s hot 🔥" : "Drop your PDFs here"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or <span className="text-red-600 font-semibold">click to browse</span> — up to 200MB per file
          </p>
        </div>

        <p className="text-xs text-gray-400">
          🔒 Files never leave your browser · No account needed
        </p>

        {rejected && (
          <p className="text-xs text-amber-600 font-medium mt-1">⚠️ {rejected}</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";

interface UploadZoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFilesAdded, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const pdfs = Array.from(files).filter((f) => f.type === "application/pdf");
      if (pdfs.length) onFilesAdded(pdfs);
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
            or <span className="text-red-600 font-semibold">click to browse</span> — up to 10MB per file (free)
          </p>
        </div>

        <p className="text-xs text-gray-400">
          🔒 Files never leave your browser · No account needed
        </p>
      </div>
    </div>
  );
}

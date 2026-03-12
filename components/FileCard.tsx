"use client";

import { useState } from "react";
import { unlockPDF, downloadBlob } from "@/lib/pdf-unlock";

export interface FileEntry {
  id: string;
  file: File;
  status: "idle" | "processing" | "done" | "error";
  error?: string;
}

interface FileCardProps {
  entry: FileEntry;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: FileEntry["status"], error?: string) => void;
}

export default function FileCard({ entry, onRemove, onStatusChange }: FileCardProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fileSizeMB = (entry.file.size / 1024 / 1024).toFixed(2);

  async function handleUnlock() {
    if (!password.trim()) return;
    onStatusChange(entry.id, "processing");
    const result = await unlockPDF(entry.file, password);
    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      onStatusChange(entry.id, "done");
    } else {
      onStatusChange(entry.id, "error", result.error);
    }
  }

  return (
    <div className="animate-fadeIn border border-gray-200 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* PDF icon */}
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{entry.file.name}</p>
            <p className="text-xs text-gray-400">{fileSizeMB} MB</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          {entry.status === "done" && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
              ✓ Unlocked
            </span>
          )}
          {entry.status === "error" && (
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-1 rounded-full">
              Failed
            </span>
          )}
          {entry.status === "processing" && (
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-1 rounded-full animate-pulse">
              Unlocking...
            </span>
          )}
        </div>
      </div>

      {entry.status === "error" && (
        <p className="mt-2 text-xs text-red-500">{entry.error}</p>
      )}

      {entry.status !== "done" && (
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Enter PDF password"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              disabled={entry.status === "processing"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <button
            onClick={handleUnlock}
            disabled={!password.trim() || entry.status === "processing"}
            className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Unlock
          </button>
          <button
            onClick={() => onRemove(entry.id)}
            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

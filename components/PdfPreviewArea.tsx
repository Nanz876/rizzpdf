"use client";

import { useEffect, useState } from "react";
import { renderThumbnails } from "@/lib/pdf-tools";

interface PdfPreviewAreaProps {
  files: File[];
  onAddMore?: () => void; // shows "+" button if provided
}

interface FileThumb {
  name: string;
  size: string;
  pageCount: number;
  thumbUrl: string; // first page only
}

function fmtSize(b: number) {
  return b > 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(2)} MB`
    : `${(b / 1024).toFixed(2)} KB`;
}

export default function PdfPreviewArea({ files, onAddMore }: PdfPreviewAreaProps) {
  const [thumbs, setThumbs] = useState<FileThumb[]>([]);

  useEffect(() => {
    let cancelled = false;
    setThumbs([]);

    (async () => {
      const results = await Promise.all(
        files.map(async (f) => {
          try {
            const pages = await renderThumbnails(f, 0.55);
            return {
              name: f.name,
              size: fmtSize(f.size),
              pageCount: pages.length,
              thumbUrl: pages[0] ?? "",
            };
          } catch {
            return {
              name: f.name,
              size: fmtSize(f.size),
              pageCount: 0,
              thumbUrl: "",
            };
          }
        })
      );
      if (!cancelled) setThumbs(results);
    })();

    return () => { cancelled = true; };
  }, [files]);

  return (
    <div className="flex flex-wrap gap-5 items-start justify-center py-6">
      {files.map((f, i) => {
        const thumb = thumbs[i];
        return (
          <div key={`${f.name}-${i}`} className="flex flex-col items-center gap-2">
            {/* Card */}
            <div className="relative w-[140px]">
              {/* Size + pages badge */}
              {thumb && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10
                  bg-gray-700 text-white text-[10px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap shadow">
                  {thumb.size} · {thumb.pageCount} {thumb.pageCount === 1 ? "page" : "pages"}
                </div>
              )}

              {/* Thumbnail */}
              <div className="w-full aspect-[3/4] rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden flex items-center justify-center">
                {thumb?.thumbUrl ? (
                  <img
                    src={thumb.thumbUrl}
                    alt={`Preview of ${f.name}`}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                ) : (
                  /* Skeleton while rendering */
                  <div className="w-full h-full bg-gray-100 animate-pulse flex flex-col items-center justify-center gap-2">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" className="text-gray-300">
                      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[9px] text-gray-300 font-medium">Loading…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Filename */}
            <p className="text-xs text-gray-500 max-w-[140px] truncate text-center font-medium">
              {f.name}
            </p>
          </div>
        );
      })}

      {/* Add more button */}
      {onAddMore && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onAddMore}
            className="w-[140px] aspect-[3/4] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50
              hover:border-red-400 hover:bg-red-50 transition-colors flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-gray-200 group-hover:bg-red-100 flex items-center justify-center transition-colors">
              <span className="text-2xl text-gray-500 group-hover:text-red-600 leading-none">+</span>
            </div>
            <span className="text-xs text-gray-400 group-hover:text-red-500 font-medium transition-colors">Add file</span>
          </button>
          <p className="text-xs text-transparent select-none">·</p>
        </div>
      )}
    </div>
  );
}

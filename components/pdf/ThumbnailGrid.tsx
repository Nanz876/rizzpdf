// components/pdf/ThumbnailGrid.tsx
"use client";
import React from "react";

export interface ThumbnailPage {
  dataUrl: string;
  pageNumber: number;        // 1-based
  label?: string;            // override label (e.g. "90°")
  labelColor?: string;       // e.g. "bg-red-600"
  rotation?: number;         // degrees: 0, 90, 180, 270
}

interface ThumbnailGridProps {
  pages: ThumbnailPage[];
  selectedPages?: Set<number>;         // 1-based page numbers that are "selected" (checked)
  onToggleSelect?: (page: number) => void;
  onRotateLeft?: (page: number) => void;
  onRotateRight?: (page: number) => void;
  onDelete?: (page: number) => void;
  draggable?: boolean;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDrop?: (index: number) => void;
  dragOverIndex?: number | null;
  showCheckboxes?: boolean;
  showRotateButtons?: boolean;
  columns?: 3 | 4 | 5;
}

export default function ThumbnailGrid({
  pages, selectedPages, onToggleSelect, onRotateLeft, onRotateRight,
  onDelete, draggable, onDragStart, onDragOver, onDrop, dragOverIndex,
  showCheckboxes, showRotateButtons, columns = 4,
}: ThumbnailGridProps) {
  const colClass = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[columns];

  return (
    <div className={`grid ${colClass} gap-3`}>
      {pages.map((pg, idx) => {
        const selected = selectedPages?.has(pg.pageNumber) ?? false;
        const isDragOver = dragOverIndex === idx;
        return (
          <div
            key={pg.pageNumber}
            className={`relative bg-white rounded-xl overflow-hidden shadow-sm border-2 transition-all cursor-default
              ${selected ? "border-red-500 bg-red-50" : "border-gray-100 hover:border-gray-300"}
              ${isDragOver ? "border-red-400 scale-105" : ""}
              ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
            `}
            draggable={draggable}
            onDragStart={() => onDragStart?.(idx)}
            onDragOver={(e) => { e.preventDefault(); onDragOver?.(idx); }}
            onDrop={() => onDrop?.(idx)}
          >
            {/* Checkbox */}
            {showCheckboxes && onToggleSelect && (
              <button
                onClick={() => onToggleSelect(pg.pageNumber)}
                className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center z-10 transition-colors
                  ${selected ? "bg-red-600 border-red-600" : "bg-white border-gray-300 hover:border-red-400"}`}
              >
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            )}

            {/* Page label badge */}
            {pg.label && (
              <div className={`absolute top-2 left-2 ${pg.labelColor ?? "bg-red-600"} text-white text-xs font-bold px-1.5 py-0.5 rounded z-10`}>
                {pg.label}
              </div>
            )}

            {/* Thumbnail image */}
            <div className="aspect-[3/4] relative overflow-hidden bg-gray-50">
              <img
                src={pg.dataUrl}
                alt={`Page ${pg.pageNumber}`}
                draggable={false}
                className="w-full h-full object-contain transition-transform duration-200"
                style={pg.rotation ? { transform: `rotate(${pg.rotation}deg)` } : undefined}
              />

              {/* Rotate hover buttons */}
              {showRotateButtons && (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                  {onRotateLeft && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRotateLeft(pg.pageNumber); }}
                      className="w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Rotate left"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                        <path d="M4 12a8 8 0 108-8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                        <path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                  {onRotateRight && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRotateRight(pg.pageNumber); }}
                      className="w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Rotate right"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                        <path d="M20 12a8 8 0 11-8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                        <path d="M12 4V8M12 8l3-3m-3 3l-3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className={`text-xs font-semibold ${selected ? "text-red-600" : "text-gray-500"}`}>
                Page {pg.pageNumber}
              </span>
              {onDelete && (
                <button
                  onClick={() => onDelete(pg.pageNumber)}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                >✕</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

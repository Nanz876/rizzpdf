"use client";

import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob, organizePDF, renderThumbnails } from "@/lib/pdf-tools";
import { logTool } from "@/lib/logTool";

type Status = "idle" | "loading-thumbs" | "ready" | "saving" | "done";

export default function OrganizePage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [error, setError] = useState("");

  const handleFilesAdded = useCallback(async (files: File[]) => {
    const pdf = files[0];
    setFile(pdf);
    setError("");
    setStatus("loading-thumbs");

    try {
      const thumbs = await renderThumbnails(pdf, 0.5);
      setThumbnails(thumbs);
      setPageOrder(thumbs.map((_, i) => i));
      setStatus("ready");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load thumbnails.");
      setStatus("idle");
    }
  }, []);

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOver(index);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    setDragOver(null);
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(fromIndex) || fromIndex === toIndex) return;

    setPageOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  // Button controls work on touch screens, where drag-and-drop isn't available.
  function movePage(index: number, delta: -1 | 1) {
    setPageOrder((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function deletePageAt(index: number) {
    setPageOrder((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSave() {
    if (!file) return;
    logTool("organize");
    setStatus("saving");
    setError("");

    try {
      const result = await organizePDF(file, pageOrder);
      if (!result.success || !result.blob) {
        setError(result.error ?? "Failed to organize PDF.");
        setStatus("ready");
      } else {
        downloadBlob(result.blob, result.filename ?? "organized.pdf");
        setStatus("done");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
      setStatus("ready");
    }
  }

  function handleReset() {
    setFile(null);
    setThumbnails([]);
    setPageOrder([]);
    setError("");
    setStatus("idle");
    setDragOver(null);
  }

  return (
    <ToolShell
      name="Organize PDF"
      description="Reorder or delete pages in your PDF."
      icon="🗂️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Reorder or delete pages", "Download the new PDF"]}
    >
      <div className="space-y-4">
        {status === "idle" && (
          <>
            <UploadZone onFilesAdded={handleFilesAdded} />
            {error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
          </>
        )}

        {status === "loading-thumbs" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-gray-500 font-medium">Loading thumbnails…</p>
          </div>
        )}

        {(status === "ready" || status === "saving") && file && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <WorkspaceBar
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1" fill="white" opacity=".5"/><rect x="13" y="3" width="8" height="8" rx="1" fill="white"/><rect x="3" y="13" width="8" height="8" rx="1" fill="white"/><rect x="13" y="13" width="8" height="8" rx="1" fill="white" opacity=".5"/></svg>}
              title="Organize PDF"
              subtitle={`${file.name} · ${pageOrder.length} of ${thumbnails.length} pages — drag or use arrows`}
              onReset={handleReset}
              primaryLabel={status === "saving" ? "Saving…" : "Save PDF →"}
              onPrimary={handleSave}
              primaryDisabled={status === "saving"}
            />

            {error && <p className="text-center text-red-500 text-sm px-5 py-2">{error}</p>}

            <div className="p-5 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pageOrder.map((originalIndex, displayIndex) => (
                  <div
                    key={originalIndex}
                    draggable
                    onDragStart={(e) => handleDragStart(e, displayIndex)}
                    onDragOver={(e) => handleDragOver(e, displayIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, displayIndex)}
                    className={`
                      relative rounded-xl border-2 overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none bg-white shadow-sm
                      ${dragOver === displayIndex
                        ? "border-red-500 scale-105 shadow-lg"
                        : "border-gray-200 hover:border-red-300 hover:shadow-md"
                      }
                    `}
                  >
                    <img
                      src={thumbnails[originalIndex]}
                      alt={`Page ${originalIndex + 1}`}
                      className="w-full object-cover block pointer-events-none aspect-[3/4]"
                      draggable={false}
                    />
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
                      <span className="bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {displayIndex + 1}
                      </span>
                    </div>
                    <div className="absolute top-1.5 inset-x-1.5 flex justify-between">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Move page ${displayIndex + 1} earlier`}
                          disabled={displayIndex === 0}
                          onClick={() => movePage(displayIndex, -1)}
                          className="w-7 h-7 rounded-full bg-black/60 text-white text-sm font-bold disabled:opacity-30 hover:bg-black/80"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={`Move page ${displayIndex + 1} later`}
                          disabled={displayIndex === pageOrder.length - 1}
                          onClick={() => movePage(displayIndex, 1)}
                          className="w-7 h-7 rounded-full bg-black/60 text-white text-sm font-bold disabled:opacity-30 hover:bg-black/80"
                        >
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete page ${displayIndex + 1}`}
                        disabled={pageOrder.length === 1}
                        onClick={() => deletePageAt(displayIndex)}
                        className="w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold disabled:opacity-30 hover:bg-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-4">
            <p className="text-green-600 font-semibold">✓ PDF organized! Download started automatically.</p>
            <button
              onClick={handleReset}
              className="bg-red-600 text-white py-2.5 px-6 rounded-xl font-bold hover:bg-red-700 transition-colors"
            >
              Organize another
            </button>
          </div>
        )}
      </div>

    </ToolShell>
  );
}

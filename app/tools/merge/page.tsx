"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { renderThumbnails, downloadBlob, parseRanges, type ToolResult } from "@/lib/pdf-tools";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "processing" | "done" | "error";

/** Parse a range string into 1-based page numbers, in the order written. `null` = invalid. */
function parsePagesSafe(str: string, total: number): number[] | null {
  if (!str.trim()) return Array.from({ length: total }, (_, i) => i + 1);
  try {
    return parseRanges(str, total).flat().map((i) => i + 1);
  } catch {
    return null;
  }
}

/** Compress an ordered list of 1-based page numbers back into range syntax, e.g. [1,2,3,5] -> "1-3, 5". */
function rangeStringFromPages(pages: number[]): string {
  if (!pages.length) return "";
  const parts: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (let i = 1; i <= pages.length; i++) {
    const cur = pages[i];
    if (cur === prev + 1) { prev = cur; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (i < pages.length) { start = cur; prev = cur; }
  }
  return parts.join(", ");
}

function isFullAscending(pages: number[], total: number): boolean {
  if (pages.length !== total) return false;
  return pages.every((p, i) => p === i + 1);
}

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [allThumbs, setAllThumbs] = useState<string[][]>([]);
  const [selections, setSelections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    setLoading(true); setError("");
    try {
      const newThumbs = await Promise.all(newFiles.map(f => renderThumbnails(f, 0.35)));
      setFiles(prev => [...prev, ...newFiles]);
      setAllThumbs(prev => [...prev, ...newThumbs]);
      setSelections(prev => [...prev, ...newFiles.map(() => "")]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "One of the files couldn't be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Arrow buttons: drag-and-drop doesn't work on touch screens.
  const moveFile = (idx: number, delta: -1 | 1) => {
    const to = idx + delta;
    if (to < 0 || to >= files.length) return;
    const swap = <T,>(arr: T[]) => { const next = [...arr]; [next[idx], next[to]] = [next[to], next[idx]]; return next; };
    setFiles(swap);
    setAllThumbs(swap);
    setSelections(swap);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setAllThumbs(prev => prev.filter((_, i) => i !== idx));
    setSelections(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOver(null); return; }
    const reorder = <T,>(arr: T[]) => {
      const next = [...arr];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    };
    setFiles(reorder);
    setAllThumbs(reorder);
    setSelections(reorder);
    setDragIdx(null);
    setDragOver(null);
  };

  const setSelectionText = (fi: number, text: string) => {
    setSelections(prev => { const next = [...prev]; next[fi] = text; return next; });
  };

  const togglePage = (fi: number, pageNum: number) => {
    const total = allThumbs[fi]?.length ?? 0;
    const current = parsePagesSafe(selections[fi] ?? "", total) ?? Array.from({ length: total }, (_, i) => i + 1);
    const included = current.includes(pageNum);
    const next = included ? current.filter(p => p !== pageNum) : [...current, pageNum];
    setSelectionText(fi, isFullAscending(next, total) ? "" : rangeStringFromPages(next));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    logTool("merge"); setStatus("processing");
    const result = await runInWorker<ToolResult>("mergePDFs", files, selections.map(s => s || undefined));
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? "merged.pdf");
      setStatus("done");
    } else { setError(result.error ?? "Merge failed."); setStatus("error"); }
  };

  const reset = () => { setFiles([]); setAllThumbs([]); setSelections([]); setStatus("idle"); setError(""); };

  const includedCounts = files.map((_, fi) => {
    const total = allThumbs[fi]?.length ?? 0;
    const pages = parsePagesSafe(selections[fi] ?? "", total);
    return pages ? pages.length : 0;
  });
  const hasInvalidSelection = files.some((_, fi) => parsePagesSafe(selections[fi] ?? "", allThumbs[fi]?.length ?? 0) === null);
  const totalPages = includedCounts.reduce((sum, n) => sum + n, 0);

  if (files.length === 0) {
    return (
      <ToolShell name="Merge PDF" description="Combine multiple PDFs into one document." icon="🔗"
        svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="rgba(255,255,255,0.3)"/><path d="M13 6h7v12h-7V6z" fill="rgba(255,255,255,0.6)"/><path d="M10 12h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}
        steps={["Upload your PDFs", "Arrange order", "Download merged file"]}>
        <UploadZone onFilesAdded={addFiles} />
        {files.length === 0 && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      </ToolShell>
    );
  }

  return (
    <ToolShell name="Merge PDF" description="Combine multiple PDFs into one document." icon="🔗"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="rgba(255,255,255,0.3)"/><path d="M13 6h7v12h-7V6z" fill="rgba(255,255,255,0.6)"/><path d="M10 12h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <WorkspaceBar
          icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="white" opacity=".5"/><path d="M13 6h7v12h-7V6z" fill="white"/><path d="M10 12h4" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
          title="Merge PDF" subtitle={`${files.length} files · ${totalPages} output page${totalPages === 1 ? "" : "s"} · drag to reorder`}
          onReset={reset}
          secondaryLabel="+ Add more files" onSecondary={() => fileInputRef.current?.click()}
          primaryLabel={status === "processing" ? "Merging…" : status === "done" ? "✓ Downloaded!" : `Merge ${files.length} PDFs →`}
          onPrimary={status === "done" ? reset : handleMerge}
          primaryDisabled={files.length < 2 || status === "processing" || hasInvalidSelection || totalPages === 0} />
        <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={e => { if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ""; } }} />
        {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
        {loading && <p className="text-sm text-gray-400 px-5 py-2">Rendering thumbnails…</p>}
        <div className="p-5 bg-gray-50 space-y-2">
          {files.map((f, fi) => (
            <div
              key={fi}
              draggable
              onDragStart={() => setDragIdx(fi)}
              onDragOver={e => { e.preventDefault(); setDragOver(fi); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(fi)}
              className={`bg-white rounded-xl border-2 p-3 transition-all cursor-grab active:cursor-grabbing select-none
                ${dragOver === fi && dragIdx !== fi ? "border-red-400 scale-[1.01] shadow-md" : "border-gray-200 hover:border-gray-300"}
                ${dragIdx === fi ? "opacity-40" : "opacity-100"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                    </svg>
                  </span>
                  <span className="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{fi + 1}</span>
                  <span className="text-sm font-semibold text-gray-700">{f.name}</span>
                  <span className={`text-xs ${parsePagesSafe(selections[fi] ?? "", allThumbs[fi]?.length ?? 0) === null ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                    · {includedCounts[fi]} of {allThumbs[fi]?.length ?? 0} pages
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Move ${f.name} up`} disabled={fi === 0} onClick={() => moveFile(fi, -1)}
                    className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Move ${f.name} down`} disabled={fi === files.length - 1} onClick={() => moveFile(fi, 1)}
                    className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">↓</button>
                  <button onClick={() => removeFile(fi)} className="text-xs text-gray-300 hover:text-red-500 transition-colors ml-1">✕ Remove</button>
                </div>
              </div>
              <div className="mb-2" onMouseDown={e => e.stopPropagation()}>
                <input
                  value={selections[fi] ?? ""}
                  onChange={e => setSelectionText(fi, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  draggable={false}
                  placeholder="All pages"
                  aria-label={`Pages to include from ${f.name}`}
                  className={`w-full max-w-xs border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none
                    ${parsePagesSafe(selections[fi] ?? "", allThumbs[fi]?.length ?? 0) === null
                      ? "border-red-400 focus:border-red-500"
                      : "border-gray-200 focus:border-red-400"}`}
                />
              </div>
              {allThumbs[fi] && allThumbs[fi].length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allThumbs[fi].map((url, pi) => {
                    const pageNum = pi + 1;
                    const included = (parsePagesSafe(selections[fi] ?? "", allThumbs[fi].length) ?? []).includes(pageNum);
                    return (
                      <div key={pi} className="flex-shrink-0 w-16">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); togglePage(fi, pageNum); }}
                          onMouseDown={e => e.stopPropagation()}
                          draggable={false}
                          title={included ? `Exclude page ${pageNum}` : `Include page ${pageNum}`}
                          className={`block w-full border rounded-lg overflow-hidden bg-white shadow-sm transition-opacity
                            ${included ? "border-gray-200" : "border-gray-200 opacity-30"}`}
                        >
                          <img src={url} alt={`Page ${pageNum}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                        </button>
                        <div className="text-center text-xs text-gray-400 mt-0.5">{pageNum}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>


      {/* SEO copy block */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-2 space-y-4 text-sm text-gray-600 leading-relaxed">
        <h2 className="text-base font-bold text-gray-900">How to merge PDF files online for free</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Upload two or more PDF files using the drop zone above</li>
          <li>Drag the cards to reorder the files into your preferred sequence</li>
          <li>Click <strong>Merge PDFs</strong> to download the combined document instantly</li>
        </ol>
        <p>
          All processing happens in your browser — nothing is uploaded to a server. Safe for contracts,
          financial records, and confidential documents. Works on Windows, Mac, iPhone, and Android.
        </p>
        <p>
          Need to do the opposite?{" "}
          <Link href="/tools/split" className="text-red-600 hover:underline font-medium">Split a PDF into separate files</Link>
          {" "}or{" "}
          <Link href="/tools/delete-pages" className="text-red-600 hover:underline font-medium">delete specific pages</Link>
          {" "}before merging. Read our guide:{" "}
          <Link href="/blog/merge-pdf-files-online-free" className="text-red-600 hover:underline font-medium">
            How to merge PDFs free
          </Link>.
        </p>
      </div>
    </ToolShell>
  );
}

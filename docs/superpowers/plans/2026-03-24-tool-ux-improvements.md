# Tool UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six UX issues across PDF tools: larger thumbnails in Organize/Delete/Rotate/PDF-to-JPG, live rotation preview, drag-to-reorder in Merge, interactive splitters in Split, new batch tools (page numbers + unlock), and paywall on Compress & Watermark.

**Architecture:** All changes are frontend-only. Shared components (`ThumbnailGrid`, `ThumbnailPage`) get minimal new props. Each tool page is modified independently. `lib/pdf-tools.ts` gets two new `BatchOptions` variants. No new files needed.

**Tech Stack:** React, TypeScript, pdf-lib, pdfjs-dist, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `components/pdf/ThumbnailGrid.tsx` | Add `rotation?: number` to `ThumbnailPage`; apply CSS transform to thumbnail image |
| `app/tools/organize/page.tsx` | Increase render scale 0.3→0.5; reduce grid to 2/3/4 cols |
| `app/tools/delete-pages/page.tsx` | Increase render scale 0.4→0.5; pass `columns={3}` |
| `app/tools/pdf-to-jpg/page.tsx` | Increase render scale 0.4→0.5; pass `columns={3}` |
| `app/tools/rotate/page.tsx` | Increase render scale 0.4→0.5; pass `columns={3}`; pass `rotation` per page |
| `app/tools/merge/page.tsx` | Add drag-to-reorder for file cards |
| `app/tools/split/page.tsx` | Replace static scissors with interactive splitter markers |
| `lib/pdf-tools.ts` | Add `page-numbers` and `unlock` to `BatchOptions` and `batchProcess` |
| `app/tools/batch/page.tsx` | Add page-numbers and unlock tool UI options |
| `app/tools/compress/page.tsx` | Add paywall check before compressing |
| `app/tools/watermark/page.tsx` | Add paywall check before applying watermark |

---

## Task 1: Larger Thumbnails — ThumbnailGrid rotation support

**Files:**
- Modify: `components/pdf/ThumbnailGrid.tsx`

- [ ] **Step 1: Add `rotation` field to `ThumbnailPage` and apply CSS transform**

In `ThumbnailGrid.tsx`, update the `ThumbnailPage` interface and the `<img>` element:

```tsx
// In ThumbnailPage interface, add:
rotation?: number;  // degrees: 0, 90, 180, 270

// In the img element (line ~79), change:
<img
  src={pg.dataUrl}
  alt={`Page ${pg.pageNumber}`}
  draggable={false}
  className="w-full h-full object-contain transition-transform duration-200"
  style={pg.rotation ? { transform: `rotate(${pg.rotation}deg)` } : undefined}
/>
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\kael_\rizzpdf-app
git add components/pdf/ThumbnailGrid.tsx
git commit -m "feat: add rotation CSS transform support to ThumbnailGrid"
```

---

## Task 2: Larger Thumbnails — Organize, Delete Pages, PDF to JPG, Rotate

**Files:**
- Modify: `app/tools/organize/page.tsx`
- Modify: `app/tools/delete-pages/page.tsx`
- Modify: `app/tools/pdf-to-jpg/page.tsx`
- Modify: `app/tools/rotate/page.tsx`

- [ ] **Step 1: Organize — larger thumbnails**

In `app/tools/organize/page.tsx`:

Change render scale (line 26):
```tsx
// Before:
const thumbs = await renderThumbnails(pdf, 0.3);
// After:
const thumbs = await renderThumbnails(pdf, 0.5);
```

Change grid class (line 127):
```tsx
// Before:
<div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
// After:
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

- [ ] **Step 2: Delete Pages — larger thumbnails**

In `app/tools/delete-pages/page.tsx`:

Change render scale (line 21):
```tsx
// Before:
const t = await renderThumbnails(files[0], 0.4);
// After:
const t = await renderThumbnails(files[0], 0.5);
```

Change ThumbnailGrid columns prop (line 62):
```tsx
// Before:
<ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={4} />
// After:
<ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={3} />
```

- [ ] **Step 3: PDF to JPG — larger thumbnails**

In `app/tools/pdf-to-jpg/page.tsx`:

Change render scale (line 21):
```tsx
// Before:
const t = await renderThumbnails(files[0], 0.4);
// After:
const t = await renderThumbnails(files[0], 0.5);
```

Change ThumbnailGrid columns prop (line 74):
```tsx
// Before:
<ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={4} />
// After:
<ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={3} />
```

- [ ] **Step 4: Rotate — larger thumbnails + live rotation preview**

In `app/tools/rotate/page.tsx`:

Change render scale (line 21):
```tsx
// Before:
const t = await renderThumbnails(files[0], 0.4);
// After:
const t = await renderThumbnails(files[0], 0.5);
```

Change `pages` definition to include `rotation` (lines 31-36):
```tsx
const pages: ThumbnailPage[] = thumbs.map((url, i) => ({
  dataUrl: url,
  pageNumber: i + 1,
  rotation: rotations[i + 1] ?? 0,
  label: rotations[i + 1] ? `${rotations[i + 1]}°` : undefined,
  labelColor: "bg-red-600",
}));
```

Change ThumbnailGrid columns prop (line 84):
```tsx
// Before:
<ThumbnailGrid pages={pages} showRotateButtons
  onRotateLeft={p => rotate(p, -90)} onRotateRight={p => rotate(p, 90)} columns={4} />
// After:
<ThumbnailGrid pages={pages} showRotateButtons
  onRotateLeft={p => rotate(p, -90)} onRotateRight={p => rotate(p, 90)} columns={3} />
```

- [ ] **Step 5: Commit**

```bash
git add app/tools/organize/page.tsx app/tools/delete-pages/page.tsx app/tools/pdf-to-jpg/page.tsx app/tools/rotate/page.tsx
git commit -m "feat: larger thumbnails and live rotation preview in Organize, Delete, JPG, Rotate tools"
```

---

## Task 3: Merge PDF — Drag to Reorder Files

**Files:**
- Modify: `app/tools/merge/page.tsx`

The file card list (one card per PDF) needs HTML5 drag-and-drop. When a card is dropped onto another position, swap both `files` and `allThumbs` arrays together.

- [ ] **Step 1: Add drag state and handlers**

Replace `app/tools/merge/page.tsx` content:

```tsx
"use client";
import { useState, useCallback, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { renderThumbnails, mergePDFs, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [allThumbs, setAllThumbs] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    setLoading(true);
    const newThumbs = await Promise.all(newFiles.map(f => renderThumbnails(f, 0.35)));
    setFiles(prev => [...prev, ...newFiles]);
    setAllThumbs(prev => [...prev, ...newThumbs]);
    setLoading(false);
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setAllThumbs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOver(null); return; }
    setFiles(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setAllThumbs(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOver(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setStatus("processing");
    const result = await mergePDFs(files);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? "merged.pdf");
      setStatus("done");
    } else { setError(result.error ?? "Merge failed."); setStatus("error"); }
  };

  const reset = () => { setFiles([]); setAllThumbs([]); setStatus("idle"); setError(""); };

  const totalPages = allThumbs.reduce((sum, t) => sum + t.length, 0);

  if (files.length === 0) {
    return (
      <ToolShell name="Merge PDF" description="Combine multiple PDFs into one document." icon="🔗"
        svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="rgba(255,255,255,0.3)"/><path d="M13 6h7v12h-7V6z" fill="rgba(255,255,255,0.6)"/><path d="M10 12h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}
        steps={["Upload your PDFs", "Arrange order", "Download merged file"]}>
        <UploadZone onFilesAdded={addFiles} />
      </ToolShell>
    );
  }

  return (
    <ToolShell name="Merge PDF" description="Combine multiple PDFs into one document." icon="🔗"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="rgba(255,255,255,0.3)"/><path d="M13 6h7v12h-7V6z" fill="rgba(255,255,255,0.6)"/><path d="M10 12h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <WorkspaceBar
          icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="white" opacity=".5"/><path d="M13 6h7v12h-7V6z" fill="white"/><path d="M10 12h4" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
          title="Merge PDF" subtitle={`${files.length} files · ${totalPages} pages · drag to reorder`}
          onReset={reset}
          secondaryLabel="+ Add more files" onSecondary={() => fileInputRef.current?.click()}
          primaryLabel={status === "processing" ? "Merging…" : status === "done" ? "✓ Downloaded!" : `Merge ${files.length} PDFs →`}
          onPrimary={status === "done" ? reset : handleMerge}
          primaryDisabled={files.length < 2 || status === "processing"} />
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
                  <span className="text-gray-300 cursor-grab">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                    </svg>
                  </span>
                  <span className="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{fi + 1}</span>
                  <span className="text-sm font-semibold text-gray-700">{f.name}</span>
                  <span className="text-xs text-gray-400">· {allThumbs[fi]?.length ?? 0} pages</span>
                </div>
                <button onClick={() => removeFile(fi)} className="text-xs text-gray-300 hover:text-red-500 transition-colors">✕ Remove</button>
              </div>
              {allThumbs[fi] && allThumbs[fi].length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allThumbs[fi].map((url, pi) => (
                    <div key={pi} className="flex-shrink-0 w-16">
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <img src={url} alt={`Page ${pi + 1}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                      </div>
                      <div className="text-center text-xs text-gray-400 mt-0.5">{pi + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tools/merge/page.tsx
git commit -m "feat: drag-to-reorder files in Merge PDF"
```

---

## Task 4: Split PDF — Interactive Splitters

**Files:**
- Modify: `app/tools/split/page.tsx`

Replace the static "every-page scissors" and the radio-toggle mode UI with an interactive splitter interface. Users click the gap between any two pages to place/remove a split marker. The existing `range` mode text input is kept as a secondary "Advanced" option. The visual splitter mode computes a range string automatically.

- [ ] **Step 1: Rewrite Split page with interactive splitters**

Replace `app/tools/split/page.tsx` content:

```tsx
"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { renderThumbnails, splitPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

// Convert a Set of split-after indices (0-based page index) to range string "1-2, 3-5, 6"
function splitPointsToRanges(splitAfter: Set<number>, totalPages: number): string {
  if (splitAfter.size === 0) return `1-${totalPages}`;
  const sorted = Array.from(splitAfter).sort((a, b) => a - b);
  const segments: string[] = [];
  let start = 1;
  for (const afterIdx of sorted) {
    const end = afterIdx + 1; // afterIdx is 0-based page index; afterIdx+1 = 1-based page number
    segments.push(start === end ? `${start}` : `${start}-${end}`);
    start = end + 1;
  }
  if (start <= totalPages) {
    segments.push(start === totalPages ? `${start}` : `${start}-${totalPages}`);
  }
  return segments.join(", ");
}

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [splitAfter, setSplitAfter] = useState<Set<number>>(new Set()); // 0-based page indices
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [splitCount, setSplitCount] = useState(0);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    const t = await renderThumbnails(files[0], 0.45);
    setThumbs(t); setStatus("ready");
    setSplitAfter(new Set());
  }, []);

  const toggleSplit = (afterIdx: number) => {
    setSplitAfter(prev => {
      const next = new Set(prev);
      next.has(afterIdx) ? next.delete(afterIdx) : next.add(afterIdx);
      return next;
    });
  };

  const handleSplit = async () => {
    if (!file) return;
    setStatus("processing");
    let mode: "every-page" | "range" = "range";
    let ranges: string | undefined;
    if (showAdvanced && rangeStr.trim()) {
      ranges = rangeStr;
    } else if (splitAfter.size === 0) {
      mode = "every-page";
    } else {
      ranges = splitPointsToRanges(splitAfter, thumbs.length);
    }
    const result = await splitPDF(file, mode, ranges);
    if (result.success && result.blobs) {
      result.blobs.forEach((blob, i) => downloadBlob(blob, result.filenames![i]));
      setSplitCount(result.blobs.length); setStatus("done");
    } else { setError(result.error ?? "Split failed."); setStatus("error"); }
  };

  const reset = () => {
    setFile(null); setThumbs([]); setSplitAfter(new Set());
    setRangeStr(""); setStatus("idle"); setError("");
  };

  const segmentCount = splitAfter.size + 1;

  return (
    <ToolShell name="Split PDF" description="Click between pages to add split markers, then split." icon="✂️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click between pages to split", "Download files"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(["ready", "processing", "done", "error"] as Status[]).includes(status) && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
            title="Split PDF"
            subtitle={`${file.name} · ${thumbs.length} pages · ${segmentCount} segment${segmentCount !== 1 ? "s" : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Splitting…" : status === "done" ? `✓ ${splitCount} files downloaded` : `Split into ${segmentCount} →`}
            onPrimary={status === "done" ? reset : handleSplit}
            primaryDisabled={status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />

          {/* Page strip with clickable gaps */}
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Click between pages to add or remove a split point</p>
            <div className="flex items-stretch gap-0 overflow-x-auto pb-3">
              {thumbs.map((url, i) => (
                <div key={i} className="flex items-stretch flex-shrink-0">
                  {/* Page thumbnail */}
                  <div className="flex flex-col items-center">
                    <div className="w-24 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <img src={url} alt={`Page ${i + 1}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-1">{i + 1}</div>
                  </div>

                  {/* Gap / splitter button between pages */}
                  {i < thumbs.length - 1 && (
                    <button
                      onClick={() => toggleSplit(i)}
                      title={splitAfter.has(i) ? "Remove split point" : "Add split point here"}
                      className={`w-10 self-stretch flex flex-col items-center justify-center gap-1 mx-1 rounded-lg border-2 transition-all group
                        ${splitAfter.has(i)
                          ? "border-red-400 bg-red-50 hover:bg-red-100"
                          : "border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50"}`}
                    >
                      {splitAfter.has(i) ? (
                        <>
                          <span className="text-red-500 text-base leading-none">✂</span>
                          <div className="w-0.5 flex-1 bg-red-400 rounded" />
                          <span className="text-red-500 text-base leading-none">✂</span>
                        </>
                      ) : (
                        <span className="text-gray-300 group-hover:text-red-400 text-base transition-colors">+</span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Advanced / range mode toggle */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <span>{showAdvanced ? "▾" : "▸"}</span> Advanced: custom ranges
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <input
                    value={rangeStr}
                    onChange={e => setRangeStr(e.target.value)}
                    placeholder="e.g. 1-3, 4-6, 7-end"
                    className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">Overrides visual splitters above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tools/split/page.tsx
git commit -m "feat: interactive split markers in Split PDF tool"
```

---

## Task 5: Batch Processing — Add Page Numbers and Unlock tools

**Files:**
- Modify: `lib/pdf-tools.ts`
- Modify: `app/tools/batch/page.tsx`

The `batchProcess` function needs two new tool variants. `unlock` uses `PDFDocument.load(bytes, { ignoreEncryption: true })` — same approach as the unlock tool. `page-numbers` calls the existing `addPageNumbers` function.

- [ ] **Step 1: Extend `BatchOptions` and `batchProcess` in `lib/pdf-tools.ts`**

Find the `BatchOptions` type (around line 762) and replace:

```ts
// Before:
export type BatchOptions =
  | { tool: "compress"; quality: "low" | "medium" | "high" }
  | { tool: "rotate"; angle: 90 | 180 | 270 }
  | { tool: "pdf-to-jpg" }
  | { tool: "watermark"; text: string }
  | { tool: "protect"; password: string };

// After:
export type BatchOptions =
  | { tool: "compress"; quality: "low" | "medium" | "high" }
  | { tool: "rotate"; angle: 90 | 180 | 270 }
  | { tool: "pdf-to-jpg" }
  | { tool: "watermark"; text: string }
  | { tool: "protect"; password: string }
  | { tool: "page-numbers"; position?: "bottom-center" | "bottom-right" | "bottom-left" }
  | { tool: "unlock"; password?: string };
```

In the `processFile` function inside `batchProcess` (around line 796), add before the final `else`:

```ts
// Before the final else (result = await protectPDF...):
} else if (options.tool === "page-numbers") {
  result = await addPageNumbers(f, { position: options.position ?? "bottom-center" });
} else if (options.tool === "unlock") {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = await f.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const out = await doc.save();
    result = {
      success: true,
      blob: new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" }),
      filename: f.name.replace(/\.pdf$/i, "_unlocked.pdf"),
    };
  } catch {
    result = { success: false, error: "Wrong password or not encrypted" };
  }
} else {
  result = await protectPDF(f, options.password);
}
```

- [ ] **Step 2: Update `app/tools/batch/page.tsx`**

Add `"page-numbers"` and `"unlock"` to `TOOL_LABELS`:

```ts
// Before:
const TOOL_LABELS: Record<Tool, string> = {
  compress: "Compress",
  rotate: "Rotate",
  "pdf-to-jpg": "PDF to JPG",
  watermark: "Watermark",
  protect: "Protect",
};

// After:
const TOOL_LABELS: Record<Tool, string> = {
  compress: "Compress",
  rotate: "Rotate",
  "pdf-to-jpg": "PDF to JPG",
  watermark: "Watermark",
  protect: "Protect",
  "page-numbers": "Page Numbers",
  unlock: "Unlock",
};
```

Add state for page-numbers position and unlock password (near line 33):

```ts
const [pageNumPosition, setPageNumPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left">("bottom-center");
const [unlockPassword, setUnlockPassword] = useState("");
```

Add UI panels for the new tools (after the `tool === "protect"` block, before the closing `</div>` of the options panel):

```tsx
{tool === "page-numbers" && (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
    <div className="flex gap-2">
      {(["bottom-left", "bottom-center", "bottom-right"] as const).map((p) => (
        <button key={p} onClick={() => setPageNumPosition(p)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors capitalize ${
            pageNumPosition === p ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-red-300"
          }`}>
          {p.replace("bottom-", "")}
        </button>
      ))}
    </div>
  </div>
)}

{tool === "unlock" && (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password (if any)</label>
    <input
      type="password"
      value={unlockPassword}
      onChange={(e) => setUnlockPassword(e.target.value)}
      placeholder="Leave blank if unencrypted"
      className="w-full max-w-xs border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
    />
  </div>
)}
```

Update `buildOptions` to handle the new tools:

```ts
const buildOptions = (): BatchOptions => {
  if (tool === "compress") return { tool: "compress", quality };
  if (tool === "rotate") return { tool: "rotate", angle };
  if (tool === "watermark") return { tool: "watermark", text: watermarkText || "CONFIDENTIAL" };
  if (tool === "protect") return { tool: "protect", password: password || "password" };
  if (tool === "page-numbers") return { tool: "page-numbers", position: pageNumPosition };
  if (tool === "unlock") return { tool: "unlock", password: unlockPassword || undefined };
  return { tool: "pdf-to-jpg" };
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/pdf-tools.ts app/tools/batch/page.tsx
git commit -m "feat: add page-numbers and unlock to batch processing"
```

---

## Task 6: Gate Compress & Watermark Behind Paywall

**Files:**
- Modify: `app/tools/compress/page.tsx`
- Modify: `app/tools/watermark/page.tsx`

Pattern: On mount, read `rizzpdf_bulk_until` from localStorage. If `Date.now() < Number(until)`, user is pro. If not pro, show `PaywallModal` when they click the action button. Allow the action to proceed if pro.

- [ ] **Step 1: Add paywall to Compress**

In `app/tools/compress/page.tsx`, add imports and state:

```tsx
// Extend existing react import line to include useEffect:
import { useState, useCallback, useEffect } from "react";
// Add PaywallModal import:
import PaywallModal from "@/components/PaywallModal";

// Add state (inside CompressPage):
const [isPro, setIsPro] = useState(false);
const [showPaywall, setShowPaywall] = useState(false);

// Add effect after existing useState calls:
useEffect(() => {
  const until = localStorage.getItem("rizzpdf_bulk_until");
  if (until && Date.now() < Number(until)) setIsPro(true);
}, []);
```

Wrap `handleCompress` with paywall check:

```tsx
const handleCompress = async () => {
  if (!file) return;
  if (!isPro) { setShowPaywall(true); return; }
  setStatus("processing");
  // ... rest unchanged
};
```

Add `PaywallModal` to JSX (before closing `</ToolShell>`):

```tsx
{showPaywall && (
  <PaywallModal
    onClose={() => setShowPaywall(false)}
    onPay={() => { setIsPro(true); setShowPaywall(false); }}
  />
)}
```

- [ ] **Step 2: Add paywall to Watermark**

In `app/tools/watermark/page.tsx`, apply the same pattern:

```tsx
// Add to imports:
import PaywallModal from "@/components/PaywallModal";

// Add state:
const [isPro, setIsPro] = useState(false);
const [showPaywall, setShowPaywall] = useState(false);

// Add effect (after existing useEffect):
useEffect(() => {
  const until = localStorage.getItem("rizzpdf_bulk_until");
  if (until && Date.now() < Number(until)) setIsPro(true);
}, []);
```

Wrap `handleApply`:

```tsx
const handleApply = async () => {
  if (!file) return;
  if (!isPro) { setShowPaywall(true); return; }
  setStatus("processing");
  // ... rest unchanged
};
```

Add `PaywallModal` to JSX (before closing `</ToolShell>`):

```tsx
{showPaywall && (
  <PaywallModal
    onClose={() => setShowPaywall(false)}
    onPay={() => { setIsPro(true); setShowPaywall(false); }}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/tools/compress/page.tsx app/tools/watermark/page.tsx
git commit -m "feat: gate Compress and Watermark behind paywall"
```

---

## Task 7: Push and Verify

- [ ] **Step 1: Run build check**

```bash
cd C:\Users\kael_\rizzpdf-app
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 2: Push to deploy**

```bash
git push
```

- [ ] **Step 3: Manual smoke test checklist**

- [ ] Organize: thumbnails noticeably bigger
- [ ] Delete Pages: thumbnails noticeably bigger
- [ ] PDF to JPG: thumbnails noticeably bigger
- [ ] Rotate: thumbnails bigger AND image visually rotates when buttons clicked
- [ ] Merge: drag a file card up/down, number updates, merge produces correct order
- [ ] Split: click between pages → red scissors appear; click again → removed; Split button shows correct segment count
- [ ] Batch: "Page Numbers" and "Unlock" appear in the operation buttons
- [ ] Compress: clicking "Compress PDF →" without pro shows PaywallModal
- [ ] Watermark: clicking "Apply Watermark →" without pro shows PaywallModal

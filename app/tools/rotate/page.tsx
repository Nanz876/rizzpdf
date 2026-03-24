"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import { renderThumbnails, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function RotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading"); setRotations({});
    const t = await renderThumbnails(files[0], 0.4);
    setThumbs(t); setStatus("ready");
  }, []);

  const rotate = (pageNum: number, delta: number) =>
    setRotations(r => ({ ...r, [pageNum]: ((r[pageNum] ?? 0) + delta + 360) % 360 }));

  const rotateAll = (delta: number) =>
    setRotations(r => Object.fromEntries(thumbs.map((_, i) => [i + 1, ((r[i + 1] ?? 0) + delta + 360) % 360])));

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({
    dataUrl: url,
    pageNumber: i + 1,
    label: rotations[i + 1] ? `${rotations[i + 1]}°` : undefined,
    labelColor: "bg-red-600",
  }));

  const handleApply = async () => {
    if (!file) return;
    setStatus("processing");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pgList = doc.getPages();
      pgList.forEach((pg, i) => {
        const deg = rotations[i + 1] ?? 0;
        if (deg !== 0) pg.setRotation({ type: "degrees", angle: (pg.getRotation().angle + deg) % 360 });
      });
      const out = await doc.save();
      downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" }), file.name.replace(/\.pdf$/i, "_rotated.pdf"));
      setStatus("done");
    } catch {
      setError("Rotation failed."); setStatus("error");
    }
  };

  const reset = () => { setFile(null); setThumbs([]); setRotations({}); setStatus("idle"); setError(""); };

  return (
    <ToolShell name="Rotate PDF" description="Rotate individual pages or all pages at once." icon="🔄"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click pages to rotate", "Download result"]}>
      {!file && <UploadZone onFilesAdded={handleFile} disabled={status === "loading"} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
            title="Rotate PDF" subtitle={`${file.name} · ${thumbs.length} pages`}
            onReset={reset}
            secondaryLabel="↺ All left" onSecondary={() => rotateAll(-90)}
            primaryLabel={status === "processing" ? "Rotating…" : status === "done" ? "✓ Downloaded!" : "Apply & Download →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={status === "processing"}
          >
            <button onClick={() => rotateAll(90)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
              ↻ All right
            </button>
          </WorkspaceBar>
          {error && <p className="text-red-500 text-sm px-5 py-3">{error}</p>}
          <div className="p-5 bg-gray-50">
            <ThumbnailGrid pages={pages} showRotateButtons
              onRotateLeft={p => rotate(p, -90)} onRotateRight={p => rotate(p, 90)} columns={4} />
          </div>
        </div>
      )}
    </ToolShell>
  );
}

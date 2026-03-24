"use client";
import { useState, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob, jpgToPdf } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

export default function JpgToPdfPage() {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIdx = useRef<number | null>(null);

  const addImages = (files: File[]) => {
    const valid = files.filter(f => f.type.startsWith("image/"));
    const urls = valid.map(f => URL.createObjectURL(f));
    setImages(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...urls]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    addImages(Array.from(e.dataTransfer.files));
  };

  const onDragStart = (idx: number) => { dragIdx.current = idx; };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const from = dragIdx.current;
    dragIdx.current = idx;
    setImages(prev => { const a = [...prev]; const [el] = a.splice(from, 1); a.splice(idx, 0, el); return a; });
    setPreviews(prev => { const a = [...prev]; const [el] = a.splice(from, 1); a.splice(idx, 0, el); return a; });
  };

  const handleConvert = async () => {
    if (images.length === 0) return;
    setStatus("processing");
    const result = await jpgToPdf(images);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? "images.pdf");
      setStatus("done");
    } else { setError(result.error ?? "Conversion failed."); setStatus("error"); }
  };

  const reset = () => {
    previews.forEach(url => URL.revokeObjectURL(url));
    setImages([]); setPreviews([]); setStatus("idle"); setError("");
  };

  return (
    <ToolShell name="JPG to PDF" description="Convert JPG and PNG images into a PDF document." icon="📄"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><circle cx="9" cy="9" r="2" fill="white" opacity=".6"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      steps={images.length === 0 ? ["Upload images", "Arrange order", "Convert to PDF"] : undefined}>
      {images.length === 0 ? (
        <div
          onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all
            ${dragOver ? "border-red-500 bg-red-50" : "border-gray-200 bg-gray-50 hover:border-red-400"}`}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={e => { if (e.target.files) { addImages(Array.from(e.target.files)); e.target.value = ""; } }} />
          <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-bold text-gray-800">Drop your images here</p>
          <p className="text-sm text-gray-500 mt-1">or <span className="text-red-600 font-semibold">click to browse</span> — JPG, PNG supported</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="2"/><circle cx="8" cy="8" r="1.5" fill="white"/></svg>}
            title="JPG to PDF" subtitle={`${images.length} image${images.length !== 1 ? "s" : ""}`}
            onReset={reset}
            secondaryLabel="+ Add more" onSecondary={() => fileInputRef.current?.click()}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : "Convert to PDF →"}
            onPrimary={status === "done" ? reset : handleConvert}
            primaryDisabled={status === "processing"} />
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files) { addImages(Array.from(e.target.files)); e.target.value = ""; } }} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <div className="p-5 bg-gray-50">
            <p className="text-xs text-gray-400 mb-3">Drag to reorder</p>
            <div className="grid grid-cols-4 gap-3">
              {previews.map((url, i) => (
                <div key={i}
                  draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)}
                  className="relative bg-white rounded-xl border-2 border-gray-100 overflow-hidden shadow-sm cursor-grab active:cursor-grabbing hover:border-red-300 transition-colors">
                  <div className="aspect-[3/4] overflow-hidden bg-gray-50">
                    <img src={url} alt={images[i].name} draggable={false} className="w-full h-full object-cover" />
                  </div>
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs transition-colors">✕</button>
                  <div className="px-2 py-1 text-xs text-gray-400 truncate">{images[i].name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

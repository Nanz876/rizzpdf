"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { signPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";
type SigMode = "draw" | "upload";

// Canvas-based white/near-white background removal
async function removeWhiteBackground(dataUrl: string, threshold = 220): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        // Perceptual brightness
        const brightness = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (brightness > threshold) {
          d[i + 3] = 0; // fully transparent
        } else if (brightness > threshold - 50) {
          // Soft edge fade
          d[i + 3] = Math.round(((threshold - brightness) / 50) * 255);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

export default function SignPage() {
  // PDF state
  const [file, setFile] = useState<File | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewNaturalSize, setPreviewNaturalSize] = useState({ w: 600, h: 800 });
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Signature state
  const [sigMode, setSigMode] = useState<SigMode>("draw");
  const [sigDataUrl, setSigDataUrl] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Placement state
  const [sigPos, setSigPos] = useState({ x: 60, y: 300 });
  const [sigWidthRatio, setSigWidthRatio] = useState(0.28);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const sigImgRef = useRef<HTMLImageElement>(null);

  // Status
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [removingBg, setRemovingBg] = useState(false);

  // ─── Render PDF preview ───────────────────────────────────────────────────

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoadingPreview(true);
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const bytes = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
        if (!cancelled) setTotalPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
        if (!cancelled) {
          setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
          setPreviewNaturalSize({ w: viewport.width, h: viewport.height });
          setLoadingPreview(false);
        }
      } catch {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file, pageNum]);

  // ─── Draw canvas init ─────────────────────────────────────────────────────

  const initCanvas = useCallback(() => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (sigMode === "draw") initCanvas();
  }, [sigMode, initCanvas]);

  const getDrawCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = drawCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (c.width / rect.width),
      y: (src.clientY - rect.top) * (c.height / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getDrawCoords(e);
    const ctx = drawCanvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const onDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getDrawCoords(e);
    const ctx = drawCanvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearDraw = () => {
    initCanvas();
    setSigDataUrl("");
  };

  const useDrawnSignature = () => {
    const url = drawCanvasRef.current!.toDataURL("image/png");
    setSigDataUrl(url);
  };

  // ─── Upload + background removal ─────────────────────────────────────────

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target!.result as string;
      setUploadedUrl(url);
      setSigDataUrl(url);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const handleRemoveBg = async () => {
    if (!uploadedUrl) return;
    setRemovingBg(true);
    const cleaned = await removeWhiteBackground(uploadedUrl);
    setSigDataUrl(cleaned);
    setRemovingBg(false);
  };

  // ─── Drag to position signature on preview ────────────────────────────────

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = previewContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const containerW = rect.width;
      const containerH = previewNaturalSize.h * (containerW / previewNaturalSize.w);
      const sigWidthPx = containerW * sigWidthRatio;
      const sigH = sigImgRef.current ? (sigImgRef.current.naturalHeight / sigImgRef.current.naturalWidth) * sigWidthPx : 60;
      const newX = Math.max(0, Math.min(containerW - sigWidthPx, clientX - rect.left - dragOffset.current.x));
      const newY = Math.max(0, Math.min(containerH - sigH, clientY - rect.top - dragOffset.current.y));
      setSigPos({ x: newX, y: newY });
    };

    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [isDragging, sigWidthRatio, previewNaturalSize]);

  const startDragSig = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = previewContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragOffset.current = {
      x: clientX - rect.left - sigPos.x,
      y: clientY - rect.top - sigPos.y,
    };
    setIsDragging(true);
  };

  // ─── Apply signature ──────────────────────────────────────────────────────

  const handleSign = async () => {
    if (!file || !sigDataUrl) return;
    const containerW = previewContainerRef.current?.clientWidth || 600;
    const containerH = previewNaturalSize.h * (containerW / previewNaturalSize.w);
    const sigWidthPx = containerW * sigWidthRatio;
    const sigH = sigImgRef.current
      ? (sigImgRef.current.naturalHeight / sigImgRef.current.naturalWidth) * sigWidthPx
      : sigWidthPx * 0.4;

    // Normalize: x is left position, y is bottom-up (PDF coords)
    const normX = Math.max(0, Math.min(1, sigPos.x / Math.max(1, containerW - sigWidthPx)));
    const normY = Math.max(0, Math.min(1, 1 - (sigPos.y + sigH) / containerH));

    setStatus("processing");
    setErrorMsg("");

    const result = await signPDF(file, {
      signatureDataUrl: sigDataUrl,
      page: pageNum,
      x: normX,
      y: normY,
      widthRatio: sigWidthRatio,
    });

    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      setStatus("done");
    } else {
      setErrorMsg(result.error ?? "Failed to sign PDF.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl("");
    setPageNum(1);
    setTotalPages(1);
    setSigDataUrl("");
    setUploadedUrl("");
    clearDraw();
    setStatus("idle");
    setErrorMsg("");
    setSigPos({ x: 60, y: 300 });
  };

  // ─── Derived layout values ────────────────────────────────────────────────

  const containerW = previewContainerRef.current?.clientWidth ?? 600;
  const renderedH = previewNaturalSize.h * (containerW / previewNaturalSize.w);
  const sigWidthPx = containerW * sigWidthRatio;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ToolShell
      name="Sign PDF"
      description="Place your signature exactly where you want it on your PDF."
      icon="✍️"
    >
      <div className="space-y-4">
        {!file ? (
          <UploadZone onFilesAdded={(files) => setFile(files[0])} />
        ) : status === "done" ? (
          <div className="space-y-3 text-center">
            <div className="text-4xl">✅</div>
            <p className="font-semibold text-green-600">Signed PDF downloaded!</p>
            <button
              onClick={reset}
              className="w-full bg-purple-600 text-white py-3 rounded-2xl font-bold hover:bg-purple-700 transition-colors"
            >
              Sign another PDF
            </button>
          </div>
        ) : (
          <>
            {/* ── PDF Preview + draggable sig ─────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-2">
                <p className="text-sm font-medium text-gray-700 truncate flex-1 min-w-0">{file.name}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                    disabled={pageNum <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-purple-400 disabled:opacity-30 text-lg leading-none"
                  >‹</button>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {pageNum} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                    disabled={pageNum >= totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-purple-400 disabled:opacity-30 text-lg leading-none"
                  >›</button>
                  <span className="w-px h-4 bg-gray-200" />
                  <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Remove
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div
                ref={previewContainerRef}
                className="relative overflow-hidden"
                style={{ height: renderedH > 0 ? renderedH : undefined, minHeight: 200 }}
              >
                {loadingPreview && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                    <span className="text-sm text-gray-400 animate-pulse">Rendering page…</span>
                  </div>
                )}
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="PDF page preview"
                    className="w-full block select-none"
                    draggable={false}
                  />
                )}

                {/* Draggable signature overlay */}
                {sigDataUrl && previewUrl && (
                  <div
                    style={{
                      position: "absolute",
                      left: sigPos.x,
                      top: sigPos.y,
                      width: sigWidthPx,
                      cursor: isDragging ? "grabbing" : "grab",
                      userSelect: "none",
                    }}
                    onMouseDown={startDragSig}
                    onTouchStart={startDragSig}
                  >
                    <img
                      ref={sigImgRef}
                      src={sigDataUrl}
                      alt="Signature"
                      style={{ width: "100%", display: "block" }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-purple-500 rounded pointer-events-none" />
                  </div>
                )}

                {sigDataUrl && previewUrl && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                    <span className="text-xs bg-purple-600 text-white px-3 py-1 rounded-full opacity-80">
                      Drag to reposition
                    </span>
                  </div>
                )}
              </div>

              {/* Size slider */}
              {sigDataUrl && (
                <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500 shrink-0">Size</span>
                  <input
                    type="range"
                    min={0.08}
                    max={0.65}
                    step={0.01}
                    value={sigWidthRatio}
                    onChange={(e) => setSigWidthRatio(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-600"
                  />
                  <span className="text-xs text-gray-400 w-8 text-right">{Math.round(sigWidthRatio * 100)}%</span>
                </div>
              )}
            </div>

            {/* ── Signature creator ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {(["draw", "upload"] as SigMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSigMode(m)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      sigMode === m ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {m === "draw" ? "✏️ Draw" : "📷 Upload Image"}
                  </button>
                ))}
              </div>

              {sigMode === "draw" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Draw your signature</p>
                    <button
                      onClick={clearDraw}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <canvas
                    ref={drawCanvasRef}
                    width={600}
                    height={160}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl cursor-crosshair touch-none bg-white"
                    onMouseDown={startDraw}
                    onMouseMove={onDraw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={onDraw}
                    onTouchEnd={stopDraw}
                  />
                  <button
                    onClick={useDrawnSignature}
                    className="mt-3 w-full border border-purple-300 text-purple-700 py-2 rounded-xl text-sm font-semibold hover:bg-purple-50 transition-colors"
                  >
                    Use This Signature →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-purple-400 transition-colors">
                      {uploadedUrl ? (
                        <img
                          src={uploadedUrl}
                          alt="Uploaded"
                          className="max-h-24 mx-auto object-contain"
                        />
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-600">Click to upload signature image</p>
                          <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — any format</p>
                        </>
                      )}
                    </div>
                  </label>

                  {uploadedUrl && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleRemoveBg}
                        disabled={removingBg}
                        className="flex-1 bg-purple-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                      >
                        {removingBg ? "Removing…" : "✨ Remove Background"}
                      </button>
                      <button
                        onClick={() => setSigDataUrl(uploadedUrl)}
                        className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Use Original
                      </button>
                    </div>
                  )}

                  {/* Preview on checkered bg to show transparency */}
                  {sigDataUrl && sigDataUrl !== uploadedUrl && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Preview (transparency shown):</p>
                      <div
                        className="rounded-xl p-3 flex justify-center"
                        style={{
                          background: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
                        }}
                      >
                        <img
                          src={sigDataUrl}
                          alt="Cleaned signature"
                          className="max-h-20 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Action button ────────────────────────────────────────── */}
            {status === "error" && (
              <p className="text-center text-red-500 text-sm">{errorMsg}</p>
            )}
            <button
              onClick={handleSign}
              disabled={!sigDataUrl || status === "processing"}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-2xl font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {status === "processing" ? "Signing…" : "Apply Signature →"}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}

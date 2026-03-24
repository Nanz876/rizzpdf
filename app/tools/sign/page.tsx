"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { PDFDocument } from "pdf-lib";
import { downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

interface Placement {
  pageIndex: number;
  xFrac: number;
  yFrac: number;
}

const PAGE_BASE_WIDTH = 620; // px at zoom 1
const RENDER_SCALE = 1.5;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function removeWhiteBackground(dataUrl: string, threshold = 230): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        if (d.data[i] > threshold && d.data[i + 1] > threshold && d.data[i + 2] > threshold) {
          d.data[i + 3] = 0;
        }
      }
      ctx.putImageData(d, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

export default function SignPage() {
  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [pdfSizes, setPdfSizes] = useState<{ w: number; h: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Signature
  const [sigTab, setSigTab] = useState<"draw" | "upload">("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [origUpload, setOrigUpload] = useState<string | null>(null); // pre-bg-removal
  const [bgRemoved, setBgRemoved] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawRef = useRef<HTMLCanvasElement>(null);

  // Placement + drag
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragData = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  // Resize
  const [sigWidthFrac, setSigWidthFrac] = useState(0.22);
  const [isResizing, setIsResizing] = useState(false);
  const resizeData = useRef<{ startX: number; startFrac: number; pageWidth: number } | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageImgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const sigDivRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");

  // Init draw canvas
  useEffect(() => {
    const c = drawRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // Render PDF
  useEffect(() => {
    if (!pdfFile) return;
    setLoading(true);
    setPageUrls([]);
    setPdfSizes([]);
    setPlacement(null);
    let alive = true;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const data = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
        const urls: string[] = [];
        const sizes: { w: number; h: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!alive) return;
          const pg = await pdf.getPage(i);
          const vp = pg.getViewport({ scale: RENDER_SCALE });
          const vp1 = pg.getViewport({ scale: 1 });
          const c = document.createElement("canvas");
          c.width = vp.width;
          c.height = vp.height;
          await pg.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp }).promise;
          urls.push(c.toDataURL("image/jpeg", 0.92));
          sizes.push({ w: vp1.width, h: vp1.height });
        }
        if (alive) { setPageUrls(urls); setPdfSizes(sizes); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [pdfFile]);

  // Drawing
  const getDrawXY = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = drawRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ("touches" in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const onDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = drawRef.current!.getContext("2d")!;
    const { x, y } = getDrawXY(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const onDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = drawRef.current!.getContext("2d")!;
    const { x, y } = getDrawXY(e);
    ctx.lineTo(x, y); ctx.stroke();
    setHasDrawn(true);
  };

  const onDrawEnd = () => setIsDrawing(false);

  const clearDraw = useCallback(() => {
    const c = drawRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasDrawn(false);
    setSigDataUrl(null);
    setPlacement(null);
  }, []);

  const useSig = () => {
    if (!hasDrawn || !drawRef.current || !pageUrls.length) return;
    setSigDataUrl(drawRef.current.toDataURL("image/png"));
    setPlacement({ pageIndex: 0, xFrac: 0.63, yFrac: 0.80 });
  };

  // Upload + background removal
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !pageUrls.length) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target!.result as string;
      setOrigUpload(url);
      setSigDataUrl(url);
      setBgRemoved(false);
      setPlacement({ pageIndex: 0, xFrac: 0.63, yFrac: 0.80 });
    };
    reader.readAsDataURL(f);
  };

  const toggleBgRemoval = async () => {
    if (!origUpload) return;
    if (!bgRemoved) {
      const cleaned = await removeWhiteBackground(origUpload);
      setSigDataUrl(cleaned);
      setBgRemoved(true);
    } else {
      setSigDataUrl(origUpload);
      setBgRemoved(false);
    }
  };

  // Click page to place
  const handlePageClick = (e: React.MouseEvent<HTMLImageElement>, pageIndex: number) => {
    if (!sigDataUrl || dragging || isResizing) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPlacement({
      pageIndex,
      xFrac: Math.max(0, Math.min(1 - sigWidthFrac, (e.clientX - r.left) / r.width - sigWidthFrac / 2)),
      yFrac: Math.max(0, Math.min(0.94, (e.clientY - r.top) / r.height - 0.04)),
    });
  };

  // Drag signature
  const onSigPtrDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!placement || isResizing) return;
    sigDivRef.current?.setPointerCapture(e.pointerId);
    dragData.current = { startX: e.clientX, startY: e.clientY, ox: placement.xFrac, oy: placement.yFrac };
    setDragging(true);
  };

  const onSigPtrMove = (e: React.PointerEvent) => {
    if (!dragging || !dragData.current || !placement) return;
    e.preventDefault();
    const pageImg = pageImgRefs.current[placement.pageIndex];
    if (!pageImg) return;
    const pr = pageImg.getBoundingClientRect();
    const dx = (e.clientX - dragData.current.startX) / pr.width;
    const dy = (e.clientY - dragData.current.startY) / pr.height;
    setPlacement(p => p ? {
      ...p,
      xFrac: Math.max(0, Math.min(1 - sigWidthFrac, dragData.current!.ox + dx)),
      yFrac: Math.max(0, Math.min(0.94, dragData.current!.oy + dy)),
    } : p);
  };

  const onSigPtrUp = () => { setDragging(false); setIsResizing(false); };

  // Resize signature
  const onResizePtrDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!placement) return;
    const pageImg = pageImgRefs.current[placement.pageIndex];
    if (!pageImg) return;
    resizeHandleRef.current?.setPointerCapture(e.pointerId);
    resizeData.current = { startX: e.clientX, startFrac: sigWidthFrac, pageWidth: pageImg.getBoundingClientRect().width };
    setIsResizing(true);
  };

  const onResizePtrMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeData.current) return;
    e.preventDefault();
    const dx = e.clientX - resizeData.current.startX;
    setSigWidthFrac(Math.max(0.06, Math.min(0.70, resizeData.current.startFrac + dx / resizeData.current.pageWidth)));
  };

  const onResizePtrUp = () => setIsResizing(false);

  // Zoom
  const zoomIn = () => setZoom(z => Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], ZOOM_STEPS[ZOOM_STEPS.indexOf(z) + 1] ?? z * 1.25));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_STEPS[0], ZOOM_STEPS[ZOOM_STEPS.indexOf(z) - 1] ?? z * 0.8));

  // Signature overlay position
  const getOverlayStyle = (): React.CSSProperties | null => {
    if (!placement || !sigDataUrl) return null;
    const scroll = scrollRef.current;
    const pageImg = pageImgRefs.current[placement.pageIndex];
    if (!scroll || !pageImg) return null;
    const cr = scroll.getBoundingClientRect();
    const pr = pageImg.getBoundingClientRect();
    return {
      position: "absolute",
      left: (pr.left - cr.left) + scroll.scrollLeft + placement.xFrac * pr.width,
      top: (pr.top - cr.top) + scroll.scrollTop + placement.yFrac * pr.height,
      width: pr.width * sigWidthFrac,
      cursor: dragging ? "grabbing" : "grab",
      touchAction: "none",
      zIndex: 10,
      userSelect: "none",
    };
  };

  // Sign
  const handleSign = async () => {
    if (!pdfFile || !sigDataUrl || !placement || placement.pageIndex >= pdfSizes.length) return;
    setStatus("processing"); setErr("");
    try {
      const bytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pg = doc.getPages()[placement.pageIndex];
      const { width: pw, height: ph } = pg.getSize();
      const resp = await fetch(sigDataUrl);
      const sigBytes = await resp.arrayBuffer();
      const isPng = sigDataUrl.startsWith("data:image/png");
      const img = isPng ? await doc.embedPng(sigBytes) : await doc.embedJpg(sigBytes);
      const sw = pw * sigWidthFrac;
      const sh = (img.height / img.width) * sw;
      pg.drawImage(img, {
        x: placement.xFrac * pw,
        y: ph - placement.yFrac * ph - sh,
        width: sw,
        height: sh,
      });
      const out = await doc.save();
      downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" }), pdfFile.name.replace(/\.pdf$/i, "_signed.pdf"));
      setStatus("done");
    } catch {
      setErr("Failed to sign PDF. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setPdfFile(null); setPageUrls([]); setPdfSizes([]);
    setSigDataUrl(null); setOrigUpload(null); setBgRemoved(false);
    setPlacement(null); setStatus("idle"); setErr("");
    setZoom(1); setSigWidthFrac(0.22);
    clearDraw();
  };

  const overlayStyle = getOverlayStyle();
  const canSign = !!sigDataUrl && !!placement && status !== "processing";
  const pageDisplayWidth = PAGE_BASE_WIDTH * zoom;

  return (
    <ToolShell name="Sign PDF" description="Draw your signature and drag it anywhere on your PDF." icon="✍️"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.8"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 20h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}>
      <div className="space-y-4">
        {!pdfFile && (
          <UploadZone onFilesAdded={f => { setPdfFile(f[0]); setStatus("idle"); setErr(""); }} disabled={false} />
        )}

        {pdfFile && (
          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ─── LEFT PANEL ─── */}
            <div className="w-full lg:w-64 shrink-0 space-y-3">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">

                {/* File */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700 truncate max-w-[160px]">{pdfFile.name}</p>
                  <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 ml-2 shrink-0">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
                  {(["draw", "upload"] as const).map(t => (
                    <button key={t} onClick={() => setSigTab(t)}
                      className={`flex-1 py-2 font-medium transition-colors capitalize ${sigTab === t ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* Draw */}
                {sigTab === "draw" && (
                  <div className="space-y-2">
                    <canvas ref={drawRef} width={400} height={140}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl cursor-crosshair touch-none bg-white"
                      onMouseDown={onDrawStart} onMouseMove={onDrawMove} onMouseUp={onDrawEnd} onMouseLeave={onDrawEnd}
                      onTouchStart={onDrawStart} onTouchMove={onDrawMove} onTouchEnd={onDrawEnd} />
                    <p className="text-xs text-gray-400 text-center">Draw your signature above</p>
                    <div className="flex gap-2">
                      <button onClick={clearDraw} className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Clear</button>
                      <button onClick={useSig} disabled={!hasDrawn || !pageUrls.length}
                        className="flex-1 py-2 text-xs font-bold bg-red-600 text-white rounded-xl disabled:opacity-40 hover:bg-red-700">
                        Use Signature
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload */}
                {sigTab === "upload" && (
                  <div className="space-y-2">
                    <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-red-300 transition-colors">
                      <span className="text-3xl">🖼️</span>
                      <span className="text-sm text-gray-500 font-medium">Upload signature image</span>
                      <span className="text-xs text-gray-400">PNG, JPG, WEBP</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} disabled={!pageUrls.length} />
                    </label>
                    {origUpload && (
                      <button onClick={toggleBgRemoval}
                        className={`w-full py-2 text-xs font-semibold rounded-xl border transition-colors ${bgRemoved ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:border-red-300"}`}>
                        {bgRemoved ? "✓ Background removed" : "Remove white background"}
                      </button>
                    )}
                  </div>
                )}

                {/* Sig preview */}
                {sigDataUrl && (
                  <div className="border border-red-200 rounded-xl p-3 bg-red-50 space-y-1" style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 12px 12px" }}>
                    <img src={sigDataUrl} alt="Signature" className="max-h-14 object-contain mx-auto" draggable={false} />
                    <p className="text-xs text-center text-red-600 font-medium mt-1">
                      {placement ? "Drag to reposition · corner to resize" : "Click on the PDF to place"}
                    </p>
                  </div>
                )}

                {!sigDataUrl && pageUrls.length > 0 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    {sigTab === "draw" ? `Draw above, then click "Use Signature"` : "Upload your signature image"}
                  </p>
                )}
              </div>

              {/* CTA */}
              {status === "done" ? (
                <div className="space-y-2 text-center">
                  <p className="text-green-600 font-semibold text-sm">✓ Signed PDF downloaded!</p>
                  <button onClick={reset} className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-sm hover:bg-red-700">Sign another PDF</button>
                </div>
              ) : (
                <>
                  {err && <p className="text-red-500 text-xs text-center">{err}</p>}
                  <button onClick={handleSign} disabled={!canSign}
                    className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 hover:bg-red-700 transition-colors">
                    {status === "processing" ? "Signing…" : !sigDataUrl ? "Create a signature first" : !placement ? "Place signature on the PDF" : "Sign & Download PDF"}
                  </button>
                </>
              )}
            </div>

            {/* ─── RIGHT PANEL: PDF ─── */}
            <div className="flex-1 min-w-0 space-y-2">

              {/* Zoom controls */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-gray-500 font-medium">Zoom</span>
                <button onClick={zoomOut} disabled={zoom <= ZOOM_STEPS[0]}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold flex items-center justify-center">−</button>
                <span className="text-xs text-gray-700 font-semibold w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={zoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold flex items-center justify-center">+</button>
                <button onClick={() => setZoom(1)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Reset</button>
              </div>

              {/* PDF scroll area */}
              <div ref={scrollRef} className="relative overflow-auto bg-gray-300 rounded-2xl border border-gray-200" style={{ height: "70vh" }}>
                {loading && (
                  <div className="flex items-center justify-center h-full gap-2">
                    <svg className="animate-spin h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span className="text-gray-500 text-sm">Rendering pages…</span>
                  </div>
                )}

                <div className="flex flex-col items-center gap-4 p-4" style={{ minWidth: pageDisplayWidth + 32 }}>
                  {pageUrls.map((url, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img
                        ref={el => { pageImgRefs.current[i] = el; }}
                        src={url}
                        alt={`Page ${i + 1}`}
                        draggable={false}
                        onClick={e => handlePageClick(e, i)}
                        style={{ width: pageDisplayWidth, maxWidth: "none", display: "block", cursor: sigDataUrl ? (placement ? "default" : "crosshair") : "default" }}
                        className="shadow-xl"
                      />
                      {pageUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                          {i + 1} / {pageUrls.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Draggable signature */}
                {overlayStyle && sigDataUrl && (
                  <div ref={sigDivRef} style={overlayStyle}
                    onPointerDown={onSigPtrDown}
                    onPointerMove={e => { onSigPtrMove(e); onResizePtrMove(e); }}
                    onPointerUp={onSigPtrUp}
                    onPointerCancel={onSigPtrUp}>

                    <div className="absolute -top-6 left-0 bg-red-600 text-white text-xs px-2 py-0.5 rounded-md whitespace-nowrap shadow pointer-events-none">
                      ↕ Drag to move
                    </div>

                    <img src={sigDataUrl} alt="Signature" draggable={false}
                      className="w-full select-none border-2 border-red-400 border-dashed rounded"
                      style={{ userSelect: "none", display: "block" }} />

                    {/* Resize handle */}
                    <div
                      ref={resizeHandleRef}
                      onPointerDown={onResizePtrDown}
                      onPointerMove={onResizePtrMove}
                      onPointerUp={onResizePtrUp}
                      onPointerCancel={onResizePtrUp}
                      style={{
                        position: "absolute", bottom: -5, right: -5,
                        width: 14, height: 14,
                        background: "#7c3aed", border: "2px solid white",
                        borderRadius: 3, cursor: "se-resize", touchAction: "none",
                      }}
                    />
                  </div>
                )}

                {/* Placement hint */}
                {!loading && pageUrls.length > 0 && sigDataUrl && !placement && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="bg-red-600/90 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
                      Click anywhere on the PDF to place your signature
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}

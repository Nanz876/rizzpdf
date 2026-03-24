"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { PDFDocument } from "pdf-lib";
import { downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "processing" | "done" | "error";

interface Placement {
  pageIndex: number;
  xFrac: number; // 0–1, left edge of sig relative to page width
  yFrac: number; // 0–1, top edge of sig relative to page height
}

const SIG_W_FRAC = 0.22; // signature width = 22% of page width
const RENDER_SCALE = 1.5;

export default function SignPage() {
  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [pdfSizes, setPdfSizes] = useState<{ w: number; h: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // Signature
  const [sigTab, setSigTab] = useState<"draw" | "upload">("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawRef = useRef<HTMLCanvasElement>(null);

  // Placement + drag
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragData = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

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

  // Render PDF pages
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
        if (alive) {
          setPageUrls(urls);
          setPdfSizes(sizes);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [pdfFile]);

  // Drawing helpers
  const getDrawXY = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = drawRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    }
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const onDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = drawRef.current!.getContext("2d")!;
    const { x, y } = getDrawXY(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const onDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = drawRef.current!.getContext("2d")!;
    const { x, y } = getDrawXY(e);
    ctx.lineTo(x, y);
    ctx.stroke();
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !pageUrls.length) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSigDataUrl(ev.target!.result as string);
      setPlacement({ pageIndex: 0, xFrac: 0.63, yFrac: 0.80 });
    };
    reader.readAsDataURL(f);
  };

  // Click on a page to place/move signature
  const handlePageClick = (e: React.MouseEvent<HTMLImageElement>, pageIndex: number) => {
    if (!sigDataUrl || dragging) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPlacement({
      pageIndex,
      xFrac: Math.max(0, Math.min(1 - SIG_W_FRAC, (e.clientX - r.left) / r.width - SIG_W_FRAC / 2)),
      yFrac: Math.max(0, Math.min(0.94, (e.clientY - r.top) / r.height - 0.04)),
    });
  };

  // Drag the signature
  const onSigPtrDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!placement) return;
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
    setPlacement(p =>
      p ? {
        ...p,
        xFrac: Math.max(0, Math.min(1 - SIG_W_FRAC, dragData.current!.ox + dx)),
        yFrac: Math.max(0, Math.min(0.94, dragData.current!.oy + dy)),
      } : p
    );
  };

  const onSigPtrUp = () => setDragging(false);

  // Compute overlay CSS position within the scroll container
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
      width: pr.width * SIG_W_FRAC,
      cursor: dragging ? "grabbing" : "grab",
      touchAction: "none",
      zIndex: 10,
      userSelect: "none",
    };
  };

  // Sign the PDF
  const handleSign = async () => {
    if (!pdfFile || !sigDataUrl || !placement || placement.pageIndex >= pdfSizes.length) return;
    setStatus("processing");
    setErr("");
    try {
      const bytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pg = doc.getPages()[placement.pageIndex];
      const { width: pw, height: ph } = pg.getSize();

      const resp = await fetch(sigDataUrl);
      const sigBytes = await resp.arrayBuffer();
      const isPng = sigDataUrl.startsWith("data:image/png");
      const img = isPng ? await doc.embedPng(sigBytes) : await doc.embedJpg(sigBytes);

      const sw = pw * SIG_W_FRAC;
      const sh = (img.height / img.width) * sw;

      pg.drawImage(img, {
        x: placement.xFrac * pw,
        y: ph - placement.yFrac * ph - sh, // PDF origin = bottom-left
        width: sw,
        height: sh,
      });

      const out = await doc.save();
      downloadBlob(
        new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" }),
        pdfFile.name.replace(/\.pdf$/i, "_signed.pdf")
      );
      setStatus("done");
    } catch {
      setErr("Failed to sign PDF. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setPdfFile(null);
    setPageUrls([]);
    setPdfSizes([]);
    setSigDataUrl(null);
    setPlacement(null);
    setStatus("idle");
    setErr("");
    clearDraw();
  };

  const overlayStyle = getOverlayStyle();
  const canSign = !!sigDataUrl && !!placement && status !== "processing";

  return (
    <ToolShell
      name="Sign PDF"
      description="Draw your signature and drag it anywhere on your PDF."
      icon="✍️"
    >
      <div className="space-y-4">
        {!pdfFile && (
          <UploadZone
            onFilesAdded={f => { setPdfFile(f[0]); setStatus("idle"); setErr(""); }}
            disabled={false}
          />
        )}

        {pdfFile && (
          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ─── LEFT PANEL ─── */}
            <div className="w-full lg:w-64 shrink-0 space-y-3">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">

                {/* File name */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700 truncate max-w-[160px]">{pdfFile.name}</p>
                  <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 ml-2 shrink-0">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
                  {(["draw", "upload"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setSigTab(t)}
                      className={`flex-1 py-2 font-medium transition-colors capitalize ${sigTab === t ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Draw tab */}
                {sigTab === "draw" && (
                  <div className="space-y-2">
                    <canvas
                      ref={drawRef}
                      width={400}
                      height={140}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl cursor-crosshair touch-none bg-white"
                      onMouseDown={onDrawStart}
                      onMouseMove={onDrawMove}
                      onMouseUp={onDrawEnd}
                      onMouseLeave={onDrawEnd}
                      onTouchStart={onDrawStart}
                      onTouchMove={onDrawMove}
                      onTouchEnd={onDrawEnd}
                    />
                    <p className="text-xs text-gray-400 text-center">Draw your signature above</p>
                    <div className="flex gap-2">
                      <button
                        onClick={clearDraw}
                        className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        onClick={useSig}
                        disabled={!hasDrawn || !pageUrls.length}
                        className="flex-1 py-2 text-xs font-bold bg-purple-600 text-white rounded-xl disabled:opacity-40 hover:bg-purple-700 transition-colors"
                      >
                        Use Signature
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload tab */}
                {sigTab === "upload" && (
                  <label className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 transition-colors">
                    <span className="text-3xl">🖼️</span>
                    <span className="text-sm text-gray-500 font-medium">Upload signature image</span>
                    <span className="text-xs text-gray-400">PNG with transparent bg works best</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={!pageUrls.length}
                    />
                  </label>
                )}

                {/* Signature preview */}
                {sigDataUrl && (
                  <div className="border border-purple-200 rounded-xl p-3 bg-purple-50 space-y-1">
                    <p className="text-xs font-semibold text-purple-700">Signature ready</p>
                    <img src={sigDataUrl} alt="Signature" className="max-h-12 object-contain" draggable={false} />
                    <p className="text-xs text-purple-500">
                      {placement ? "Drag it to reposition →" : "Click on the PDF to place it →"}
                    </p>
                  </div>
                )}

                {!sigDataUrl && pageUrls.length > 0 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    {sigTab === "draw" ? "Draw above, then click Use Signature" : "Upload your signature image"}
                  </p>
                )}
              </div>

              {/* CTA */}
              {status === "done" ? (
                <div className="space-y-2 text-center">
                  <p className="text-green-600 font-semibold text-sm">✓ Signed PDF downloaded!</p>
                  <button onClick={reset} className="w-full bg-purple-600 text-white py-3 rounded-2xl font-bold text-sm hover:bg-purple-700">
                    Sign another PDF
                  </button>
                </div>
              ) : (
                <>
                  {err && <p className="text-red-500 text-xs text-center">{err}</p>}
                  <button
                    onClick={handleSign}
                    disabled={!canSign}
                    className="w-full bg-purple-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 hover:bg-purple-700 transition-colors"
                  >
                    {status === "processing"
                      ? "Signing…"
                      : !sigDataUrl
                      ? "Create a signature first"
                      : !placement
                      ? "Place signature on the PDF"
                      : "Sign & Download PDF"}
                  </button>
                </>
              )}
            </div>

            {/* ─── RIGHT PANEL: PDF PREVIEW ─── */}
            <div className="flex-1 min-w-0">
              <div
                ref={scrollRef}
                className="relative overflow-auto bg-gray-200 rounded-2xl border border-gray-200"
                style={{ height: "72vh" }}
              >
                {loading && (
                  <div className="flex items-center justify-center h-full gap-2">
                    <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span className="text-gray-500 text-sm">Rendering pages…</span>
                  </div>
                )}

                {/* Pages */}
                <div className="flex flex-col items-center gap-4 p-4">
                  {pageUrls.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        ref={el => { pageImgRefs.current[i] = el; }}
                        src={url}
                        alt={`Page ${i + 1}`}
                        draggable={false}
                        onClick={e => handlePageClick(e, i)}
                        className="shadow-lg block"
                        style={{
                          cursor: sigDataUrl ? (placement ? "default" : "crosshair") : "default",
                          maxWidth: "100%",
                        }}
                      />
                      {pageUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                          {i + 1} / {pageUrls.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Signature overlay (draggable) */}
                {overlayStyle && sigDataUrl && (
                  <div
                    ref={sigDivRef}
                    style={overlayStyle}
                    onPointerDown={onSigPtrDown}
                    onPointerMove={onSigPtrMove}
                    onPointerUp={onSigPtrUp}
                    onPointerCancel={onSigPtrUp}
                  >
                    <div className="absolute -top-6 left-0 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-md whitespace-nowrap shadow">
                      ↕ Drag to move
                    </div>
                    <img
                      src={sigDataUrl}
                      alt="Signature"
                      draggable={false}
                      className="w-full select-none border-2 border-purple-400 border-dashed rounded"
                      style={{ userSelect: "none" }}
                    />
                  </div>
                )}

                {/* Hint when sig is ready but not placed */}
                {!loading && pageUrls.length > 0 && sigDataUrl && !placement && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="bg-purple-600/90 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
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

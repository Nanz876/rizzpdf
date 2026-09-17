"use client";
import { logTool } from "@/lib/logTool";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { downloadBlob, type SignItem, type ToolResult } from "@/lib/pdf-tools";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "processing" | "done" | "error";
type SigTab = "draw" | "upload" | "type";

interface Placement {
  id: string;
  pageIndex: number;
  /** Left edge as a fraction of the displayed page width. */
  xFrac: number;
  /** Top edge as a fraction of the displayed page height. */
  yFrac: number;
  /** Width as a fraction of the displayed page width (signature items only). */
  widthFrac: number;
  kind: "signature" | "text";
  dataUrl?: string;
  text?: string;
  /** Font size as a fraction of the displayed page height (text items only). */
  fontSize?: number;
}

const PAGE_BASE_WIDTH = 620; // px at zoom 1
const RENDER_SCALE = 1.5;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_SIG_WIDTH_FRAC = 0.22;
const MIN_FONT_FRAC = 0.012;
const MAX_FONT_FRAC = 0.12;
const DEFAULT_PAGE_HEIGHT_PT = 792; // US Letter fallback

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function removeBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      const w = c.width, h = c.height;

      // Convert to grayscale array
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      }

      // Build integral image for O(1) local area sums
      const intg = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          intg[(y + 1) * (w + 1) + (x + 1)] =
            gray[y * w + x]
            + intg[y * (w + 1) + (x + 1)]
            + intg[(y + 1) * (w + 1) + x]
            - intg[y * (w + 1) + x];
        }
      }

      // Bradley-Roth adaptive thresholding:
      // pixel is ink if it's darker than (local_mean * (1 - k))
      const radius = Math.max(10, Math.floor(Math.min(w, h) / 16));
      const k = 0.18; // sensitivity: higher = remove more background

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const x1 = Math.max(0, x - radius), y1 = Math.max(0, y - radius);
          const x2 = Math.min(w - 1, x + radius), y2 = Math.min(h - 1, y + radius);
          const count = (x2 - x1 + 1) * (y2 - y1 + 1);
          const sum =
            intg[(y2 + 1) * (w + 1) + (x2 + 1)]
            - intg[y1 * (w + 1) + (x2 + 1)]
            - intg[(y2 + 1) * (w + 1) + x1]
            + intg[y1 * (w + 1) + x1];
          const localMean = sum / count;
          if (gray[y * w + x] > localMean * (1 - k)) {
            px[(y * w + x) * 4 + 3] = 0;
          }
        }
      }

      ctx.putImageData(d, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

/** Render typed text as a handwriting-style signature, trimmed to its ink bounds. */
function renderTypedSignature(name: string): string | null {
  const text = name.trim();
  if (!text) return null;

  const scale = 4; // high resolution
  const fontPx = 64 * scale;
  const fontSpec = `italic ${fontPx}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;

  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = fontSpec;
  const textWidth = Math.ceil(measureCtx.measureText(text).width);

  const pad = fontPx; // generous padding so cursive flourishes never clip
  const width = Math.max(1, textWidth + pad * 2);
  const height = fontPx * 2 + pad * 2;

  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.font = fontSpec;
  ctx.fillStyle = "#1c2541"; // dark ink
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, pad, height / 2 + fontPx * 0.3);

  // Trim to the actual ink bounding box.
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[(row + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const margin = Math.round(fontPx * 0.08);
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(width - 1, maxX + margin);
  maxY = Math.min(height - 1, maxY + margin);
  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  out.getContext("2d")!.drawImage(c, minX, minY, outW, outH, 0, 0, outW, outH);
  return out.toDataURL("image/png");
}

export default function SignPage() {
  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [pdfSizes, setPdfSizes] = useState<{ w: number; h: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Signature
  const [sigTab, setSigTab] = useState<SigTab>("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [origUpload, setOrigUpload] = useState<string | null>(null); // pre-bg-removal
  const [bgRemoved, setBgRemoved] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawRef = useRef<HTMLCanvasElement>(null);

  // Type-to-sign
  const [typedName, setTypedName] = useState("");
  const typedPreview = useMemo(() => renderTypedSignature(typedName), [typedName]);

  // Signature edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [eraserSize, setEraserSize] = useState(20);
  const [darkness, setDarkness] = useState(1);   // 1 = normal, >1 = darker
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const preEditUrl = useRef<string | null>(null);

  // Placements (signature + text/date stamps), selection, drag + resize
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragData = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const resizeData = useRef<{ id: string; startX: number; startWidthFrac: number; startFontSize: number; pageWidth: number; pageHeight: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageImgRefs = useRef<(HTMLImageElement | null)[]>([]);

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");

  const selectedPlacement = placements.find(p => p.id === selectedId) ?? null;

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
    setPlacements([]);
    setSelectedId(null);
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
      } catch (e) {
        if (alive) {
          const passwordLocked = (e as { name?: string })?.name === "PasswordException";
          setErr(passwordLocked
            ? "This PDF is password-protected. Unlock it first with the Unlock PDF tool, then try again."
            : "This file couldn't be opened. Make sure it's a valid PDF.");
          setPdfFile(null);
        }
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
  }, []);

  const useSig = () => {
    if (!hasDrawn || !drawRef.current || !pageUrls.length) return;
    setSigDataUrl(drawRef.current.toDataURL("image/png"));
  };

  const useTypedSig = () => {
    if (!typedPreview || !pageUrls.length) return;
    setSigDataUrl(typedPreview);
  };

  // Load sig into edit canvas when editing starts
  useEffect(() => {
    if (!isEditing || !sigDataUrl || !editCanvasRef.current) return;
    const c = editCanvasRef.current;
    const ctx = c.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = sigDataUrl;
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEditing = () => { preEditUrl.current = sigDataUrl; setDarkness(1); setIsEditing(true); };
  const cancelEdit = () => { setSigDataUrl(preEditUrl.current); setDarkness(1); setIsEditing(false); };

  const confirmEdit = () => {
    const src = editCanvasRef.current!;
    const out = document.createElement("canvas");
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext("2d")!;
    // Bake darkness: darken non-transparent pixels via contrast filter
    if (darkness !== 1) {
      ctx.filter = `contrast(${darkness}) brightness(${2 - darkness})`;
    }
    ctx.drawImage(src, 0, 0);
    setSigDataUrl(out.toDataURL("image/png"));
    setDarkness(1);
    setIsEditing(false);
  };

  // Rotate canvas content by ±90° (baked immediately)
  const rotateCanvas = (deg: 90 | -90) => {
    const src = editCanvasRef.current!;
    const tmp = document.createElement("canvas");
    tmp.width = src.height; tmp.height = src.width;
    const ctx = tmp.getContext("2d")!;
    ctx.translate(tmp.width / 2, tmp.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    src.width = tmp.width; src.height = tmp.height;
    src.getContext("2d")!.drawImage(tmp, 0, 0);
  };

  const getEditXY = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = editCanvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ("touches" in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const eraseAt = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getEditXY(e);
    const ctx = editCanvasRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };

  const onEditStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); setIsErasing(true); eraseAt(e); };
  const onEditMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); if (isErasing) eraseAt(e); };
  const onEditEnd = () => setIsErasing(false);

  // Upload + background removal
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !pageUrls.length) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const url = ev.target!.result as string;
      setOrigUpload(url);
      const cleaned = await removeBackground(url);
      setSigDataUrl(cleaned);
      setBgRemoved(true);
    };
    reader.readAsDataURL(f);
  };

  const toggleBgRemoval = async () => {
    if (!origUpload) return;
    if (!bgRemoved) {
      const cleaned = await removeBackground(origUpload);
      setSigDataUrl(cleaned);
      setBgRemoved(true);
    } else {
      setSigDataUrl(origUpload);
      setBgRemoved(false);
    }
  };

  // Click empty page area: add a new signature placement (doesn't move existing ones)
  const handlePageClick = (e: React.MouseEvent<HTMLImageElement>, pageIndex: number) => {
    if (dragging || isResizing) return;
    if (!sigDataUrl) { setSelectedId(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const widthFrac = DEFAULT_SIG_WIDTH_FRAC;
    const xFrac = Math.max(0, Math.min(1 - widthFrac, (e.clientX - r.left) / r.width - widthFrac / 2));
    const yFrac = Math.max(0, Math.min(0.94, (e.clientY - r.top) / r.height - 0.04));
    const id = makeId();
    setPlacements(ps => [...ps, { id, pageIndex, xFrac, yFrac, widthFrac, kind: "signature", dataUrl: sigDataUrl }]);
    setSelectedId(id);
  };

  // Index of the page taking up the most of the scroll viewport.
  const mostVisiblePage = (): number => {
    const box = scrollRef.current?.getBoundingClientRect();
    if (!box) return 0;
    let best = 0;
    let bestArea = -1;
    pageImgRefs.current.forEach((img, i) => {
      if (!img) return;
      const r = img.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top));
      if (visible > bestArea) { bestArea = visible; best = i; }
    });
    return best;
  };

  // Add a date / text stamp directly (no click-to-place needed)
  const addTextPlacement = (text: string, pt: number) => {
    if (!pageUrls.length) return;
    // Target the selected item's page, otherwise the page most visible in the viewer.
    const selectedPage = placements.find(p => p.id === selectedId)?.pageIndex;
    const pageIndex = selectedPage ?? mostVisiblePage();
    const pageH = pdfSizes[pageIndex]?.h || DEFAULT_PAGE_HEIGHT_PT;
    const id = makeId();
    setPlacements(ps => [...ps, {
      id, pageIndex, xFrac: 0.08, yFrac: 0.06, widthFrac: 0.25,
      kind: "text", text, fontSize: pt / pageH,
    }]);
    setSelectedId(id);
  };

  const addDate = () => addTextPlacement(new Date().toLocaleDateString(), 12);
  const addText = () => addTextPlacement("Your text", 14);

  const updateSelectedText = (text: string) => {
    if (!selectedId) return;
    setPlacements(ps => ps.map(p => (p.id === selectedId ? { ...p, text } : p)));
  };

  const adjustFontSize = (delta: number) => {
    if (!selectedId) return;
    setPlacements(ps => ps.map(p =>
      p.id === selectedId && p.kind === "text"
        ? { ...p, fontSize: Math.max(MIN_FONT_FRAC, Math.min(MAX_FONT_FRAC, (p.fontSize ?? 0.02) + delta)) }
        : p
    ));
  };

  const removePlacement = (id: string) => {
    setPlacements(ps => ps.filter(p => p.id !== id));
    setSelectedId(sel => (sel === id ? null : sel));
  };

  // Drag a placement
  const onPlacementPtrDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isResizing) return;
    const p = placements.find(pl => pl.id === id);
    if (!p) return;
    setSelectedId(id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragData.current = { id, startX: e.clientX, startY: e.clientY, ox: p.xFrac, oy: p.yFrac };
    setDragging(true);
  };

  const onPlacementPtrMove = (e: React.PointerEvent) => {
    if (!dragging || !dragData.current) return;
    e.preventDefault();
    const { id, startX, startY, ox, oy } = dragData.current;
    const p = placements.find(pl => pl.id === id);
    if (!p) return;
    const pageImg = pageImgRefs.current[p.pageIndex];
    if (!pageImg) return;
    const pr = pageImg.getBoundingClientRect();
    const dx = (e.clientX - startX) / pr.width;
    const dy = (e.clientY - startY) / pr.height;
    setPlacements(ps => ps.map(pl => pl.id === id ? {
      ...pl,
      xFrac: Math.max(0, Math.min(0.97, ox + dx)),
      yFrac: Math.max(0, Math.min(0.97, oy + dy)),
    } : pl));
  };

  const onPlacementPtrUp = () => { setDragging(false); dragData.current = null; };

  // Resize a placement (signature: width, text: font size)
  const onResizePtrDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const p = placements.find(pl => pl.id === id);
    if (!p) return;
    const pageImg = pageImgRefs.current[p.pageIndex];
    if (!pageImg) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pr = pageImg.getBoundingClientRect();
    resizeData.current = {
      id, startX: e.clientX,
      startWidthFrac: p.widthFrac, startFontSize: p.fontSize ?? 0.02,
      pageWidth: pr.width, pageHeight: pr.height,
    };
    setIsResizing(true);
  };

  const onResizePtrMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeData.current) return;
    e.preventDefault();
    const { id, startX, startWidthFrac, startFontSize, pageWidth, pageHeight } = resizeData.current;
    const p = placements.find(pl => pl.id === id);
    if (!p) return;
    const dx = e.clientX - startX;
    if (p.kind === "signature") {
      const widthFrac = Math.max(0.06, Math.min(0.70, startWidthFrac + dx / pageWidth));
      setPlacements(ps => ps.map(pl => pl.id === id ? { ...pl, widthFrac } : pl));
    } else {
      const fontSize = Math.max(MIN_FONT_FRAC, Math.min(MAX_FONT_FRAC, startFontSize + (dx / pageHeight) * 0.5));
      setPlacements(ps => ps.map(pl => pl.id === id ? { ...pl, fontSize } : pl));
    }
  };

  const onResizePtrUp = () => { setIsResizing(false); resizeData.current = null; };

  // Zoom
  const zoomIn = () => setZoom(z => Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], ZOOM_STEPS[ZOOM_STEPS.indexOf(z) + 1] ?? z * 1.25));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_STEPS[0], ZOOM_STEPS[ZOOM_STEPS.indexOf(z) - 1] ?? z * 0.8));

  // Placement overlay position
  const getPlacementStyle = (p: Placement): React.CSSProperties | null => {
    const scroll = scrollRef.current;
    const pageImg = pageImgRefs.current[p.pageIndex];
    if (!scroll || !pageImg) return null;
    const cr = scroll.getBoundingClientRect();
    const pr = pageImg.getBoundingClientRect();
    const isSelected = selectedId === p.id;
    return {
      position: "absolute",
      left: (pr.left - cr.left) + scroll.scrollLeft + p.xFrac * pr.width,
      top: (pr.top - cr.top) + scroll.scrollTop + p.yFrac * pr.height,
      width: p.kind === "signature" ? pr.width * p.widthFrac : undefined,
      cursor: dragging && dragData.current?.id === p.id ? "grabbing" : "grab",
      touchAction: "none",
      zIndex: isSelected ? 20 : 10,
      userSelect: "none",
    };
  };

  // Sign
  const handleSign = async () => {
    if (!pdfFile || !placements.length) return;
    logTool("sign"); setStatus("processing"); setErr("");
    const items: SignItem[] = placements
      .filter(p => p.pageIndex < pdfSizes.length)
      .map(p => p.kind === "signature"
        ? { page: p.pageIndex + 1, x: p.xFrac, yFromTop: p.yFrac, widthRatio: p.widthFrac, kind: "image" as const, dataUrl: p.dataUrl }
        : { page: p.pageIndex + 1, x: p.xFrac, yFromTop: p.yFrac, kind: "text" as const, text: p.text, fontSizeRatio: p.fontSize }
      );
    const result = await runInWorker<ToolResult>("signPDFMulti", pdfFile, items);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? pdfFile.name.replace(/\.pdf$/i, "_signed.pdf"));
      setStatus("done");
    } else {
      setErr(result.error ?? "Failed to sign PDF. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setPdfFile(null); setPageUrls([]); setPdfSizes([]);
    setSigDataUrl(null); setOrigUpload(null); setBgRemoved(false);
    setPlacements([]); setSelectedId(null); setStatus("idle"); setErr("");
    setZoom(1); setTypedName("");
    clearDraw();
  };

  const canSign = placements.length > 0 && status !== "processing";
  const pageDisplayWidth = PAGE_BASE_WIDTH * zoom;

  return (
    <ToolShell name="Sign PDF" description="Draw, type or upload your signature, then place it — and dates or initials — anywhere on your PDF." icon="✍️"
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
                  {(["draw", "upload", "type"] as const).map(t => (
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

                {/* Type */}
                {sigTab === "type" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={typedName}
                      onChange={e => setTypedName(e.target.value)}
                      placeholder="Type your name"
                      maxLength={60}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <div className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white" style={{ minHeight: 90 }}>
                      {typedPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={typedPreview} alt="Typed signature preview" className="max-h-20 object-contain" draggable={false} />
                      ) : (
                        <span className="text-xs text-gray-400">Preview appears here</span>
                      )}
                    </div>
                    <button onClick={useTypedSig} disabled={!typedPreview || !pageUrls.length}
                      className="w-full py-2 text-xs font-bold bg-red-600 text-white rounded-xl disabled:opacity-40 hover:bg-red-700">
                      Use Signature
                    </button>
                  </div>
                )}

                {/* Upload */}
                {sigTab === "upload" && (
                  <div className="space-y-2">
                    {isEditing ? (
                      <>
                        <p className="text-xs text-gray-500 font-medium text-center">Edit your signature</p>
                        <canvas
                          ref={editCanvasRef}
                          width={400} height={140}
                          className="w-full rounded-xl border border-gray-200 touch-none"
                          style={{
                            background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 10px 10px",
                            cursor: "cell",
                            filter: darkness !== 1 ? `contrast(${darkness}) brightness(${2 - darkness})` : undefined,
                          }}
                          onMouseDown={onEditStart} onMouseMove={onEditMove} onMouseUp={onEditEnd} onMouseLeave={onEditEnd}
                          onTouchStart={onEditStart} onTouchMove={onEditMove} onTouchEnd={onEditEnd}
                        />

                        {/* Rotate */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0 w-12">Rotate</span>
                          <div className="flex gap-1 flex-1">
                            <button onClick={() => rotateCanvas(-90)}
                              className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50" title="Rotate left">↺</button>
                            <button onClick={() => rotateCanvas(90)}
                              className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50" title="Rotate right">↻</button>
                          </div>
                        </div>

                        {/* Darkness */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0 w-12">Darker</span>
                          <input type="range" min={0.8} max={3} step={0.05} value={darkness}
                            onChange={e => setDarkness(Number(e.target.value))}
                            className="flex-1 accent-red-600" />
                          <span className="text-xs text-gray-500 w-8 text-right">{darkness.toFixed(1)}×</span>
                        </div>

                        {/* Eraser */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0 w-12">Eraser</span>
                          <input type="range" min={6} max={60} value={eraserSize}
                            onChange={e => setEraserSize(Number(e.target.value))}
                            className="flex-1 accent-red-600" />
                          <span className="text-xs text-gray-500 w-8 text-right">{eraserSize}px</span>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={cancelEdit} className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                          <button onClick={confirmEdit} className="flex-1 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700">Done</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-red-300 transition-colors">
                          <span className="text-3xl">🖼️</span>
                          <span className="text-sm text-gray-500 font-medium">Upload signature image</span>
                          <span className="text-xs text-gray-400">PNG, JPG, WEBP</span>
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} disabled={!pageUrls.length} />
                        </label>
                        {origUpload && (
                          <button onClick={toggleBgRemoval}
                            className={`w-full py-2 text-xs font-semibold rounded-xl border transition-colors ${bgRemoved ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:border-red-300"}`}>
                            {bgRemoved ? "✓ Background removed" : "Remove background"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Sig preview */}
                {sigDataUrl && !isEditing && (
                  <div className="border border-red-200 rounded-xl p-3 space-y-2" style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 12px 12px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sigDataUrl} alt="Signature" className="max-h-14 object-contain mx-auto" draggable={false} />
                    <p className="text-xs text-center text-red-600 font-medium">
                      Click on the PDF to add it
                    </p>
                    {sigTab === "upload" && (
                      <button onClick={startEditing}
                        className="w-full py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        ✏️ Edit signature
                      </button>
                    )}
                    <button
                      onClick={() => { setSigDataUrl(null); setOrigUpload(null); setBgRemoved(false); setIsEditing(false); }}
                      className="w-full py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      ✕ Remove signature
                    </button>
                  </div>
                )}

                {!sigDataUrl && pageUrls.length > 0 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    {sigTab === "draw" ? `Draw above, then click "Use Signature"` : sigTab === "type" ? "Type your name above" : "Upload your signature image"}
                  </p>
                )}

                {/* Date / text stamps */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-medium text-gray-500">Dates & text</p>
                  <div className="flex gap-2">
                    <button onClick={addDate} disabled={!pageUrls.length}
                      className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40">
                      📅 Add date
                    </button>
                    <button onClick={addText} disabled={!pageUrls.length}
                      className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40">
                      🔤 Add text
                    </button>
                  </div>
                </div>

                {/* Selected item controls */}
                {selectedPlacement && (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-500 truncate">
                        Selected: {selectedPlacement.kind === "signature" ? "Signature" : "Text"} · page {selectedPlacement.pageIndex + 1}
                      </p>
                      <button onClick={() => removePlacement(selectedPlacement.id)}
                        className="text-xs text-red-500 hover:text-red-700 shrink-0">✕ Remove</button>
                    </div>
                    {selectedPlacement.kind === "text" && (
                      <>
                        <input
                          type="text"
                          value={selectedPlacement.text ?? ""}
                          onChange={e => updateSelectedText(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Size</span>
                          <button onClick={() => adjustFontSize(-0.003)}
                            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-bold">−</button>
                          <button onClick={() => adjustFontSize(0.003)}
                            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-bold">+</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {placements.length > 0 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    {placements.length} placement{placements.length === 1 ? "" : "s"} on this document
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
                    {status === "processing" ? "Signing…" : placements.length === 0 ? "Add a signature, date or text" : "Sign & Download PDF"}
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={el => { pageImgRefs.current[i] = el; }}
                        src={url}
                        alt={`Page ${i + 1}`}
                        draggable={false}
                        onClick={e => handlePageClick(e, i)}
                        style={{ width: pageDisplayWidth, maxWidth: "none", display: "block", cursor: sigDataUrl ? "crosshair" : "default" }}
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

                {/* Placements */}
                {placements.map(p => {
                  const style = getPlacementStyle(p);
                  if (!style) return null;
                  const isSelected = selectedId === p.id;
                  const pageImg = pageImgRefs.current[p.pageIndex];
                  const fontPx = (p.fontSize ?? 0.02) * (pageImg?.getBoundingClientRect().height ?? 0);
                  return (
                    <div key={p.id} style={style}
                      onPointerDown={e => onPlacementPtrDown(e, p.id)}
                      onPointerMove={e => { onPlacementPtrMove(e); onResizePtrMove(e); }}
                      onPointerUp={() => { onPlacementPtrUp(); onResizePtrUp(); }}
                      onPointerCancel={() => { onPlacementPtrUp(); onResizePtrUp(); }}
                      onClick={e => { e.stopPropagation(); setSelectedId(p.id); }}>

                      {isSelected && (
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); removePlacement(p.id); }}
                          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow"
                          style={{ zIndex: 30 }}>
                          ✕
                        </button>
                      )}

                      {p.kind === "signature" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.dataUrl} alt="Signature" draggable={false}
                          className={`w-full select-none border-2 rounded ${isSelected ? "border-red-500" : "border-red-300 border-dashed"}`}
                          style={{ userSelect: "none", display: "block" }} />
                      ) : (
                        <div
                          className={`px-1 whitespace-nowrap border-2 rounded ${isSelected ? "border-red-500" : "border-red-300 border-dashed"}`}
                          style={{ fontSize: fontPx, color: "#374151", fontFamily: "Helvetica, Arial, sans-serif", background: "rgba(255,255,255,0.7)" }}>
                          {p.text || " "}
                        </div>
                      )}

                      {isSelected && (
                        <div
                          onPointerDown={e => onResizePtrDown(e, p.id)}
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
                      )}
                    </div>
                  );
                })}

                {/* Placement hint */}
                {!loading && pageUrls.length > 0 && sigDataUrl && placements.length === 0 && (
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

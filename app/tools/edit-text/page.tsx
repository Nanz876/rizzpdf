"use client";
import { logTool } from "@/lib/logTool";
import { useState, useRef, useEffect, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob } from "@/lib/pdf-tools";
import { toolErrorMessage } from "@/lib/pdf-load";
import {
  findEditableText,
  applyTextEdits,
  sampleBackgroundColor,
  type EditableTextLine,
  type TextEdit,
  type TextFamily,
  type TextRect,
  type Rgb,
} from "@/lib/tools/edit-text";

type Status = "idle" | "processing" | "done" | "error";

interface PendingEdit extends TextEdit {
  id: string;
  /** The line this edit replaces, or null for an added box. */
  lineId: string | null;
  /** The text that was there before, or "" for an added box. */
  original: string;
}

interface Draft {
  id: string | null; // an existing pending edit being re-opened
  lineId: string | null; // the original line, if any
  page: number;
  box: TextRect;
  original: string;
  text: string;
  fontSize: number;
  family: TextFamily;
  bold: boolean;
  italic: boolean;
  color: Rgb;
  cover: boolean;
}

const PAGE_BASE_WIDTH = 620; // px at zoom 1
const RENDER_SCALE = 1.5;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const LINE_BOX_RATIO = 1.28; // box height ÷ font size, matching lib/tools/edit-text.ts

const CSS_FAMILY: Record<TextFamily, string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

let measureCtx: CanvasRenderingContext2D | null = null;

/** Preview font size, shrunk to the box the way applyTextEdits shrinks it. */
function previewFontSize(text: string, sizePx: number, boxPx: number, family: TextFamily, bold: boolean, italic: boolean) {
  if (!text || !(boxPx > 0)) return sizePx;
  if (!measureCtx && typeof document !== "undefined") measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return sizePx;
  measureCtx.font = `${italic ? "italic " : ""}${bold ? "700 " : "400 "}${sizePx}px ${CSS_FAMILY[family]}`;
  const width = measureCtx.measureText(text).width;
  return width > boxPx ? Math.max(4, (sizePx * boxPx) / width) : sizePx;
}
const cssColor = (c: Rgb) => `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const EditTextIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <rect x="3" y="3" width="13" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8" />
    <path d="M6.5 8h7M6.5 12h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13 19.5l6.5-6.5 2 2-6.5 6.5H13v-2z" fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export default function EditTextPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([]);
  const [lines, setLines] = useState<EditableTextLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [addMode, setAddMode] = useState(false);
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");
  const [resultMsg, setResultMsg] = useState("");

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bgCanvas = useRef<{ page: number; canvas: HTMLCanvasElement } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Render the pages and find the text lines that can be replaced.
  useEffect(() => {
    if (!file) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const urls: string[] = [];
        const sizes: { width: number; height: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!alive) break;
          const pg = await pdf.getPage(i);
          const base = pg.getViewport({ scale: 1 });
          sizes.push({ width: base.width, height: base.height });
          const vp = pg.getViewport({ scale: RENDER_SCALE });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width);
          c.height = Math.ceil(vp.height);
          await pg.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp }).promise;
          urls.push(c.toDataURL("image/jpeg", 0.92));
          pg.cleanup();
        }
        await pdf.destroy();
        if (!alive) return;
        setPageUrls(urls);
        setPageSizes(sizes);
        setLines(await findEditableText(file));
      } catch (e) {
        if (alive) {
          setErr(toolErrorMessage(e, "This file couldn't be opened. Make sure it's a valid PDF."));
          setFile(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  useEffect(() => {
    if (draft) inputRef.current?.focus();
  }, [draft]);

  const changeEdits = useCallback((fn: (e: PendingEdit[]) => PendingEdit[]) => {
    setEdits(fn);
    setStatus((s) => (s === "done" || s === "error" ? "idle" : s));
    setResultMsg("");
    setErr("");
  }, []);

  /** The rendered page, as pixels, so the cover rectangle can match the background. */
  const canvasForPage = async (page: number): Promise<HTMLCanvasElement | null> => {
    if (bgCanvas.current?.page === page) return bgCanvas.current.canvas;
    const url = pageUrls[page - 1];
    if (!url) return null;
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = url;
    });
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    bgCanvas.current = { page, canvas };
    return canvas;
  };

  const openLine = (line: EditableTextLine) => {
    const existing = edits.find((e) => e.lineId === line.id);
    setDraft({
      id: existing?.id ?? null,
      lineId: line.id,
      page: line.page,
      box: line.box,
      original: line.text,
      text: existing?.text ?? line.text,
      fontSize: existing?.fontSize ?? line.fontSize,
      family: existing?.family ?? line.family,
      bold: existing?.bold ?? line.bold,
      italic: existing?.italic ?? line.italic,
      color: existing?.color ?? line.color,
      cover: true,
    });
  };

  const openAdded = (edit: PendingEdit) =>
    setDraft({
      id: edit.id,
      lineId: edit.lineId,
      page: edit.page,
      box: edit.box,
      original: edit.original,
      text: edit.text,
      fontSize: edit.fontSize ?? 12,
      family: edit.family ?? "sans",
      bold: !!edit.bold,
      italic: !!edit.italic,
      color: edit.color ?? { r: 0, g: 0, b: 0 },
      cover: edit.cover !== false,
    });

  const startNewBox = (page: number, fx: number, fy: number) => {
    const size = pageSizes[page - 1];
    const fontSize = 12;
    const height = size ? (fontSize * LINE_BOX_RATIO) / size.height : 0.03;
    setDraft({
      id: null,
      lineId: null,
      page,
      box: { x: Math.min(fx, 0.95), y: Math.max(0, Math.min(fy, 1 - height)), width: Math.min(0.6, 1 - fx), height },
      original: "",
      text: "",
      fontSize,
      family: "sans",
      bold: false,
      italic: false,
      color: { r: 0, g: 0, b: 0 },
      cover: false,
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    const text = draft.text;
    if (!draft.original && !text.trim()) {
      setDraft(null);
      return;
    }
    let background: Rgb | undefined;
    if (draft.cover) {
      const canvas = await canvasForPage(draft.page);
      if (canvas) background = sampleBackgroundColor(canvas, draft.box);
    }
    const next: PendingEdit = {
      id: draft.id ?? makeId(),
      lineId: draft.lineId,
      original: draft.original,
      page: draft.page,
      box: draft.box,
      text,
      fontSize: draft.fontSize,
      family: draft.family,
      bold: draft.bold,
      italic: draft.italic,
      color: draft.color,
      background,
      cover: draft.cover,
    };
    changeEdits((list) => (draft.id ? list.map((e) => (e.id === draft.id ? next : e)) : [...list, next]));
    setDraft(null);
  };

  const undoEdit = (id: string) => {
    changeEdits((list) => list.filter((e) => e.id !== id));
    setDraft((d) => (d?.id === id ? null : d));
  };

  const handleApply = async () => {
    if (!file || status === "processing") return;
    if (!edits.length) {
      setErr("Click a line of text to replace it, or add a text box.");
      return;
    }
    logTool("edit-text");
    setStatus("processing");
    setErr("");
    setResultMsg("");
    const payload: TextEdit[] = edits.map(({ page, box, text, fontSize, family, bold, italic, color, background, cover }) => ({
      page,
      box,
      text,
      fontSize,
      family,
      bold,
      italic,
      color,
      background,
      cover,
    }));
    const result = await applyTextEdits(file, payload);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_edited.pdf"));
      const replaced = edits.filter((e) => e.original).length;
      setResultMsg(`${plural(replaced, "line")} replaced, ${plural(edits.length - replaced, "text box")} added.`);
      setStatus("done");
    } else {
      setErr(result.error ?? "Editing failed. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPageUrls([]);
    setPageSizes([]);
    setLines([]);
    setEdits([]);
    setDraft(null);
    setAddMode(false);
    setStatus("idle");
    setErr("");
    setResultMsg("");
    setZoom(1);
    bgCanvas.current = null;
  };

  const zoomIn = () => setZoom((z) => ZOOM_STEPS[ZOOM_STEPS.indexOf(z) + 1] ?? z);
  const zoomOut = () => setZoom((z) => ZOOM_STEPS[ZOOM_STEPS.indexOf(z) - 1] ?? z);

  const pageDisplayWidth = PAGE_BASE_WIDTH * zoom;
  const primaryLabel = status === "processing" ? "Saving…" : status === "done" ? "✓ Downloaded" : "Save & Download →";
  const editedLineIds = new Set(edits.map((e) => e.lineId).filter((id): id is string => !!id));

  return (
    <ToolShell
      name="Edit PDF Text"
      description="Click a line of text to replace it, or add a new text box. Everything stays in your browser."
      icon="✏️"
      svgIcon={<EditTextIcon />}
      steps={file ? undefined : ["Upload your PDF", "Click a line and type the replacement", "Download the edited PDF"]}
    >
      {!file && (
        <>
          <UploadZone onFilesAdded={(f) => { reset(); setFile(f[0]); }} disabled={loading} />
          {err && <p className="text-red-600 text-sm mt-3 text-center">{err}</p>}
          <div className="mt-6 border border-gray-200 bg-white rounded-2xl p-4 text-xs text-gray-600 space-y-1.5 max-w-2xl mx-auto">
            <p className="font-bold text-gray-800">What this tool does — and what it can&apos;t</p>
            <p>
              It <strong>replaces or adds text</strong>: the line you pick is removed, the space behind it is filled with the page&apos;s
              background colour, and your new text is drawn on top. <strong>The original font is matched to the closest standard
              font</strong> (Helvetica, Times or Courier, with bold and italic versions), so the replacement is a close match, not the
              exact typeface.
            </p>
            <p>
              Real letter-by-letter editing inside the original font isn&apos;t possible in a browser — PDFs usually ship only the
              glyphs they already use. Scanned pages have no text to click, and text inside a logo or a chart may not be editable.
            </p>
          </div>
        </>
      )}

      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<EditTextIcon size={16} />}
            title="Edit PDF Text"
            subtitle={`${file.name}${pageUrls.length ? ` · ${plural(pageUrls.length, "page")}` : ""}`}
            onReset={reset}
            primaryLabel={primaryLabel}
            onPrimary={handleApply}
            primaryDisabled={!edits.length || status === "processing" || loading || status === "done"}
          >
            <div className="flex items-center gap-1">
              <button onClick={zoomOut} disabled={zoom <= ZOOM_STEPS[0]} aria-label="Zoom out"
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold">−</button>
              <span className="text-xs text-gray-700 font-semibold w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in"
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold">+</button>
            </div>
          </WorkspaceBar>

          <div className="flex flex-col lg:flex-row gap-4 p-4 items-start">
            {/* ─── LEFT PANEL ─── */}
            <div className="w-full lg:w-72 shrink-0 space-y-3">
              <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600">How to edit</p>
                <p className="text-xs text-gray-500">
                  {addMode
                    ? "Click anywhere on a page to drop a new text box."
                    : lines.length
                      ? "Click any highlighted line to replace it."
                      : loading
                        ? "Looking for editable text…"
                        : "No text found — this PDF looks scanned. You can still add text boxes."}
                </p>
                <button
                  onClick={() => { setAddMode((m) => !m); setDraft(null); }}
                  className={`w-full py-2 rounded-xl text-xs font-bold border transition-colors ${
                    addMode ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  {addMode ? "✓ Add text box mode — on" : "+ Add text box"}
                </button>
                {!!lines.length && (
                  <p className="text-[11px] text-gray-400">{plural(lines.length, "editable line")} found.</p>
                )}
              </div>

              <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Pending changes ({edits.length})</p>
                  {edits.length > 0 && (
                    <button onClick={() => { changeEdits(() => []); setDraft(null); }} className="text-xs text-gray-400 hover:text-red-600">
                      Clear all
                    </button>
                  )}
                </div>
                {edits.length === 0 ? (
                  <p className="text-xs text-gray-400">Nothing changed yet.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-64 overflow-auto">
                    {edits.map((e) => (
                      <li key={e.id} className="text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => pageRefs.current[e.page - 1]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            className="text-left min-w-0 flex-1 hover:text-red-600"
                          >
                            <span className="text-gray-400">Page {e.page}</span>
                            {e.original && (
                              <span className="block text-gray-500 line-through truncate">{e.original}</span>
                            )}
                            <span className="block text-gray-900 font-medium truncate">
                              {e.text.trim() ? e.text : "(removed)"}
                            </span>
                          </button>
                          <button onClick={() => undoEdit(e.id)} aria-label="Undo this change" className="text-gray-400 hover:text-red-600 font-bold">
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border border-amber-300 bg-amber-50 rounded-2xl p-3 text-xs text-amber-900 space-y-1.5" role="note">
                <p className="font-bold">Fonts are matched, not copied</p>
                <p>
                  Replaced text is drawn in the closest standard font — Helvetica, Times or Courier, bold or italic to match. It will
                  read cleanly but won&apos;t be pixel-identical to the original typeface.
                </p>
                <p>Long replacements are shrunk to fit the line, and the old text is removed from the file, not just hidden.</p>
              </div>

              {err && <p className="text-red-600 text-xs" role="alert">{err}</p>}
              {status === "done" && resultMsg && (
                <p className="text-green-700 text-xs font-semibold" role="status">✓ Downloaded. {resultMsg}</p>
              )}
              {status === "done" ? (
                <button onClick={reset} className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-sm hover:bg-red-700">
                  Edit another PDF
                </button>
              ) : (
                <button
                  onClick={handleApply}
                  disabled={!edits.length || status === "processing" || loading}
                  className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 hover:bg-red-700 transition-colors"
                >
                  {status === "processing" ? "Saving…" : edits.length ? "Save & Download →" : "Click a line to edit it"}
                </button>
              )}
            </div>

            {/* ─── RIGHT PANEL: pages ─── */}
            <div className="flex-1 min-w-0 w-full">
              <div className="relative overflow-auto bg-gray-300 rounded-2xl border border-gray-200" style={{ height: "75vh" }}>
                {loading && <div className="flex items-center justify-center h-full text-gray-500 text-sm">Rendering pages…</div>}
                <div className="flex flex-col items-center gap-4 p-4" style={{ minWidth: pageDisplayWidth + 32 }}>
                  {pageUrls.map((url, i) => {
                    const page = i + 1;
                    const size = pageSizes[i];
                    const pxPerPoint = size ? pageDisplayWidth / size.width : 1;
                    return (
                      <div
                        key={i}
                        ref={(el) => { pageRefs.current[i] = el; }}
                        className="relative flex-shrink-0 shadow-xl bg-white select-none"
                        style={{ width: pageDisplayWidth, cursor: addMode ? "crosshair" : "default" }}
                        onClick={(e) => {
                          if (!addMode) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          startNewBox(page, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Page ${page}`} draggable={false} style={{ width: "100%", display: "block" }} />

                        {/* Original lines: clickable unless they already have a pending change. */}
                        {!addMode &&
                          lines
                            .filter((l) => l.page === page && !editedLineIds.has(l.id))
                            .map((l) => (
                              <button
                                key={l.id}
                                onClick={(e) => { e.stopPropagation(); openLine(l); }}
                                title={l.text}
                                className="absolute rounded-sm ring-1 ring-transparent hover:ring-2 hover:ring-red-500 hover:bg-red-500/10 transition-colors"
                                style={{
                                  left: `${l.box.x * 100}%`,
                                  top: `${l.box.y * 100}%`,
                                  width: `${l.box.width * 100}%`,
                                  height: `${l.box.height * 100}%`,
                                  cursor: "text",
                                }}
                              />
                            ))}

                        {/* Pending changes, previewed roughly as they will be drawn. */}
                        {edits
                          .filter((e) => e.page === page)
                          .map((e) => (
                            <button
                              key={e.id}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                const line = e.lineId ? lines.find((l) => l.id === e.lineId) : undefined;
                                if (line) openLine(line);
                                else openAdded(e);
                              }}
                              className="absolute text-left ring-1 ring-green-500/70 hover:ring-2 hover:ring-green-600 overflow-hidden"
                              style={{
                                left: `${e.box.x * 100}%`,
                                top: `${e.box.y * 100}%`,
                                width: `${e.box.width * 100}%`,
                                height: `${e.box.height * 100}%`,
                                background: e.cover === false ? "transparent" : cssColor(e.background ?? { r: 1, g: 1, b: 1 }),
                              }}
                            >
                              <span
                                style={{
                                  display: "block",
                                  position: "absolute",
                                  left: 0,
                                  bottom: `${(0.28 / LINE_BOX_RATIO) * 100 - 6}%`,
                                  whiteSpace: "nowrap",
                                  fontFamily: CSS_FAMILY[e.family ?? "sans"],
                                  fontWeight: e.bold ? 700 : 400,
                                  fontStyle: e.italic ? "italic" : "normal",
                                  color: cssColor(e.color ?? { r: 0, g: 0, b: 0 }),
                                  fontSize: `${previewFontSize(
                                    e.text,
                                    Math.max(4, (e.fontSize ?? 12) * pxPerPoint),
                                    e.box.width * pageDisplayWidth,
                                    e.family ?? "sans",
                                    !!e.bold,
                                    !!e.italic
                                  )}px`,
                                  lineHeight: 1,
                                }}
                              >
                                {e.text}
                              </span>
                            </button>
                          ))}

                        {/* Inline editor. */}
                        {draft && draft.page === page && (
                          <div
                            className="absolute z-30 bg-white border-2 border-red-500 rounded-xl shadow-xl p-2 space-y-2"
                            style={{
                              left: `${Math.min(draft.box.x, 0.55) * 100}%`,
                              top: `calc(${(draft.box.y + draft.box.height) * 100}% + 6px)`,
                              width: "min(320px, 90%)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {draft.original && (
                              <p className="text-[11px] text-gray-400 truncate">Was: {draft.original}</p>
                            )}
                            <input
                              ref={inputRef}
                              value={draft.text}
                              onChange={(e) => setDraft((d) => (d ? { ...d, text: e.target.value } : d))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); saveDraft(); }
                                if (e.key === "Escape") { e.preventDefault(); setDraft(null); }
                              }}
                              placeholder={draft.original ? "Replacement text" : "New text"}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-gray-500">
                                Size
                                <input
                                  type="number"
                                  min={4}
                                  max={200}
                                  step={0.5}
                                  value={Math.round(draft.fontSize * 10) / 10}
                                  onChange={(e) => setDraft((d) => (d ? { ...d, fontSize: Math.max(4, Number(e.target.value) || d.fontSize) } : d))}
                                  className="ml-1 w-16 border border-gray-200 rounded-lg px-1.5 py-1 text-xs"
                                />
                              </label>
                              <button
                                onClick={() => setDraft((d) => (d ? { ...d, bold: !d.bold } : d))}
                                aria-pressed={draft.bold}
                                className={`w-7 h-7 rounded-lg border text-xs font-bold ${draft.bold ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"}`}
                              >
                                B
                              </button>
                              <button
                                onClick={() => setDraft((d) => (d ? { ...d, italic: !d.italic } : d))}
                                aria-pressed={draft.italic}
                                className={`w-7 h-7 rounded-lg border text-xs italic ${draft.italic ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"}`}
                              >
                                I
                              </button>
                              <select
                                value={draft.family}
                                onChange={(e) => setDraft((d) => (d ? { ...d, family: e.target.value as TextFamily } : d))}
                                aria-label="Font"
                                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-1.5 py-1 text-xs"
                              >
                                <option value="sans">Helvetica</option>
                                <option value="serif">Times</option>
                                <option value="mono">Courier</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <button onClick={() => setDraft(null)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800">
                                Cancel
                              </button>
                              <div className="flex items-center gap-2">
                                {draft.id && (
                                  <button onClick={() => undoEdit(draft.id!)} className="px-2 py-1 text-xs text-red-600 hover:underline">
                                    Undo change
                                  </button>
                                )}
                                <button onClick={saveDraft} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700">
                                  {draft.original ? "Replace" : "Add text"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {pageUrls.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded pointer-events-none">
                            {page} / {pageUrls.length}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

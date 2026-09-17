"use client";
import { logTool } from "@/lib/logTool";
import { useState, useRef, useEffect, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob } from "@/lib/pdf-tools";
import { toolErrorMessage } from "@/lib/pdf-load";
import { findTextBoxes, redactPDF, REDACT_PRESETS, type RedactBox, type RedactPreset } from "@/lib/tools/redact";

type Status = "idle" | "processing" | "done" | "error";
type Corner = "nw" | "ne" | "sw" | "se";

interface UiBox extends RedactBox {
  id: string;
}

type Interaction =
  | { kind: "draw"; page: number; rect: DOMRect; x0: number; y0: number }
  | { kind: "move"; id: string; rect: DOMRect; startX: number; startY: number; orig: UiBox }
  | { kind: "resize"; id: string; rect: DOMRect; corner: Corner; orig: UiBox };

const PAGE_BASE_WIDTH = 620; // px at zoom 1
const RENDER_SCALE = 1.5;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MIN_FRAC = 0.004;

const PRESETS: { key: RedactPreset; label: string }[] = [
  { key: "emails", label: "Emails" },
  { key: "phones", label: "Phone numbers" },
  { key: "cards", label: "Card numbers" },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function sameBox(a: RedactBox, b: RedactBox) {
  return a.page === b.page && Math.abs(a.x - b.x) < 0.002 && Math.abs(a.y - b.y) < 0.002 && Math.abs(a.w - b.w) < 0.002 && Math.abs(a.h - b.h) < 0.002;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : /(s|x|ch|sh)$/.test(word) ? "es" : "s"}`;

const RedactIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8" />
    <rect x="7" y="7" width="10" height="3" fill="white" />
    <path d="M7 14h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="12" y="13" width="5" height="3" fill="white" />
  </svg>
);

export default function RedactPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [boxes, setBoxes] = useState<UiBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RedactBox | null>(null);
  const [drawMode, setDrawMode] = useState(true);
  const interaction = useRef<Interaction | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [query, setQuery] = useState("");
  const [wholeWord, setWholeWord] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");
  const [resultMsg, setResultMsg] = useState("");

  // Render pages for marking.
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
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!alive) break;
          const pg = await pdf.getPage(i);
          const vp = pg.getViewport({ scale: RENDER_SCALE });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width);
          c.height = Math.ceil(vp.height);
          await pg.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp }).promise;
          urls.push(c.toDataURL("image/jpeg", 0.9));
          pg.cleanup();
        }
        await pdf.destroy();
        if (alive) setPageUrls(urls);
      } catch (e) {
        if (alive) {
          setErr(toolErrorMessage(e, "This file couldn't be opened. Make sure it's a valid PDF."));
          setFile(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [file]);

  // Any change to the marks invalidates a previous result.
  const changeBoxes = useCallback((fn: (bs: UiBox[]) => UiBox[]) => {
    setBoxes(fn);
    setStatus(s => (s === "done" || s === "error" ? "idle" : s));
    setResultMsg("");
  }, []);

  const removeBox = useCallback((id: string) => {
    changeBoxes(bs => bs.filter(b => b.id !== id));
    setSelectedId(sel => (sel === id ? null : sel));
  }, [changeBoxes]);

  // Delete / Backspace removes the selected box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeBox(selectedId); }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, removeBox]);

  const addFoundBoxes = (found: RedactBox[], label: string) => {
    let added = 0;
    const next = [...boxes];
    for (const b of found) {
      if (next.some(o => sameBox(o, b))) continue;
      next.push({ ...b, id: makeId() });
      added++;
    }
    changeBoxes(() => next);
    const pages = new Set(found.map(b => b.page)).size;
    setSearchMsg(found.length
      ? `${label}: ${plural(found.length, "match")} on ${plural(pages, "page")}${added < found.length ? ` (${found.length - added} already marked)` : ""}. Check each box before redacting.`
      : `${label}: no matches found.`);
  };

  const runSearch = async (q: string | RegExp, label: string, opts?: { wholeWord?: boolean }) => {
    if (!file || searching) return;
    setSearching(true); setSearchMsg(""); setErr("");
    try {
      addFoundBoxes(await findTextBoxes(file, q, opts), label);
    } catch (e) {
      setErr(toolErrorMessage(e, "Couldn't search this PDF's text."));
    } finally {
      setSearching(false);
    }
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch(query, `"${query.trim()}"`, { wholeWord });
  };

  // ─── Pointer interactions (draw / move / resize) ───────────────────────────

  const fracPoint = (rect: DOMRect, e: React.PointerEvent) => ({
    x: clamp01((e.clientX - rect.left) / rect.width),
    y: clamp01((e.clientY - rect.top) / rect.height),
  });

  const onPagePointerDown = (e: React.PointerEvent<HTMLDivElement>, page: number) => {
    setSelectedId(null);
    if (!drawMode || e.button !== 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = fracPoint(rect, e);
    e.currentTarget.setPointerCapture(e.pointerId);
    interaction.current = { kind: "draw", page, rect, x0: p.x, y0: p.y };
    setDraft({ page, x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onBoxPointerDown = (e: React.PointerEvent, box: UiBox) => {
    e.preventDefault();
    e.stopPropagation();
    const pageEl = pageRefs.current[box.page - 1];
    if (!pageEl) return;
    pageEl.setPointerCapture(e.pointerId);
    setSelectedId(box.id);
    interaction.current = { kind: "move", id: box.id, rect: pageEl.getBoundingClientRect(), startX: e.clientX, startY: e.clientY, orig: box };
  };

  const onHandlePointerDown = (e: React.PointerEvent, box: UiBox, corner: Corner) => {
    e.preventDefault();
    e.stopPropagation();
    const pageEl = pageRefs.current[box.page - 1];
    if (!pageEl) return;
    pageEl.setPointerCapture(e.pointerId);
    setSelectedId(box.id);
    interaction.current = { kind: "resize", id: box.id, rect: pageEl.getBoundingClientRect(), corner, orig: box };
  };

  const onPagePointerMove = (e: React.PointerEvent) => {
    const it = interaction.current;
    if (!it) return;
    e.preventDefault();
    if (it.kind === "draw") {
      const p = fracPoint(it.rect, e);
      setDraft({ page: it.page, x: Math.min(it.x0, p.x), y: Math.min(it.y0, p.y), w: Math.abs(p.x - it.x0), h: Math.abs(p.y - it.y0) });
    } else if (it.kind === "move") {
      const { orig } = it;
      const x = Math.max(0, Math.min(1 - orig.w, orig.x + (e.clientX - it.startX) / it.rect.width));
      const y = Math.max(0, Math.min(1 - orig.h, orig.y + (e.clientY - it.startY) / it.rect.height));
      changeBoxes(bs => bs.map(b => (b.id === it.id ? { ...b, x, y } : b)));
    } else {
      const { orig, corner } = it;
      const p = fracPoint(it.rect, e);
      let left = orig.x, top = orig.y, right = orig.x + orig.w, bottom = orig.y + orig.h;
      if (corner.includes("w")) left = Math.min(p.x, right - MIN_FRAC);
      if (corner.includes("e")) right = Math.max(p.x, left + MIN_FRAC);
      if (corner.includes("n")) top = Math.min(p.y, bottom - MIN_FRAC);
      if (corner.includes("s")) bottom = Math.max(p.y, top + MIN_FRAC);
      changeBoxes(bs => bs.map(b => (b.id === it.id ? { ...b, x: left, y: top, w: right - left, h: bottom - top } : b)));
    }
  };

  const endInteraction = () => {
    const it = interaction.current;
    interaction.current = null;
    if (it?.kind === "draw") {
      const d = draft;
      setDraft(null);
      // Ignore taps: require a few pixels in each direction.
      if (d && d.w * it.rect.width >= 4 && d.h * it.rect.height >= 4) {
        const id = makeId();
        changeBoxes(bs => [...bs, { ...d, id }]);
        setSelectedId(id);
      }
    }
  };

  // ─── Apply ─────────────────────────────────────────────────────────────────

  const handleRedact = async () => {
    if (!file || status === "processing") return;
    if (!boxes.length) { setErr("Mark at least one area to redact."); return; }
    logTool("redact");
    setStatus("processing"); setErr(""); setResultMsg("");
    const redactedPages = new Set(boxes.map(b => b.page)).size;
    const result = await redactPDF(file, boxes.map(({ page, x, y, w, h }) => ({ page, x, y, w, h })));
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_redacted.pdf"));
      setResultMsg(`${plural(redactedPages, "page")} redacted; ${plural(pageUrls.length - redactedPages, "page")} unchanged.`);
      setStatus("done");
    } else {
      setErr(result.error ?? "Redaction failed. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null); setPageUrls([]); setBoxes([]); setSelectedId(null); setDraft(null);
    setQuery(""); setSearchMsg(""); setStatus("idle"); setErr(""); setResultMsg(""); setZoom(1);
  };

  const zoomIn = () => setZoom(z => ZOOM_STEPS[ZOOM_STEPS.indexOf(z) + 1] ?? z);
  const zoomOut = () => setZoom(z => ZOOM_STEPS[ZOOM_STEPS.indexOf(z) - 1] ?? z);

  const pagesWithBoxes = Array.from(new Set(boxes.map(b => b.page))).sort((a, b) => a - b);
  const pageDisplayWidth = PAGE_BASE_WIDTH * zoom;
  const primaryLabel = status === "processing" ? "Redacting…" : status === "done" ? "✓ Downloaded" : "Redact & Download →";

  return (
    <ToolShell name="Redact PDF" description="Permanently black out text, numbers and images in a PDF. Everything stays in your browser." icon="⬛"
      svgIcon={<RedactIcon />}
      steps={file ? undefined : ["Upload your PDF", "Mark or search what to hide", "Download the redacted PDF"]}>
      {!file && (
        <>
          <UploadZone onFilesAdded={f => { reset(); setFile(f[0]); }} disabled={loading} />
          {err && <p className="text-red-600 text-sm mt-3 text-center">{err}</p>}
        </>
      )}

      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<RedactIcon size={16} />}
            title="Redact PDF"
            subtitle={`${file.name}${pageUrls.length ? ` · ${plural(pageUrls.length, "page")}` : ""}`}
            onReset={reset}
            primaryLabel={primaryLabel}
            onPrimary={handleRedact}
            primaryDisabled={!boxes.length || status === "processing" || loading || status === "done"}
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
              <form onSubmit={onSearch} className="border border-gray-200 rounded-2xl p-3 space-y-2">
                <label htmlFor="redact-search" className="text-xs font-semibold text-gray-600">Find text to redact</label>
                <div className="flex gap-2">
                  <input id="redact-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. John Smith" disabled={!pageUrls.length}
                    className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <button type="submit" disabled={!query.trim() || searching || !pageUrls.length}
                    className="px-3 py-2 text-xs font-bold bg-gray-900 text-white rounded-xl disabled:opacity-40 hover:bg-black">
                    {searching ? "…" : "Mark all"}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={wholeWord} onChange={e => setWholeWord(e.target.checked)} className="accent-red-600" />
                  Whole words only
                </label>
                <div className="pt-1">
                  <p className="text-xs text-gray-500 mb-1.5">Quick find</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map(p => (
                      <button key={p.key} type="button" disabled={searching || !pageUrls.length}
                        onClick={() => runSearch(REDACT_PRESETS[p.key](), p.label)}
                        className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-600 disabled:opacity-40">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {searchMsg && <p className="text-xs text-gray-600" role="status">{searchMsg}</p>}
                <p className="text-[11px] text-gray-400">Search only finds real text. Scanned pages need boxes drawn by hand.</p>
              </form>

              <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Marked areas ({boxes.length})</p>
                  {boxes.length > 0 && (
                    <button onClick={() => { changeBoxes(() => []); setSelectedId(null); }} className="text-xs text-gray-400 hover:text-red-600">Clear all</button>
                  )}
                </div>
                {boxes.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    {drawMode ? "Drag on a page to draw a box, or use search above." : "Turn on drawing to add boxes by hand."}
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-auto">
                    {pagesWithBoxes.map(p => {
                      const count = boxes.filter(b => b.page === p).length;
                      return (
                        <li key={p} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                          <button onClick={() => pageRefs.current[p - 1]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            className="text-gray-700 hover:text-red-600 font-medium">
                            Page {p} · {plural(count, "box")}
                          </button>
                          <button onClick={() => { changeBoxes(bs => bs.filter(b => b.page !== p)); setSelectedId(null); }}
                            className="text-gray-400 hover:text-red-600">Clear</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {selectedId && (
                  <button onClick={() => removeBox(selectedId)}
                    className="w-full py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                    ✕ Remove selected box
                  </button>
                )}
                <label className="flex items-center gap-2 text-xs text-gray-600 pt-1">
                  <input type="checkbox" checked={drawMode} onChange={e => setDrawMode(e.target.checked)} className="accent-red-600" />
                  Draw boxes on pages <span className="text-gray-400">(turn off to scroll on touch screens)</span>
                </label>
              </div>

              <div className="border border-red-300 bg-red-50 rounded-2xl p-3 text-xs text-red-800 space-y-1.5" role="note">
                <p className="font-bold">Redaction is permanent</p>
                <p>Everything under a black box (text, images, form values) is destroyed and can&apos;t be recovered from the downloaded file.</p>
                <p>Pages you mark become images: their remaining text can no longer be selected, searched or copied. Pages without boxes keep their text.</p>
                <p>Document info (title, author), bookmarks, form fields and attachments are removed. Search boxes are estimates, so zoom in and check each one covers the text fully.</p>
              </div>

              {err && <p className="text-red-600 text-xs" role="alert">{err}</p>}
              {status === "done" && resultMsg && (
                <p className="text-green-700 text-xs font-semibold" role="status">✓ Downloaded. {resultMsg}</p>
              )}
              {status === "done" ? (
                <button onClick={reset} className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-sm hover:bg-red-700">
                  Redact another PDF
                </button>
              ) : (
                <button onClick={handleRedact} disabled={!boxes.length || status === "processing" || loading}
                  className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 hover:bg-red-700 transition-colors">
                  {status === "processing" ? "Redacting…" : boxes.length ? "Redact & Download →" : "Mark an area to redact"}
                </button>
              )}
            </div>

            {/* ─── RIGHT PANEL: pages ─── */}
            <div className="flex-1 min-w-0 w-full">
              <div className="relative overflow-auto bg-gray-300 rounded-2xl border border-gray-200" style={{ height: "75vh" }}>
                {loading && (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">Rendering pages…</div>
                )}
                <div className="flex flex-col items-center gap-4 p-4" style={{ minWidth: pageDisplayWidth + 32 }}>
                  {pageUrls.map((url, i) => {
                    const page = i + 1;
                    return (
                      <div key={i}
                        ref={el => { pageRefs.current[i] = el; }}
                        className="relative flex-shrink-0 shadow-xl bg-white select-none"
                        style={{ width: pageDisplayWidth, touchAction: drawMode ? "none" : "auto", cursor: drawMode ? "crosshair" : "default" }}
                        onPointerDown={e => onPagePointerDown(e, page)}
                        onPointerMove={onPagePointerMove}
                        onPointerUp={endInteraction}
                        onPointerCancel={endInteraction}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Page ${page}`} draggable={false} style={{ width: "100%", display: "block" }} />

                        {boxes.filter(b => b.page === page).map(b => {
                          const selected = b.id === selectedId;
                          return (
                            <div key={b.id}
                              onPointerDown={e => onBoxPointerDown(e, b)}
                              className={`absolute ${selected ? "ring-2 ring-red-500" : "ring-1 ring-red-400/70"}`}
                              style={{
                                left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`,
                                background: "rgba(0,0,0,0.6)", cursor: "move", touchAction: "none", zIndex: selected ? 20 : 10,
                              }}>
                              {selected && (
                                <>
                                  {(["nw", "ne", "sw", "se"] as const).map(c => (
                                    <div key={c}
                                      onPointerDown={e => onHandlePointerDown(e, b, c)}
                                      className="absolute w-4 h-4 bg-white border-2 border-red-600 rounded-sm"
                                      style={{
                                        left: c.includes("w") ? -8 : undefined, right: c.includes("e") ? -8 : undefined,
                                        top: c.includes("n") ? -8 : undefined, bottom: c.includes("s") ? -8 : undefined,
                                        cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize", touchAction: "none",
                                      }} />
                                  ))}
                                  <button
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={e => { e.stopPropagation(); removeBox(b.id); }}
                                    aria-label="Remove box"
                                    className="absolute -top-7 right-0 h-6 px-2 rounded-full bg-red-600 text-white text-xs shadow">
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}

                        {draft && draft.page === page && (
                          <div className="absolute border-2 border-dashed border-red-600 pointer-events-none"
                            style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%`, background: "rgba(0,0,0,0.35)" }} />
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

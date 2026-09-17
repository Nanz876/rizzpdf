"use client";
import { logTool } from "@/lib/logTool";

import { useCallback, useState } from "react";
import Link from "next/link";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob, type ToolResult } from "@/lib/pdf-tools";
import { readFormFields, type FormFieldInfo } from "@/lib/tools/fill-form";
import { runInWorker } from "@/lib/worker/run";

type Status = "idle" | "processing" | "done" | "error";
type FieldValue = string | boolean | string[];
type Values = Record<string, FieldValue>;

const PAGE_BASE_WIDTH = 620; // px at zoom 1
const RENDER_SCALE = 1.5;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function isFieldEmpty(field: FormFieldInfo, value: FieldValue | undefined): boolean {
  switch (field.type) {
    case "checkbox":
      return false; // a checkbox always has a definite on/off value
    case "radio":
      return !value;
    case "dropdown":
    case "optionList": {
      const arr = Array.isArray(value) ? value : value ? [String(value)] : [];
      return arr.filter(Boolean).length === 0;
    }
    case "text":
      return !String(value ?? "").trim();
    default:
      return false; // signature / button / unknown aren't fillable here
  }
}

/** One input/checkbox/radio/select control for a field — reused by the overlay and the side panel. */
function FieldControl({
  field,
  widgetIndex,
  value,
  onChange,
  compact,
  style,
}: {
  field: FormFieldInfo;
  /** Which widget this control renders for (radio fields pair widgets to options by index). */
  widgetIndex?: number;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const disabled = field.readOnly;
  const base = compact
    ? "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
    : "w-full h-full px-1 bg-blue-50/70 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400";

  if (field.type === "text") {
    const text = String(value ?? "");
    return field.multiline ? (
      <textarea
        disabled={disabled}
        value={text}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={`${base} resize-none`}
        style={style}
      />
    ) : (
      <input
        type="text"
        disabled={disabled}
        value={text}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={base}
        style={style}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        disabled={disabled}
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className={compact ? "w-4 h-4 accent-blue-600" : "w-full h-full accent-blue-600 cursor-pointer"}
      />
    );
  }

  if (field.type === "radio") {
    if (compact) {
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="radio"
                name={`side-${field.name}`}
                disabled={disabled}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-blue-600"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    const option = field.options?.[widgetIndex ?? 0] ?? "";
    return (
      <input
        type="radio"
        name={`overlay-${field.name}`}
        disabled={disabled}
        value={option}
        checked={value === option}
        onChange={() => onChange(option)}
        className="w-full h-full accent-blue-600 cursor-pointer"
      />
    );
  }

  if (field.type === "dropdown" || field.type === "optionList") {
    const selected = Array.isArray(value) ? (value[0] ?? "") : String(value ?? "");
    return (
      <select
        disabled={disabled}
        value={selected}
        onChange={(e) => onChange([e.target.value])}
        className={base}
        style={style}
      >
        <option value="">— Select —</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return <span className="text-xs text-gray-400 italic">Not fillable here</span>;
}

export default function FillFormPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [values, setValues] = useState<Values>({});
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [flatten, setFlatten] = useState(false);
  const [noFields, setNoFields] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setStatus("idle");
    setErr("");
    setLoading(true);
    setFields([]);
    setValues({});
    setPageUrls([]);
    setNoFields(false);
    setMissingRequired([]);

    try {
      const info = await readFormFields(f);
      if (!info.length) {
        setNoFields(true);
        setLoading(false);
        return;
      }
      setFields(info);
      const initial: Values = {};
      info.forEach((fld) => {
        initial[fld.name] = fld.value;
      });
      setValues(initial);

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const data = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
      const urls: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const vp = pg.getViewport({ scale: RENDER_SCALE });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await pg.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp }).promise;
        urls.push(c.toDataURL("image/jpeg", 0.92));
      }
      setPageUrls(urls);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "This file couldn't be opened. Make sure it's a valid PDF.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setValue = (name: string, v: FieldValue) => setValues((vs) => ({ ...vs, [name]: v }));

  const doFill = async (bypassRequiredCheck: boolean) => {
    if (!file) return;
    if (!bypassRequiredCheck) {
      const missing = fields.filter((f) => f.required && !f.readOnly && isFieldEmpty(f, values[f.name])).map((f) => f.name);
      if (missing.length) {
        setMissingRequired(missing);
        return;
      }
    }
    setMissingRequired([]);
    logTool("fill-form");
    setStatus("processing");
    setErr("");
    const result = await runInWorker<ToolResult>("fillForm", file, values, { flatten });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_filled.pdf"));
      setStatus("done");
    } else {
      setErr(result.error ?? "Failed to fill PDF form.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPageUrls([]);
    setFields([]);
    setValues({});
    setStatus("idle");
    setErr("");
    setNoFields(false);
    setMissingRequired([]);
    setFlatten(false);
    setZoom(1);
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], ZOOM_STEPS[ZOOM_STEPS.indexOf(z) + 1] ?? z * 1.25));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_STEPS[0], ZOOM_STEPS[ZOOM_STEPS.indexOf(z) - 1] ?? z * 0.8));

  const pageDisplayWidth = PAGE_BASE_WIDTH * zoom;
  const overlayFontSize = `${Math.max(9, Math.round(11 * zoom))}px`;

  return (
    <ToolShell
      name="Fill PDF Form"
      description="Fill in a PDF's form fields — text, checkboxes, radios and dropdowns — right in your browser."
      icon="📝"
      svgIcon={
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.8" />
          <path d="M7.5 8h9M7.5 12h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="7.2" y="15" width="3" height="3" rx="0.6" stroke="white" strokeWidth="1.6" />
          <path d="M13.5 16.5h3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      }
      steps={!file ? ["Upload your PDF", "Fill in the fields", "Download the result"] : undefined}
    >
      {!file && <UploadZone onFilesAdded={handleFile} disabled={loading} />}
      {!file && err && <p className="text-red-600 text-sm mt-3 text-center">{err}</p>}
      {loading && <div className="text-center py-12 text-gray-400">Reading form fields…</div>}

      {file && !loading && noFields && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-3">
          <p className="text-gray-700 font-medium">This PDF has no fillable form fields.</p>
          <p className="text-sm text-gray-500">
            To add text anywhere on a PDF, use the{" "}
            <Link href="/tools/sign" className="text-red-600 font-semibold hover:underline">
              Sign tool&apos;s Add text
            </Link>
            .
          </p>
          <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">
            Try another file
          </button>
        </div>
      )}

      {file && !loading && !noFields && fields.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="3" width="16" height="18" rx="2" stroke="white" strokeWidth="2" />
                <path d="M7.5 8h9M7.5 12h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            }
            title="Fill PDF Form"
            subtitle={`${file.name} · ${fields.length} field${fields.length === 1 ? "" : "s"} · ${pageUrls.length} page${pageUrls.length === 1 ? "" : "s"}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Filling…" : status === "done" ? "✓ Downloaded!" : "Fill & Download →"}
            onPrimary={status === "done" ? reset : () => doFill(false)}
            primaryDisabled={status === "processing"}
          >
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={flatten}
                onChange={(e) => setFlatten(e.target.checked)}
                className="accent-blue-600"
              />
              Flatten after filling (values can&apos;t be edited afterwards)
            </label>
          </WorkspaceBar>

          {err && <p className="text-red-500 text-sm px-5 py-3">{err}</p>}

          {missingRequired.length > 0 && (
            <div className="mx-5 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
              <span>
                <span className="font-semibold">Missing required field{missingRequired.length > 1 ? "s" : ""}:</span>{" "}
                {missingRequired.join(", ")}
              </span>
              <button onClick={() => doFill(true)} className="text-xs font-bold text-amber-900 underline shrink-0">
                Download anyway
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4 p-5">
            {/* ─── SIDE PANEL: accessible field list ─── */}
            <div className="w-full lg:w-72 shrink-0 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fields</p>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {fields.map((f) => (
                  <div key={f.name} className="space-y-1">
                    <label className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                      <span className="truncate">{f.name}</span>
                      {f.required && <span className="text-red-500 shrink-0">*</span>}
                      {f.readOnly && <span className="text-[10px] text-gray-400 font-normal shrink-0">(read-only)</span>}
                    </label>
                    <FieldControl field={f} value={values[f.name]} onChange={(v) => setValue(f.name, v)} compact />
                    {f.maxLength !== undefined && (
                      <p className="text-[10px] text-gray-400 text-right">
                        {String(values[f.name] ?? "").length}/{f.maxLength}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ─── PDF PREVIEW with overlaid controls ─── */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-gray-500 font-medium">Zoom</span>
                <button
                  onClick={zoomOut}
                  disabled={zoom <= ZOOM_STEPS[0]}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-xs text-gray-700 font-semibold w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={zoomIn}
                  disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold flex items-center justify-center"
                >
                  +
                </button>
                <button onClick={() => setZoom(1)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
                  Reset
                </button>
              </div>

              <div className="relative overflow-auto bg-gray-300 rounded-2xl border border-gray-200 p-4" style={{ height: "70vh" }}>
                <div className="flex flex-col items-center gap-4" style={{ minWidth: pageDisplayWidth }}>
                  {pageUrls.map((url, pageIdx) => (
                    <div key={pageIdx} className="relative flex-shrink-0" style={{ width: pageDisplayWidth }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Page ${pageIdx + 1}`}
                        draggable={false}
                        style={{ width: "100%", display: "block" }}
                        className="shadow-xl rounded"
                      />
                      {fields.flatMap((f) =>
                        f.widgets.map((w, wi) => {
                          if (w.page !== pageIdx + 1) return null;
                          if (f.type === "signature" || f.type === "button" || f.type === "unknown") return null;
                          return (
                            <div
                              key={`${f.name}-${wi}`}
                              style={{
                                position: "absolute",
                                left: `${w.x * 100}%`,
                                top: `${w.y * 100}%`,
                                width: `${w.w * 100}%`,
                                height: `${w.h * 100}%`,
                              }}
                            >
                              <FieldControl
                                field={f}
                                widgetIndex={wi}
                                value={values[f.name]}
                                onChange={(v) => setValue(f.name, v)}
                                style={{ fontSize: overlayFontSize }}
                              />
                            </div>
                          );
                        })
                      )}
                      {pageUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                          {pageIdx + 1} / {pageUrls.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

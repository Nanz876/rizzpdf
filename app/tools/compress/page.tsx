"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { compressPDF, compressToTarget, downloadBlob } from "@/lib/pdf-tools";

type Quality = "low" | "medium" | "high";
type Mode = Quality | "target";

/** Render page 1 of a PDF at a readable size for the before/after comparison. */
async function renderFirstPage(blob: Blob, scale = 1.5): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.9);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}
type Status = "idle" | "ready" | "processing" | "done" | "error";

const QUALITY_OPTS: { value: Quality; label: string; emoji: string; desc: string }[] = [
  { value: "low", label: "Extreme", emoji: "🔥", desc: "Smallest file — lower visual fidelity" },
  { value: "medium", label: "Recommended", emoji: "✅", desc: "Good balance of size and sharpness" },
  { value: "high", label: "Less", emoji: "🎯", desc: "Near-original sharpness, modest savings" },
];

const TARGET_CHIPS: { label: string; mb: number }[] = [
  { label: "10 MB (email)", mb: 10 },
  { label: "5 MB", mb: 5 },
  { label: "2 MB", mb: 2 },
  { label: "1 MB", mb: 1 },
];

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("medium");
  const [targetMB, setTargetMB] = useState(5);
  const [targetError, setTargetError] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [origSize, setOrigSize] = useState(0);
  const [newSize, setNewSize] = useState(0);
  const [result, setResult] = useState<{
    blob: Blob;
    filename: string;
    reachedTarget?: boolean;
    settingsUsed?: string;
  } | null>(null);
  const [preview, setPreview] = useState<{ before: string; after: string } | null>(null);

  // Build the before/after preview whenever a new result arrives.
  useEffect(() => {
    if (!file || !result) return;
    let alive = true;
    Promise.all([renderFirstPage(file), renderFirstPage(result.blob)])
      .then(([before, after]) => { if (alive) setPreview({ before, after }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [file, result]);

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setOrigSize(files[0].size); setStatus("ready");
  }, []);

  const validateTarget = (mb: number, orig: number): string => {
    if (!(mb > 0.05)) return "Enter a target size above 0.05 MB.";
    if (mb * 1024 * 1024 >= orig) return "Target size must be smaller than the original file.";
    return "";
  };

  const handleCompress = async () => {
    if (!file) return;
    logTool("compress"); setStatus("processing");
    setPreview(null); setResult(null); setProgressMsg("");

    if (mode === "target") {
      const err = validateTarget(targetMB, origSize);
      if (err) { setTargetError(err); setStatus("ready"); return; }
      setTargetError("");
      const out = await compressToTarget(file, Math.round(targetMB * 1024 * 1024), (msg) => setProgressMsg(msg));
      setProgressMsg("");
      if (out.success && out.blob) {
        setNewSize(out.blob.size);
        setResult({
          blob: out.blob,
          filename: out.filename ?? file.name.replace(/\.pdf$/i, "_compressed.pdf"),
          reachedTarget: out.reachedTarget,
          settingsUsed: out.settingsUsed,
        });
        setError(out.warning ?? "");
        setStatus("done");
      } else { setError(out.error ?? "Compression failed."); setStatus("error"); }
      return;
    }

    const out = await compressPDF(file, mode);
    if (out.success && out.blob) {
      setNewSize(out.blob.size);
      setResult({ blob: out.blob, filename: out.filename ?? file.name.replace(/\.pdf$/i, "_compressed.pdf") });
      setError(out.warning ?? "");
      setStatus("done");
    } else { setError(out.error ?? "Compression failed."); setStatus("error"); }
  };

  const handleDownload = () => {
    if (result) downloadBlob(result.blob, result.filename);
  };

  // Changing the mode after a result lets the user compare again.
  const chooseMode = (m: Mode) => {
    setMode(m);
    setTargetError("");
    if (status === "done" || status === "error") { setStatus("ready"); setResult(null); setPreview(null); }
  };

  // Changing the target after a result lets the user try another size.
  const chooseTarget = (mb: number) => {
    setTargetMB(mb);
    setTargetError("");
    if (status === "done" || status === "error") { setStatus("ready"); setResult(null); setPreview(null); }
  };

  const reset = () => {
    setFile(null); setStatus("idle"); setError(""); setOrigSize(0); setNewSize(0);
    setResult(null); setPreview(null); setProgressMsg(""); setTargetError("");
  };

  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  const primaryLabel =
    status === "processing" ? (progressMsg || "Compressing…")
    : status === "done" ? "Download compressed PDF ↓"
    : "Compress PDF →";

  return (
    <ToolShell name="Compress PDF" description="Shrink PDFs by recompressing embedded images. Text stays fully selectable." icon="📦"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.8"/><path d="M12 12l8-4M12 12v8M12 12L4 8" stroke="white" strokeWidth="1.5"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Choose quality level", "Download compressed file"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" stroke="white" strokeWidth="1.8"/></svg>}
            title="Compress PDF" subtitle={`${file.name} · ${fmt(origSize)}${status === "done" ? ` → ${fmt(newSize)}` : ""}`}
            onReset={reset}
            primaryLabel={primaryLabel}
            onPrimary={status === "done" ? handleDownload : handleCompress}
            primaryDisabled={status === "processing" || (mode === "target" && !!validateTarget(targetMB, origSize))} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          {status === "processing" && progressMsg && (
            <p className="text-sm text-gray-500 px-5 py-2 bg-gray-50 border-b border-gray-100">{progressMsg}</p>
          )}
          {status === "done" && newSize > 0 && (
            <div className="px-5 py-3 bg-green-50 border-b border-green-100 text-sm text-green-700 font-medium">
              Saved {Math.round((1 - newSize / origSize) * 100)}% · {fmt(origSize)} → {fmt(newSize)}
              <span className="text-green-600 font-normal"> · Check the preview, then download. Pick another level below to compare.</span>
              {mode === "target" && (
                <div className="text-xs text-green-600 font-normal mt-1">
                  {result?.reachedTarget ? "✓ Target reached" : "⚠ Target not reached"}
                  {result?.settingsUsed ? ` · used ${result.settingsUsed}` : ""}
                </div>
              )}
            </div>
          )}
          {status === "done" && result ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {(["before", "after"] as const).map((side) => (
                <figure key={side} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <figcaption className="flex justify-between px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                    <span>{side === "before" ? "Original" : "Compressed"}</span>
                    <span>{fmt(side === "before" ? origSize : newSize)}</span>
                  </figcaption>
                  <div className="max-h-[520px] overflow-auto">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview[side]} alt={`${side === "before" ? "Original" : "Compressed"} page 1`} className="w-full block" />
                    ) : (
                      <p className="text-center text-sm text-gray-400 py-16">Rendering preview…</p>
                    )}
                  </div>
                </figure>
              ))}
            </div>
          ) : (
            <PdfPreviewArea files={[file]} />
          )}
          <div className="p-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quality Level</p>
            <div className="grid grid-cols-4 gap-3">
              {QUALITY_OPTS.map(opt => (
                <button key={opt.value} onClick={() => chooseMode(opt.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all
                    ${mode === opt.value ? "border-red-500 bg-red-50" : "border-gray-200 bg-white hover:border-red-300"}`}>
                  <div className="text-2xl mb-2">{opt.emoji}</div>
                  <div className={`text-sm font-bold ${mode === opt.value ? "text-red-700" : "text-gray-900"}`}>{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                </button>
              ))}
              <button onClick={() => chooseMode("target")}
                className={`p-4 rounded-xl border-2 text-left transition-all
                  ${mode === "target" ? "border-red-500 bg-red-50" : "border-gray-200 bg-white hover:border-red-300"}`}>
                <div className="text-2xl mb-2">🎚️</div>
                <div className={`text-sm font-bold ${mode === "target" ? "text-red-700" : "text-gray-900"}`}>Target size</div>
                <div className="text-xs text-gray-400 mt-1">Aim for a specific file size</div>
              </button>
            </div>

            {mode === "target" && (
              <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-white">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Target size (MB)</label>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="number"
                    min={0.05}
                    step={0.1}
                    value={targetMB}
                    onChange={(e) => chooseTarget(parseFloat(e.target.value) || 0)}
                    className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                  />
                  <span className="text-sm text-gray-500">MB</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TARGET_CHIPS.map((chip) => (
                    <button
                      key={chip.mb}
                      type="button"
                      onClick={() => chooseTarget(chip.mb)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors
                        ${targetMB === chip.mb ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-red-300"}`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                {(targetError || validateTarget(targetMB, origSize)) && (
                  <p className="text-xs text-red-500 mt-2">{targetError || validateTarget(targetMB, origSize)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEO copy block */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-2 space-y-4 text-sm text-gray-600 leading-relaxed">
        <h2 className="text-base font-bold text-gray-900">How to compress a PDF to reduce file size</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Upload your PDF using the drop zone above</li>
          <li>Choose a level — <strong>Recommended</strong> works well for most files, or pick <strong>Target size</strong> to aim for an exact size (e.g. under your email attachment limit)</li>
          <li>Click <strong>Compress PDF</strong> to download the smaller file</li>
        </ol>
        <p>
          This tool recompresses only the raster images embedded in your PDF — photos, scans, and graphics.
          Text, fonts, and vector graphics are left completely untouched, so <strong>text stays selectable
          and searchable</strong> in the output. Savings depend on how many images your PDF contains.
        </p>
        <p>
          For very large PDFs with few images, consider{" "}
          <Link href="/tools/delete-pages" className="text-red-600 hover:underline font-medium">removing unnecessary pages</Link>
          {" "}instead — that reduces file size while keeping everything intact.
        </p>
      </div>
    </ToolShell>
  );
}

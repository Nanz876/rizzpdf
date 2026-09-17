"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import PaywallModal from "@/components/PaywallModal";
import { renderThumbnails, downloadBlob } from "@/lib/pdf-tools";
import { toolErrorMessage } from "@/lib/pdf-load";
import { useProStatus } from "@/lib/useProStatus";
import { isScanned, ocrPdf, FREE_OCR_PAGES } from "@/lib/tools/ocr";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "nld", label: "Dutch" },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const OcrIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="16" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8" />
    <path d="M7 8v-.5h4V8M9 7.5V14M7.5 14h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16" cy="14.5" r="3" stroke="white" strokeWidth="1.5" />
    <path d="M18.3 16.8L20.5 19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function OcrPage() {
  const { isPro, loading: proLoading } = useProStatus();

  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanInfo, setScanInfo] = useState<{ scanned: boolean; pageCount: number; textPages: number } | null>(null);
  const [language, setLanguage] = useState("eng");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number; stage: string } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string; text: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  // While pro status is still loading, don't punish the user by locking pages.
  const unlimited = isPro || proLoading;
  const pageLimit = unlimited ? thumbs.length : Math.min(thumbs.length, FREE_OCR_PAGES);
  const locked = thumbs.length > pageLimit;

  const handleFile = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setStatus("loading");
    setError("");
    setResult(null);
    setNotice("");
    try {
      // Sequential on purpose: one pdf.js document open at a time keeps a big
      // scan from being held in memory twice.
      const t = await renderThumbnails(f, 0.4);
      const info = await isScanned(f);
      setThumbs(t);
      setScanInfo(info);
      setSelected(new Set(t.map((_, i) => i + 1)));
      setStatus("ready");
    } catch (e) {
      setFile(null);
      setStatus("idle");
      setError(toolErrorMessage(e, "This file couldn't be opened. Make sure it's a valid PDF."));
    }
  }, []);

  const togglePage = (pageNum: number) => {
    if (pageNum > pageLimit) {
      setShowPaywall(true);
      logTool("event:paywall_shown");
      return;
    }
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(pageNum)) s.delete(pageNum); else s.add(pageNum);
      return s;
    });
    if (status === "done" || status === "error") setStatus("ready");
  };

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({
    dataUrl: url,
    pageNumber: i + 1,
    ...(i + 1 > pageLimit ? { label: "Pro", labelColor: "bg-gray-400" } : {}),
  }));

  const runPages = [...selected].filter(p => p <= pageLimit).sort((a, b) => a - b);

  const handleOcr = async () => {
    if (!file || !runPages.length || status === "processing") return;
    logTool("ocr");
    setStatus("processing");
    setError("");
    setNotice("");
    setResult(null);
    setProgress({ done: 0, total: runPages.length, stage: "Starting the OCR engine…" });

    const r = await ocrPdf(file, {
      pages: runPages,
      language,
      onProgress: (done, total, stage) => setProgress({ done, total, stage }),
    });

    setProgress(null);
    if (r.success && r.blob) {
      const filename = r.filename ?? file.name.replace(/\.pdf$/i, "_ocr.pdf");
      setResult({ blob: r.blob, filename, text: r.text ?? "" });
      setNotice(r.warning ?? "");
      downloadBlob(r.blob, filename); // also records the output for tool chaining
      setStatus("done");
    } else {
      setError(r.error ?? "OCR failed. Please try again.");
      setStatus("error");
    }
  };

  const downloadText = () => {
    if (!result || !file) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, file.name.replace(/\.pdf$/i, "") + ".txt");
  };

  const reset = () => {
    setFile(null);
    setThumbs([]);
    setSelected(new Set());
    setScanInfo(null);
    setStatus("idle");
    setError("");
    setProgress(null);
    setResult(null);
    setNotice("");
  };

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolShell
      name="OCR PDF"
      description="Turn a scanned PDF into one you can search, select and copy. Runs in your browser — the file never leaves your device."
      icon="🔎"
      svgIcon={<OcrIcon />}
      steps={file ? undefined : ["Upload your scanned PDF", "Pick pages and language", "Download the searchable PDF"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Opening your PDF…</div>}

      {file && status !== "loading" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<OcrIcon size={16} />}
            title="OCR PDF"
            subtitle={`${file.name} · ${plural(thumbs.length, "page")}`}
            onReset={reset}
            primaryLabel={
              status === "processing" ? `Reading… ${pct}%`
              : status === "done" ? "✓ Downloaded"
              : `Make ${plural(runPages.length, "page")} searchable →`
            }
            onPrimary={status === "done" ? reset : handleOcr}
            primaryDisabled={!runPages.length || status === "processing"}
          />

          <div className="p-5 bg-gray-50 space-y-5">
            {scanInfo && (
              <div
                className={`rounded-xl border p-3 text-xs ${
                  scanInfo.scanned ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
                }`}
                role="note"
              >
                {scanInfo.scanned ? (
                  <>
                    <span className="font-bold">This looks like a scan.</span>{" "}
                    {plural(scanInfo.pageCount - scanInfo.textPages, "page")} of {scanInfo.pageCount} have no text layer, so
                    nothing on them can be searched or copied yet. OCR will fix that.
                  </>
                ) : (
                  <>
                    <span className="font-bold">This PDF already has text.</span>{" "}
                    {plural(scanInfo.textPages, "page")} of {scanInfo.pageCount} can already be searched and copied. You can still
                    run OCR, but those pages will be replaced by images of themselves, which usually makes the text worse.
                  </>
                )}
              </div>
            )}

            <div>
              <label htmlFor="ocr-language" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Language of the text
              </label>
              <select
                id="ocr-language"
                value={language}
                onChange={e => { setLanguage(e.target.value); if (status === "done" || status === "error") setStatus("ready"); }}
                disabled={status === "processing"}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                The language model (a few MB) is downloaded from the OCR engine&apos;s CDN the first time. Your PDF is not uploaded.
              </p>
            </div>

            {locked && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Free accounts read the first {FREE_OCR_PAGES} pages of a document. Pages {FREE_OCR_PAGES + 1}–{thumbs.length}{" "}
                  will be copied through unchanged.
                </span>
                <button
                  onClick={() => { setShowPaywall(true); logTool("event:paywall_shown"); }}
                  className="font-bold text-red-600 hover:underline"
                >
                  Unlock every page with Pro →
                </button>
              </div>
            )}

            {status === "processing" && progress && (
              <div role="status" aria-live="polite" className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
                  <span>{progress.stage}</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${Math.max(pct, 4)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Usually 1–5 seconds a page, longer on dense or noisy scans and on slower devices. Keep this tab open.
                </p>
              </div>
            )}

            {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}

            {status === "done" && result && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                <p className="text-sm font-bold text-green-800">
                  ✓ {plural(runPages.length, "page")} read. Your searchable PDF has downloaded.
                </p>
                {notice && <p className="text-xs text-green-900">{notice}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadBlob(result.blob, result.filename)}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                  >
                    Download searchable PDF
                  </button>
                  <button
                    onClick={downloadText}
                    disabled={!result.text.trim()}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:border-red-300 disabled:opacity-40"
                  >
                    Download text (.txt)
                  </button>
                  <button onClick={reset} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-red-600">
                    OCR another PDF
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">Click pages to select / deselect</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(new Set(Array.from({ length: pageLimit }, (_, i) => i + 1)))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-xs text-gray-300">·</span>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">
                    Deselect all
                  </button>
                </div>
              </div>
              {/* Pages past the free limit never show as selected, so what's ticked is what runs. */}
              <ThumbnailGrid pages={pages} selectedPages={new Set(runPages)} onToggleSelect={togglePage} showCheckboxes columns={4} />
            </div>
          </div>
        </div>
      )}

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </ToolShell>
  );
}

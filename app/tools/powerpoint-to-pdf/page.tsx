"use client";
import { logTool } from "@/lib/logTool";
import { useState, useRef } from "react";
import ToolShell from "@/components/ToolShell";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob } from "@/lib/pdf-tools";
import { powerpointToPdf, readSlideCount } from "@/lib/tools/powerpoint-to-pdf";

type Status = "idle" | "ready" | "processing" | "done" | "error";

const ACCEPT = ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export default function PowerPointToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setStatus("ready");
    setError("");
    setWarning("");
    setSlides(null);
    setProgress({ done: 0, total: 0 });
    try {
      setSlides(await readSlideCount(picked));
    } catch (e) {
      setSlides(null);
      setError(e instanceof Error ? e.message : "This file couldn't be read as a PowerPoint presentation.");
      setStatus("error");
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    logTool("powerpoint-to-pdf");
    setStatus("processing");
    setError("");
    setWarning("");
    setProgress({ done: 0, total: slides ?? 0 });
    const result = await powerpointToPdf(file, {
      onProgress: (done, total) => setProgress({ done, total }),
    });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pptx?$/i, "") + ".pdf");
      setWarning(result.warning ?? "");
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setSlides(null);
    setStatus("idle");
    setError("");
    setWarning("");
    setProgress({ done: 0, total: 0 });
  };

  const fmt = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);
  const subtitle = file
    ? `${file.name} · ${fmt(file.size)}${slides !== null ? ` · ${slides} slide${slides === 1 ? "" : "s"}` : ""}`
    : "";
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolShell
      name="PowerPoint to PDF"
      description="Convert a PowerPoint deck to a PDF — one page per slide, with text you can still select and search. Runs entirely in your browser; the file never leaves your device."
      icon="📊"
      svgIcon={
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="13" rx="2" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.8" />
          <path d="M8 20h8M12 17v3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 12l3-3 2.5 2.5L16 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
      steps={file ? undefined : ["Upload your .pptx", "Click Convert", "Download the PDF"]}
    >
      {!file ? (
        <div
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(Array.from(e.dataTransfer.files)[0]);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all
            ${dragOver ? "border-red-500 bg-red-50" : "border-gray-200 bg-gray-50 hover:border-red-400 hover:bg-red-50/30"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-lg font-bold text-gray-800">Drop your PowerPoint here</p>
          <p className="text-sm text-gray-500 mt-1">
            or <span className="text-red-600 font-semibold">click to browse</span> — .pptx files
          </p>
          <p className="text-xs text-gray-400 mt-3">🔒 Files never leave your browser · No account needed</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="13" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5" />
                <path d="M8 20h8M12 17v3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            title="PowerPoint to PDF"
            subtitle={subtitle}
            onReset={reset}
            primaryLabel={
              status === "processing"
                ? progress.total
                  ? `Converting ${progress.done}/${progress.total}…`
                  : "Converting…"
                : status === "done"
                  ? "✓ Downloaded!"
                  : "Convert & Download →"
            }
            onPrimary={status === "done" ? reset : handleConvert}
            primaryDisabled={status === "processing" || (status === "error" && slides === null)}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}

          <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
            {status === "processing" && (
              <div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-red-600 transition-all duration-150" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {progress.total
                    ? `Slide ${progress.done} of ${progress.total}`
                    : "Reading the presentation…"}
                </p>
              </div>
            )}

            {status === "done" && (
              <p className="text-sm text-green-600 font-semibold">
                ✓ PDF downloaded{progress.total ? ` · ${progress.total} page${progress.total === 1 ? "" : "s"}` : ""}
              </p>
            )}
            {warning && <p className="text-sm text-amber-600">⚠️ {warning}</p>}

            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>
                Conversion happens in your browser — the deck is never uploaded. Each slide becomes one page at the
                deck&apos;s own size, and text stays selectable. Text, pictures (PNG and JPEG), positions, sizes,
                colours, bold/italic, alignment and simple tables are re-created. Animations, transitions, videos,
                audio, charts, SmartArt, gradients, shape rotation, slide-master backgrounds and speaker notes are
                not — and text is drawn in the built-in Helvetica family, so custom fonts and non-Latin scripts
                (Chinese, Japanese, Arabic, Cyrillic) won&apos;t come through.
              </p>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

"use client";
import { useCallback, useRef, useState } from "react";
import ToolShell from "@/components/ToolShell";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { logTool } from "@/lib/logTool";
import { downloadBlob } from "@/lib/pdf-tools";
import { wordToPdf } from "@/lib/tools/word-to-pdf";

type Status = "idle" | "ready" | "processing" | "done" | "error";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 100 * 1024 * 1024;

function isDocx(file: File) {
  return /\.docx$/i.test(file.name) || file.type === DOCX_MIME;
}

/** Drop zone for .docx files — UploadZone only accepts PDFs. */
function DocxDropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState("");

  const take = useCallback(
    (files: FileList | null) => {
      const all = files ? Array.from(files) : [];
      const file = all.find(isDocx);
      if (!file) {
        setRejected(
          all.some((f) => /\.docx?$/i.test(f.name))
            ? "That looks like an old .doc file. Save it as .docx in Word first."
            : "Pick a Word .docx document."
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        setRejected("That document is over 100MB.");
        return;
      }
      setRejected("");
      onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 cursor-pointer ${
        dragging
          ? "border-red-500 bg-red-50 scale-[1.01]"
          : "border-gray-200 bg-gray-50 hover:border-red-400 hover:bg-red-50/30"
      }`}
    >
      <input
        type="file"
        accept={`.docx,${DOCX_MIME}`}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">
            {dragging ? "Drop it right here" : "Drop your Word document here"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or <span className="text-red-600 font-semibold">click to browse</span> — .docx files up to 100MB
          </p>
        </div>
        <p className="text-xs text-gray-400">🔒 Files never leave your browser · No account needed</p>
        {rejected && <p className="text-xs text-amber-600 font-medium mt-1">⚠️ {rejected}</p>}
      </div>
    </div>
  );
}

export default function WordToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("Letter");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const lastPaint = useRef(0);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setStatus("ready");
    setError("");
    setWarning("");
    setProgress(null);
  }, []);

  const convert = async () => {
    if (!file) return;
    logTool("word-to-pdf");
    setStatus("processing");
    setError("");
    setWarning("");
    setProgress({ done: 0, total: 1 });
    const result = await wordToPdf(file, {
      pageSize,
      onProgress: (done, total) => {
        // Repaint at most ~20x a second; a 300-page report has thousands of blocks.
        const now = Date.now();
        if (done === total || now - lastPaint.current > 50) {
          lastPaint.current = now;
          setProgress({ done, total });
        }
      },
    });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.docx$/i, ".pdf"));
      setWarning(result.warning ?? "");
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed.");
      setStatus("error");
    }
    setProgress(null);
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setError("");
    setWarning("");
    setProgress(null);
  };

  const fmt = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolShell
      name="Word to PDF"
      description="Convert a Word .docx into a PDF with real, selectable text. Runs entirely in your browser — the document never leaves your device."
      icon="📄"
      steps={file ? undefined : ["Upload your .docx", "Choose A4 or Letter", "Download the PDF"]}
    >
      {!file && <DocxDropZone onFile={handleFile} />}

      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5" />
                <path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            title="Word to PDF"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={
              status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : "Convert & Download →"
            }
            onPrimary={status === "done" ? reset : convert}
            primaryDisabled={status === "processing"}
          >
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              Page size
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as "A4" | "Letter")}
                disabled={status === "processing"}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 bg-white disabled:opacity-40"
              >
                <option value="Letter">Letter</option>
                <option value="A4">A4</option>
              </select>
            </label>
          </WorkspaceBar>

          <div className="p-6 space-y-4">
            {status === "processing" && progress && (
              <div role="status" aria-live="polite" className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
                  <span>Laying out your document</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-200" style={{ width: `${Math.max(pct, 4)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-2">Long documents take a few seconds. Keep this tab open.</p>
              </div>
            )}

            {error && (
              <p className="text-red-600 text-sm" role="alert">
                {error}
              </p>
            )}

            {status === "done" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-1">
                <p className="text-sm font-bold text-green-800">✓ Your PDF has downloaded.</p>
                {warning && <p className="text-xs text-green-900">{warning}</p>}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 space-y-2">
              <p className="font-bold text-gray-800">What you get</p>
              <p>
                The text in your PDF is real, selectable text — not a picture of a document. Headings, bold, italic and
                underline, bulleted and numbered lists, tables, pictures and hyperlinks are all re-created.
              </p>
              <p className="text-gray-500">
                The layout is close to Word, not identical to it. Line breaks and page breaks are recalculated here, so
                pagination can differ, and headers and footers, multi-column layouts, floating text boxes and charts are
                not carried over. Text in fonts outside the Western European (Latin) range can&apos;t be drawn — you
                will get a clear message instead of a broken file.
              </p>
            </div>

            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>Conversion happens on your device. Nothing is uploaded, and nothing is stored.</p>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob } from "@/lib/pdf-tools";
import { pdfToMarkdown } from "@/lib/tools/pdf-to-markdown";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function PdfToMarkdownPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [markdown, setMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError(""); setMarkdown("");
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    logTool("pdf-to-markdown"); setStatus("processing"); setError("");
    const result = await pdfToMarkdown(file);
    if (result.success && result.markdown !== undefined) {
      setMarkdown(result.markdown);
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed.");
      setStatus("error");
    }
  };

  const download = () => {
    if (!file || !markdown) return;
    downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), file.name.replace(/\.pdf$/i, "") + ".md");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to clipboard — use Download instead.");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setMarkdown(""); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="PDF to Markdown"
      description="Convert a PDF to clean Markdown — headings, lists and tables preserved. Runs entirely in your browser."
      icon="📝"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" stroke="white" strokeWidth="1.8"/><path d="M6 15V9l3 3 3-3v6M17 9v6M17 15l2-2M17 15l-2-2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Click Convert", "Copy or download .md"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" stroke="white" strokeWidth="1.5"/><path d="M6 15V9l3 3 3-3v6" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            title="PDF to Markdown"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "Convert again" : "Convert →"}
            onPrimary={status === "done" ? handleConvert : handleConvert}
            primaryDisabled={status === "processing"}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}

          {status === "done" && (
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                <button onClick={copy} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
                  {copied ? "✓ Copied" : "Copy Markdown"}
                </button>
                <button onClick={download} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:border-red-400 hover:text-red-600 transition-colors">
                  Download .md
                </button>
              </div>
              <textarea
                readOnly
                value={markdown}
                className="w-full h-96 font-mono text-xs border border-gray-200 rounded-xl p-4 bg-gray-50 focus:outline-none focus:border-red-400 resize-y"
              />
            </div>
          )}

          <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p>Great for feeding documents to LLMs, wikis or static-site generators. Font-size hierarchy becomes headings, bullet and numbered lists are kept, and column-aligned rows become Markdown tables. Scanned PDFs need OCR first.</p>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

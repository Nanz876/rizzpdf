"use client";
import { logTool } from "@/lib/logTool";
import { useCallback, useState } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { downloadBlob } from "@/lib/pdf-tools";
import { flattenPDF, countFlattenable } from "@/lib/tools/flatten";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function FlattenPage() {
  const [file, setFile] = useState<File | null>(null);
  const [counts, setCounts] = useState<{ fields: number; annotations: number } | null>(null);
  const [forms, setForms] = useState(true);
  const [annotations, setAnnotations] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    try {
      const c = await countFlattenable(files[0]);
      setCounts(c);
      setStatus("ready");
    } catch (e) {
      setFile(null); setStatus("idle");
      setError(e instanceof Error ? e.message : "This file couldn't be opened.");
    }
  }, []);

  const handleApply = async () => {
    if (!file) return;
    logTool("flatten"); setStatus("processing"); setWarning("");
    const result = await flattenPDF(file, { forms, annotations });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_flattened.pdf"));
      if (result.warning) setWarning(result.warning);
      setStatus("done");
    } else {
      setError(result.error ?? "Failed to flatten PDF."); setStatus("error");
    }
  };

  const reset = () => {
    setFile(null); setCounts(null); setStatus("idle"); setError(""); setWarning("");
    setForms(true); setAnnotations(true);
  };

  const countsLabel = counts
    ? `${counts.fields} form field${counts.fields === 1 ? "" : "s"}, ${counts.annotations} annotation${counts.annotations === 1 ? "" : "s"}`
    : "";

  return (
    <ToolShell name="Flatten PDF" description="Bake form fields and annotations permanently into the page."
      icon="📌"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      steps={file ? undefined : ["Upload your PDF", "Choose what to flatten", "Download result"]}>
      {!file && <UploadZone onFilesAdded={handleFile} disabled={status === "loading"} />}
      {!file && error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Reading PDF…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            title="Flatten PDF" subtitle={`${file.name}${counts ? ` · ${countsLabel}` : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Flattening…" : status === "done" ? "✓ Downloaded!" : "Flatten PDF →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={(!forms && !annotations) || status === "processing"}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          {warning && <p className="text-amber-600 text-sm px-5 py-2">{warning}</p>}
          <PdfPreviewArea files={[file]} />
          <div className="p-5 bg-gray-50 border-t border-gray-100 space-y-4">
            {counts && (
              <p className="text-sm text-gray-600">
                This PDF has <strong>{countsLabel}</strong>.
              </p>
            )}
            <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 rounded-xl p-3">
              <input type="checkbox" checked={forms} onChange={(e) => setForms(e.target.checked)} className="accent-red-600 mt-0.5" />
              <span>
                <span className="font-semibold">Flatten form fields</span>
                <br />
                <span className="text-xs text-gray-500">Filled-in values become part of the page. The form can no longer be filled or edited afterwards.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 rounded-xl p-3">
              <input type="checkbox" checked={annotations} onChange={(e) => setAnnotations(e.target.checked)} className="accent-red-600 mt-0.5" />
              <span>
                <span className="font-semibold">Flatten annotations &amp; comments</span>
                <br />
                <span className="text-xs text-gray-500">Sticky notes, highlights, stamps, shapes and text boxes become part of the page and can&apos;t be moved or removed afterwards. Links are left untouched.</span>
              </span>
            </label>
            <p className="text-xs text-gray-400">This can&apos;t be undone — keep a copy of the original if you might need to edit these fields or annotations later.</p>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

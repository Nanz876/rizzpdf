"use client";
import { logTool } from "@/lib/logTool";
import { useCallback, useRef, useState } from "react";
import ToolShell from "@/components/ToolShell";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { downloadBlob } from "@/lib/pdf-tools";
import { readWorkbook, excelToPdf, type SheetInfo } from "@/lib/tools/excel-to-pdf";

type Status = "idle" | "ready" | "processing" | "done" | "error";
type Orientation = "portrait" | "landscape" | "auto";
type PageSize = "A4" | "Letter";

const ICON = (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5" />
    <path d="M8 8h8M8 12h3.5M13.5 12H16M8 16h3.5M13.5 16H16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function ExcelToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [repeatHeader, setRepeatHeader] = useState(true);
  const [gridlines, setGridlines] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isXlsx = (f: File) => /\.xlsx$/i.test(f.name);

  const handleFile = useCallback(async (files: File[]) => {
    const picked = files.find(isXlsx);
    if (!picked) {
      setError("Please choose a .xlsx file.");
      setStatus("error");
      return;
    }
    setFile(picked);
    setError("");
    try {
      const { sheets: info } = await readWorkbook(picked);
      setSheets(info);
      setSelectedSheets(new Set(info.map((s) => s.name)));
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this workbook.");
      setStatus("error");
      setFile(null);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(Array.from(e.dataTransfer.files));
  };

  const toggleSheet = (name: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleConvert = async () => {
    if (!file || selectedSheets.size === 0) return;
    logTool("excel-to-pdf");
    setStatus("processing");
    setError("");
    const result = await excelToPdf(file, {
      sheets: sheets.length === selectedSheets.size ? undefined : [...selectedSheets],
      orientation,
      pageSize,
      repeatHeader,
      gridlines,
    });
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.xlsx$/i, ".pdf"));
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheets(new Set());
    setStatus("idle");
    setError("");
  };

  const fmt = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);

  return (
    <ToolShell
      name="Excel to PDF"
      description="Convert an Excel spreadsheet (.xlsx) into a readable, selectable-text PDF table. Runs entirely in your browser — the file never leaves your device."
      icon="📊"
      steps={file ? undefined : ["Upload your .xlsx file", "Pick sheets & layout", "Download the PDF"]}
    >
      {!file && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200
            ${dragOver ? "border-red-500 bg-red-50 scale-[1.01]" : "border-gray-200 bg-gray-50 hover:border-red-400 hover:bg-red-50/30"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              if (e.target.files) handleFile(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">{dragOver ? "Drop it like it&apos;s hot 🔥" : "Drop your spreadsheet here"}</p>
              <p className="text-sm text-gray-500 mt-1">
                or <span className="text-red-600 font-semibold">click to browse</span> — .xlsx files only
              </p>
            </div>
            <p className="text-xs text-gray-400">🔒 Files never leave your browser · No account needed</p>
            {error && <p className="text-xs text-amber-600 font-medium mt-1">⚠️ {error}</p>}
          </div>
        </div>
      )}

      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={ICON}
            title="Excel to PDF"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : "Convert & Download →"}
            onPrimary={status === "done" ? reset : handleConvert}
            primaryDisabled={status === "processing" || selectedSheets.size === 0}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}

          <div className="p-6 space-y-6">
            {sheets.length > 1 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Sheets to convert</p>
                <div className="flex flex-wrap gap-2">
                  {sheets.map((s) => (
                    <label
                      key={s.name}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors
                        ${selectedSheets.has(s.name) ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    >
                      <input type="checkbox" className="accent-red-600" checked={selectedSheets.has(s.name)} onChange={() => toggleSheet(s.name)} />
                      {s.name}
                      <span className="text-xs text-gray-400">
                        {s.rows}×{s.cols}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Orientation</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as Orientation)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="auto">Auto</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Page size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 mt-5">
                <input type="checkbox" className="accent-red-600" checked={repeatHeader} onChange={(e) => setRepeatHeader(e.target.checked)} />
                Repeat header row
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 mt-5">
                <input type="checkbox" className="accent-red-600" checked={gridlines} onChange={(e) => setGridlines(e.target.checked)} />
                Gridlines
              </label>
            </div>

            <div className="flex items-start gap-3 text-sm text-gray-500 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <svg width="16" height="16" className="mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>
                Conversion happens in your browser. Values, number formatting and column/row layout are re-created as a table. Charts, images,
                conditional formatting and pivot tables aren&apos;t carried over — a wide sheet is split across pages by column groups (with the
                first column repeated) rather than cut off.
              </p>
            </div>
            {status === "done" && <p className="text-sm text-green-600 font-semibold">✓ PDF downloaded</p>}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

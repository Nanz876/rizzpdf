"use client";
import { logTool } from "@/lib/logTool";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PdfPreviewArea from "@/components/PdfPreviewArea";
import { protectPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function ProtectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showOwner, setShowOwner] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleProtect = async () => {
    if (!file || !password.trim()) return;
    logTool("protect"); setStatus("processing"); setError("");
    const result = await protectPDF(file, password.trim(), ownerPassword.trim() || undefined);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_protected.pdf"));
      setStatus("done");
    } else {
      setError(result.error ?? "Protection failed."); setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setPassword(""); setOwnerPassword(""); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="Protect PDF"
      description="Password-protect your PDF. Note: browser encryption support is limited — full AES encryption is a Pro feature."
      icon="🔒"
      steps={file ? undefined : ["Upload your PDF", "Set a password", "Download protected file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="Protect PDF"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Protecting…" : status === "done" ? "✓ Downloaded!" : "Protect & Download →"}
            onPrimary={status === "done" ? reset : handleProtect}
            primaryDisabled={status === "processing" || !password.trim()}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <PdfPreviewArea files={[file]} />
          <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a strong password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowOwner(!showOwner)}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
            >
              {showOwner ? "▲ Hide advanced options" : "▼ Advanced options"}
            </button>
            {showOwner && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Owner password (optional)</label>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Leave blank to use same password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <p className="text-xs text-gray-400 mt-1">Owner password controls editing and printing restrictions.</p>
              </div>
            )}
            {status === "done" && <p className="text-sm text-green-600 font-semibold">✓ PDF protected and downloaded</p>}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

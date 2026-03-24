// app/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import UploadZone from "@/components/UploadZone";
import FileCard, { FileEntry } from "@/components/FileCard";
import PaywallModal from "@/components/PaywallModal";

const FREE_LIMIT = 3;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "RizzPDF",
      "url": "https://www.rizzpdf.com",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "description": "Remove PDF password protection instantly. Free for up to 3 files. No account needed. Files never leave your browser.",
      "offers": [
        { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },
        { "@type": "Offer", "name": "One-time Drop", "price": "1", "priceCurrency": "USD" },
        { "@type": "Offer", "name": "Pro", "price": "7", "priceCurrency": "USD" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is RizzPDF free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes! All tools are free for up to 3 files. Files are processed entirely in your browser." }
        },
        {
          "@type": "Question",
          "name": "Is it safe to unlock my PDFs with RizzPDF?",
          "acceptedAnswer": { "@type": "Answer", "text": "100% safe. All PDF processing happens inside your browser — your files are never uploaded to any server." }
        }
      ]
    }
  ]
};

const TOOLS = [
  { name: "Merge PDF", route: "/tools/merge", iconBg: "#fef2f2", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="#fca5a5"/><path d="M13 6h7v12h-7V6z" fill="#ef4444"/><path d="M10 12h4" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/></svg> },
  { name: "Split PDF", route: "/tools/split", iconBg: "#fff7ed", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5"/><path d="M12 4v16M4 12h16" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/></svg> },
  { name: "Compress PDF", route: "/tools/compress", iconBg: "#f0fdf4", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" fill="#bbf7d0" stroke="#22c55e" strokeWidth="1.5"/><path d="M12 12l8-4M12 12v8M12 12L4 8" stroke="#22c55e" strokeWidth="1.5"/></svg> },
  { name: "Rotate PDF", route: "/tools/rotate", iconBg: "#fef2f2", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { name: "PDF to JPG", route: "/tools/pdf-to-jpg", iconBg: "#eff6ff", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="2" fill="#3b82f6" opacity=".4"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { name: "JPG to PDF", route: "/tools/jpg-to-pdf", iconBg: "#eff6ff", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/><path d="M8 7h8M8 10h8M8 13h5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 17l2-2 2 2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { name: "Sign PDF", route: "/tools/sign", iconBg: "#fdf4ff", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" fill="#e9d5ff" stroke="#a855f7" strokeWidth="1.5"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { name: "Watermark PDF", route: "/tools/watermark", iconBg: "#fff0f9", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.5"/><path d="M10 14l2-4 2 4M11 13h2" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { name: "Organize PDF", route: "/tools/organize", iconBg: "#fefce8", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/></svg> },
  { name: "Delete Pages", route: "/tools/delete-pages", iconBg: "#fff7ed", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5"/><path d="M9 9l6 6M15 9l-6 6" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { name: "Page Numbers", route: "/tools/page-numbers", iconBg: "#f0fdfa", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#99f6e4" stroke="#14b8a6" strokeWidth="1.5"/><path d="M8 8h8M8 12h6" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { name: "Repair PDF", route: "/tools/repair", iconBg: "#f5f3ff", svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 4l1.4 4.2H18l-3.7 2.7 1.4 4.2L12 12.4l-3.7 2.7 1.4-4.2L6 8.2h4.6L12 4z" fill="#ddd6fe" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
];

export default function Home() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) setIsPro(true);
  }, []);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const currentCount = files.length;
      const allowed = isPro ? Infinity : FREE_LIMIT;
      if (currentCount >= allowed) { setShowPaywall(true); return; }
      const toAdd = newFiles.slice(0, allowed - currentCount);
      const overflow = newFiles.length - toAdd.length;
      const entries: FileEntry[] = toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, status: "idle" }));
      setFiles((prev) => [...prev, ...entries]);
      if (overflow > 0) setTimeout(() => setShowPaywall(true), 300);
    },
    [files.length, isPro]
  );

  const handleRemove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);
  const handleStatusChange = useCallback((id: string, status: FileEntry["status"], error?: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));
  }, []);

  const hasFiles = files.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main className="flex-1">
        {/* Hero — Unlock PDF */}
        <section className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              100% private — files processed in your browser
            </div>

            <h1 className="text-5xl sm:text-6xl font-black text-gray-900 leading-tight mb-4">
              Unlock PDFs <span className="text-red-600">instantly</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
              Remove PDF password protection in seconds. Free for up to 3 files. No account. No subscription.
            </p>

            <UploadZone onFilesAdded={handleFilesAdded} />

            {!isPro && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`w-8 h-1.5 rounded-full transition-colors ${i < files.length ? "bg-red-500" : "bg-gray-200"}`} />
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {files.length}/3 free files used
                  {files.length >= FREE_LIMIT && (
                    <button onClick={() => setShowPaywall(true)} className="ml-2 text-red-600 font-semibold hover:underline">
                      Go bulk for $1 →
                    </button>
                  )}
                </span>
              </div>
            )}
            {isPro && <p className="mt-4 text-xs text-green-600 font-semibold">✓ Bulk mode active — unlimited files for 24 hours</p>}
          </div>

          {/* File list */}
          {hasFiles && (
            <div className="max-w-3xl mx-auto px-4 pb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your files ({files.length})</h2>
                <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
              </div>
              <div className="space-y-3">
                {files.map((entry) => (
                  <FileCard key={entry.id} entry={entry} onRemove={handleRemove} onStatusChange={handleStatusChange} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* All PDF Tools */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-gray-900 mb-2">All PDF Tools</h2>
              <p className="text-gray-500 text-sm">Everything you need — free, private, browser-based.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {TOOLS.map(tool => (
                <a key={tool.route} href={tool.route}
                  className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center" style={{ background: tool.iconBg }}>
                    {tool.svg}
                  </div>
                  <div className="text-xs font-bold text-gray-900 mt-2.5 leading-tight">{tool.name}</div>
                </a>
              ))}
            </div>
            <div className="text-center mt-6">
              <a href="/tools" className="text-sm font-semibold text-red-600 hover:underline">View all tools →</a>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} onPay={() => setShowPaywall(false)} />}
    </div>
  );
}

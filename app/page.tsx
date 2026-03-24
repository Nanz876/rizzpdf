// app/page.tsx
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "RizzPDF",
      "url": "https://www.rizzpdf.com",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "description": "Free browser-based PDF toolkit. Merge, split, compress, unlock, rotate and convert PDFs. Files never leave your browser.",
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is RizzPDF free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes! All tools are free. Files are processed entirely in your browser." }
        },
        {
          "@type": "Question",
          "name": "Is it safe to use RizzPDF?",
          "acceptedAnswer": { "@type": "Answer", "text": "100% safe. All PDF processing happens inside your browser — your files are never uploaded to any server." }
        }
      ]
    }
  ]
};

const TOOLS = [
  {
    name: "Unlock PDF", route: "/", category: "PDF Security",
    desc: "Remove PDF password protection instantly",
    iconBg: "#fef2f2",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 018 0v4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Merge PDF", route: "/tools/merge", category: "Organize PDF",
    desc: "Combine multiple PDFs into one",
    iconBg: "#fef2f2",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="#fca5a5"/><path d="M13 6h7v12h-7V6z" fill="#ef4444"/><path d="M10 12h4" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Split PDF", route: "/tools/split", category: "Organize PDF",
    desc: "Split a PDF into multiple files",
    iconBg: "#fff7ed",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5"/><path d="M12 4v16M4 12h16" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/></svg>,
  },
  {
    name: "Compress PDF", route: "/tools/compress", category: "Organize PDF",
    desc: "Reduce PDF file size",
    iconBg: "#f0fdf4",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" fill="#bbf7d0" stroke="#22c55e" strokeWidth="1.5"/><path d="M12 12l8-4M12 12v8M12 12L4 8" stroke="#22c55e" strokeWidth="1.5"/></svg>,
  },
  {
    name: "Rotate PDF", route: "/tools/rotate", category: "Organize PDF",
    desc: "Rotate pages in any direction",
    iconBg: "#fef2f2",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    name: "PDF to JPG", route: "/tools/pdf-to-jpg", category: "Convert PDF",
    desc: "Convert PDF pages to JPG images",
    iconBg: "#eff6ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/><path d="M8 7h8M8 10h8M8 13h5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 17l2-2 2 2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "JPG to PDF", route: "/tools/jpg-to-pdf", category: "Convert PDF",
    desc: "Convert images to a PDF file",
    iconBg: "#eff6ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="2" fill="#3b82f6" opacity=".4"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    name: "PDF to PNG", route: "/tools/pdf-to-png", category: "Convert PDF",
    desc: "Export PDF pages as PNG images",
    iconBg: "#f0fdfa",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#99f6e4" stroke="#14b8a6" strokeWidth="1.5"/><circle cx="9" cy="9" r="2" fill="#14b8a6" opacity=".4"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    name: "Watermark PDF", route: "/tools/watermark", category: "Edit PDF",
    desc: "Add text watermarks to your PDF",
    iconBg: "#fff0f9",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.5"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/><path d="M10 14l2-4 2 4M11 13h2" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Organize PDF", route: "/tools/organize", category: "Organize PDF",
    desc: "Reorder or remove pages visually",
    iconBg: "#fefce8",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/></svg>,
  },
  {
    name: "Page Numbers", route: "/tools/page-numbers", category: "Edit PDF",
    desc: "Add page numbers to your PDF",
    iconBg: "#f0fdfa",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#99f6e4" stroke="#14b8a6" strokeWidth="1.5"/><path d="M8 8h8M8 12h6" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="17" r="2.5" fill="#14b8a6" opacity=".3" stroke="#14b8a6" strokeWidth="1.2"/><path d="M12 16v2" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  {
    name: "Sign PDF", route: "/tools/sign", category: "Edit PDF",
    desc: "Draw or upload your signature",
    iconBg: "#fdf4ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" fill="#e9d5ff" stroke="#a855f7" strokeWidth="1.5"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 20h8" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Delete Pages", route: "/tools/delete-pages", category: "Organize PDF",
    desc: "Remove specific pages from a PDF",
    iconBg: "#fff7ed",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5"/><path d="M9 9l6 6M15 9l-6 6" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    name: "Repair PDF", route: "/tools/repair", category: "PDF Security",
    desc: "Fix corrupted or damaged PDFs",
    iconBg: "#f5f3ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 4l1.4 4.2H18l-3.7 2.7 1.4 4.2L12 12.4l-3.7 2.7 1.4-4.2L6 8.2h4.6L12 4z" fill="#ddd6fe" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  },
];

const CATEGORIES = ["All", "Organize PDF", "Convert PDF", "Edit PDF", "PDF Security"];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");
  const filtered = activeCategory === "All" ? TOOLS : TOOLS.filter(t => t.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
            Your PDF toolkit
          </h1>
          <p className="text-gray-500 text-base">
            Free, private, browser-based. Files never leave your device.
          </p>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors
                ${activeCategory === cat
                  ? "bg-red-600 text-white border-red-600"
                  : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(tool => (
            <a key={tool.route} href={tool.route}
              className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer">
              <div className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center" style={{ background: tool.iconBg }}>
                {tool.svg}
              </div>
              <div className="text-sm font-bold text-gray-900 mt-3 leading-tight">{tool.name}</div>
              <div className="text-xs text-gray-400 mt-1 leading-snug">{tool.desc}</div>
            </a>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

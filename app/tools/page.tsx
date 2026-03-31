"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import ToolIcon from "@/components/ToolIcon";

const TOOLS = [
  // ── Organize PDF ──────────────────────────────────────────────
  {
    name: "Merge PDF", route: "/tools/merge", category: "Organize PDF",
    desc: "Combine multiple PDFs into one",
    icon: <ToolIcon variant="double" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#ef4444" badgeLabel2="PDF" />,
  },
  {
    name: "Split PDF", route: "/tools/split", category: "Organize PDF",
    desc: "Split a PDF into multiple files",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" />,
  },
  {
    name: "Organize PDF", route: "/tools/organize", category: "Organize PDF",
    desc: "Reorder or remove pages visually",
    icon: <ToolIcon variant="single" bgColor="#fefce8" badgeColor="#eab308" badgeLabel="PDF" />,
  },
  {
    name: "Delete Pages", route: "/tools/delete-pages", category: "Organize PDF",
    desc: "Remove specific pages from a PDF",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" />,
  },
  {
    name: "Rotate PDF", route: "/tools/rotate", category: "Organize PDF",
    desc: "Rotate pages in any direction",
    icon: <ToolIcon variant="single" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" />,
  },
  {
    name: "Page Numbers", route: "/tools/page-numbers", category: "Organize PDF",
    desc: "Add page numbers to your PDF",
    icon: <ToolIcon variant="single" bgColor="#f0fdfa" badgeColor="#14b8a6" badgeLabel="123" />,
  },

  // ── Convert PDF ───────────────────────────────────────────────
  {
    name: "PDF to JPG", route: "/tools/pdf-to-jpg", category: "Convert PDF",
    desc: "Convert PDF pages to JPG images",
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#f59e0b" badgeLabel2="JPG" />,
  },
  {
    name: "JPG to PDF", route: "/tools/jpg-to-pdf", category: "Convert PDF",
    desc: "Convert images into a PDF file",
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#f59e0b" badgeLabel="JPG" badgeColor2="#ef4444" badgeLabel2="PDF" />,
  },
  {
    name: "PDF to Word", route: "/tools/pdf-to-word", category: "Convert PDF",
    desc: "Export PDF text as an editable Word doc",
    badge: "NEW" as const,
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#2563eb" badgeLabel2="DOC" />,
  },
  {
    name: "Compress PDF", route: "/tools/compress", category: "Convert PDF",
    desc: "Reduce PDF file size",
    icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#22c55e" badgeLabel="PDF" />,
  },
  {
    name: "PDF to PNG", route: "/tools/pdf-to-png", category: "Convert PDF",
    desc: "Export PDF pages as PNG images",
    icon: <ToolIcon variant="double" bgColor="#f0fdfa" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#14b8a6" badgeLabel2="PNG" />,
  },

  // ── Edit & Security ───────────────────────────────────────────
  {
    name: "Watermark PDF", route: "/tools/watermark", category: "Edit & Security",
    desc: "Add text watermarks to your PDF",
    icon: <ToolIcon variant="single" bgColor="#fff0f9" badgeColor="#ec4899" badgeLabel="PDF" />,
  },
  {
    name: "Sign PDF", route: "/tools/sign", category: "Edit & Security",
    desc: "Draw or upload your signature",
    icon: <ToolIcon variant="single" bgColor="#fdf4ff" badgeColor="#a855f7" badgeLabel="PDF" />,
  },
  {
    name: "Repair PDF", route: "/tools/repair", category: "Edit & Security",
    desc: "Fix corrupted or damaged PDFs",
    icon: <ToolIcon variant="single" bgColor="#f5f3ff" badgeColor="#8b5cf6" badgeLabel="PDF" />,
  },
  {
    name: "Protect PDF", route: "/tools/protect", category: "Edit & Security",
    desc: "Password-protect PDFs with AES-256 encryption.",
    icon: <ToolIcon variant="single" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" />,
  },
  {
    name: "Unlock PDF", route: "/tools/unlock", category: "Edit & Security",
    desc: "Remove PDF password protection",
    icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#16a34a" badgeLabel="PDF" />,
  },
  {
    name: "Batch Processing", route: "/tools/batch", category: "Edit & Security",
    desc: "Apply operations to multiple PDFs at once",
    badge: "NEW" as const,
    icon: <ToolIcon variant="double" bgColor="#fefce8" badgeColor="#eab308" badgeLabel="PDF" badgeColor2="#eab308" badgeLabel2="PDF" />,
  },
];

const CATEGORIES = ["All", "Organize PDF", "Convert PDF", "Edit & Security"];

export default function ToolsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const filtered = activeCategory === "All" ? TOOLS : TOOLS.filter(t => t.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">PDF Tools</h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            All tools run in your browser. No uploads. No servers.
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
            <ToolCard
              key={tool.route}
              name={tool.name}
              description={tool.desc}
              route={tool.route}
              icon={tool.icon}
              badge={tool.badge}
            />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

const TOOLS = [
  { name: "Unlock PDF", href: "/", icon: "🔓", desc: "Remove password protection" },
  { name: "Merge PDF", href: "/tools/merge", icon: "🔗", desc: "Combine PDFs into one" },
  { name: "Split PDF", href: "/tools/split", icon: "✂️", desc: "Split into multiple files" },
  { name: "Compress PDF", href: "/tools/compress", icon: "📦", desc: "Reduce file size" },
  { name: "Rotate PDF", href: "/tools/rotate", icon: "🔄", desc: "Rotate pages" },
  { name: "PDF to JPG", href: "/tools/pdf-to-jpg", icon: "🖼️", desc: "Convert pages to images" },
  { name: "JPG to PDF", href: "/tools/jpg-to-pdf", icon: "📄", desc: "Convert images to PDF" },
  { name: "Watermark PDF", href: "/tools/watermark", icon: "💧", desc: "Add text watermark" },
  { name: "Organize PDF", href: "/tools/organize", icon: "🗂️", desc: "Reorder pages" },
  { name: "Page Numbers", href: "/tools/page-numbers", icon: "🔢", desc: "Add page numbers" },
  { name: "Sign PDF", href: "/tools/sign", icon: "✍️", desc: "Add signature" },
  { name: "Delete Pages", href: "/tools/delete-pages", icon: "🗑️", desc: "Remove specific pages" },
  { name: "PDF to PNG", href: "/tools/pdf-to-png", icon: "🎨", desc: "High quality PNG conversion" },
  { name: "Repair PDF", href: "/tools/repair", icon: "🔧", desc: "Fix corrupted PDFs" },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-gray-900 mb-3">PDF Tools</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            All tools run in your browser. No uploads. No servers.
          </p>
          <p className="text-sm text-gray-400 mt-2">🔒 Your files never leave your device</p>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group bg-white border border-gray-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3 hover:border-purple-400 hover:shadow-md transition-all duration-200"
            >
              <span className="text-4xl">{tool.icon}</span>
              <div>
                <p className="font-bold text-gray-800 text-sm group-hover:text-purple-700 transition-colors">
                  {tool.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{tool.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-400">
            Need help? Email{" "}
            <a href="mailto:support@rizzpdf.com" className="text-purple-600 hover:underline">
              support@rizzpdf.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

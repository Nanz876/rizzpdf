"use client";

import Link from "next/link";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface ToolShellProps {
  name: string;
  description: string;
  icon: string;
  children: React.ReactNode;
}

export default function ToolShell({ name, description, icon, children }: ToolShellProps) {
  return (
    <div className="min-h-screen bg-[#F9F7FF] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        {/* Breadcrumb — flex-1 on main ensures footer is pushed to bottom */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Link href="/" className="hover:text-purple-600 transition-colors">Home</Link>
          <span>›</span>
          <Link href="/tools" className="hover:text-purple-600 transition-colors">PDF Tools</Link>
          <span>›</span>
          <span className="text-gray-600 font-medium">{name}</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">{icon}</div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">{name}</h1>
          <p className="text-gray-500 text-lg">{description}</p>
          <p className="text-xs text-gray-400 mt-2">🔒 Files never leave your browser</p>
        </div>

        {/* Tool content */}
        {children}

        {/* Footer: Other tools */}
        <div className="mt-16 border-t border-gray-200 pt-10">
          <p className="text-center text-sm text-gray-400 mb-5">More PDF tools</p>
          <div className="flex flex-wrap justify-center gap-3">
            {OTHER_TOOLS.filter(t => t.name !== name).slice(0, 6).map(t => (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-full px-4 py-2 hover:border-purple-400 hover:text-purple-600 transition-colors"
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </Link>
            ))}
            <Link
              href="/tools"
              className="text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-4 py-2 hover:bg-purple-100 transition-colors font-medium"
            >
              All tools →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

const OTHER_TOOLS = [
  { name: "Unlock PDF", href: "/", icon: "🔓" },
  { name: "Merge PDF", href: "/tools/merge", icon: "🔗" },
  { name: "Split PDF", href: "/tools/split", icon: "✂️" },
  { name: "Compress PDF", href: "/tools/compress", icon: "📦" },
  { name: "Rotate PDF", href: "/tools/rotate", icon: "🔄" },
  { name: "PDF to JPG", href: "/tools/pdf-to-jpg", icon: "🖼️" },
  { name: "JPG to PDF", href: "/tools/jpg-to-pdf", icon: "📄" },
  { name: "Watermark PDF", href: "/tools/watermark", icon: "💧" },
  { name: "Organize PDF", href: "/tools/organize", icon: "🗂️" },
  { name: "Page Numbers", href: "/tools/page-numbers", icon: "🔢" },
  { name: "Sign PDF", href: "/tools/sign", icon: "✍️" },
  { name: "Delete Pages", href: "/tools/delete-pages", icon: "🗑️" },
  { name: "PDF to PNG", href: "/tools/pdf-to-png", icon: "🎨" },
  { name: "Repair PDF", href: "/tools/repair", icon: "🔧" },
];

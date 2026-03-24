import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import React from "react";

const MORE_TOOLS = [
  { name: "Merge PDF", href: "/tools/merge" },
  { name: "Split PDF", href: "/tools/split" },
  { name: "Compress PDF", href: "/tools/compress" },
  { name: "Rotate PDF", href: "/tools/rotate" },
  { name: "Sign PDF", href: "/tools/sign" },
  { name: "Watermark PDF", href: "/tools/watermark" },
  { name: "Organize PDF", href: "/tools/organize" },
  { name: "Page Numbers", href: "/tools/page-numbers" },
  { name: "Delete Pages", href: "/tools/delete-pages" },
  { name: "PDF to JPG", href: "/tools/pdf-to-jpg" },
  { name: "JPG to PDF", href: "/tools/jpg-to-pdf" },
  { name: "Repair PDF", href: "/tools/repair" },
  { name: "Protect PDF", href: "/tools/protect" },
  { name: "PDF to Word", href: "/tools/pdf-to-word" },
  { name: "Batch Processing", href: "/tools/batch" },
];

interface ToolShellProps {
  name: string;
  description: string;
  icon: string;
  svgIcon?: React.ReactNode;
  steps?: [string, string, string];
  children: React.ReactNode;
}

export default function ToolShell({ name, description, icon, svgIcon, steps, children }: ToolShellProps) {
  const defaultIcon = (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
      <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.8"/>
      <path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Breadcrumb */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-red-600 transition-colors">Home</Link>
          <span>›</span>
          <Link href="/tools" className="hover:text-red-600 transition-colors">PDF Tools</Link>
          <span>›</span>
          <span className="text-gray-600 font-medium">{name}</span>
        </div>
      </div>

      {/* Tool banner */}
      <div className="bg-gradient-to-r from-red-50 to-white border-b border-red-100">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              {svgIcon ?? defaultIcon}
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">{name}</h1>
              <p className="text-sm text-gray-500 mt-1 max-w-md">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 self-start flex-shrink-0">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="#16a34a" strokeWidth="2"/>
              <path d="M8 11V7a4 4 0 018 0v4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-semibold text-green-700">Files stay in your browser</span>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5">
          {/* Step indicators */}
          {steps && (
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
              {steps.map((label, i) => (
                <div key={i} className={`flex-1 flex items-center gap-2.5 px-4 py-3 ${i < steps.length - 1 ? "border-r border-gray-200" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-xs font-black text-red-600 flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs text-gray-500 leading-snug">{label}</span>
                </div>
              ))}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* More tools */}
      <div className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">More PDF tools</p>
          <div className="flex flex-wrap gap-2">
            {MORE_TOOLS.filter(t => t.name !== name).map(t => (
              <Link key={t.href} href={t.href}
                className="px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:border-red-400 hover:text-red-600 transition-colors">
                {t.name}
              </Link>
            ))}
            <Link href="/tools" className="px-4 py-2 text-sm text-red-600 font-semibold hover:underline">
              All tools →
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

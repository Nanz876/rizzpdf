// app/page.tsx
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import ToolIcon from "@/components/ToolIcon";

const ORGANIZE_TOOLS = [
  {
    name: "Merge PDF", route: "/tools/merge", desc: "Combine multiple PDFs into one file.",
    icon: <ToolIcon variant="double" bgColor="#fff3f3" badgeColor="#ef4444" badgeLabel="PDF" />,
  },
  {
    name: "Split PDF", route: "/tools/split", desc: "Extract pages or ranges from a PDF.",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" />,
  },
  {
    name: "Organize PDF", route: "/tools/organize", desc: "Drag pages to reorder them.",
    icon: <ToolIcon variant="single" bgColor="#fefce8" badgeColor="#eab308" badgeLabel="PDF" />,
  },
  {
    name: "Delete Pages", route: "/tools/delete-pages", desc: "Remove unwanted pages from a PDF.",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" />,
  },
  {
    name: "Rotate PDF", route: "/tools/rotate", desc: "Rotate individual or all pages.",
    icon: <ToolIcon variant="single" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" />,
  },
  {
    name: "Page Numbers", route: "/tools/page-numbers", desc: "Stamp page numbers onto your PDF.",
    icon: <ToolIcon variant="single" bgColor="#f0fdfa" badgeColor="#14b8a6" badgeLabel="PDF" />,
  },
];

const CONVERT_TOOLS = [
  {
    name: "PDF to JPG", route: "/tools/pdf-to-jpg", desc: "Export every page as a JPG image.",
    icon: <ToolIcon variant="double" bgColor="#f0f9ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#3b82f6" badgeLabel2="JPG" />,
  },
  {
    name: "JPG to PDF", route: "/tools/jpg-to-pdf", desc: "Turn images into a PDF file.",
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#3b82f6" badgeLabel="JPG" badgeColor2="#ef4444" badgeLabel2="PDF" />,
  },
  {
    name: "PDF to Word", route: "/tools/pdf-to-word", desc: "Export as an editable .docx file.",
    badge: "NEW" as const,
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#2563eb" badgeLabel2="DOC" />,
  },
  {
    name: "Compress PDF", route: "/tools/compress", desc: "Shrink PDFs by recompressing images. Text stays selectable.",
    icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#22c55e" badgeLabel="ZIP" />,
  },
  {
    name: "PDF to PNG", route: "/tools/pdf-to-png", desc: "Export pages as PNG images.",
    icon: <ToolIcon variant="double" bgColor="#f0fdfa" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#14b8a6" badgeLabel2="PNG" />,
  },
];

const SECURITY_TOOLS = [
  {
    name: "Protect PDF", route: "/tools/protect", desc: "Password protection — coming soon.",
    icon: <ToolIcon variant="single" bgColor="#fdf4ff" badgeColor="#a855f7" badgeLabel="PDF" />,
  },
  {
    name: "Unlock PDF", route: "/tools/unlock", desc: "Remove PDF password instantly.",
    icon: <ToolIcon variant="single" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" />,
  },
  {
    name: "Watermark PDF", route: "/tools/watermark", desc: "Add a text watermark to any PDF.",
    icon: <ToolIcon variant="single" bgColor="#fff0f9" badgeColor="#ec4899" badgeLabel="PDF" />,
  },
  {
    name: "Sign PDF", route: "/tools/sign", desc: "Draw or upload your signature.",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" />,
  },
  {
    name: "Repair PDF", route: "/tools/repair", desc: "Fix corrupted or damaged PDFs.",
    icon: <ToolIcon variant="single" bgColor="#f5f3ff" badgeColor="#8b5cf6" badgeLabel="PDF" />,
  },
  {
    name: "Batch Processing", route: "/tools/batch", desc: "Apply one tool to many PDFs at once.",
    icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#22c55e" badgeLabel="PDF"
      innerContent={<svg width="18" height="16" fill="none" viewBox="0 0 20 18"><rect x="1" y="5" width="18" height="4" rx="2" fill="rgba(34,197,94,0.25)" stroke="#22c55e" strokeWidth="1.3"/><rect x="1" y="11" width="18" height="4" rx="2" fill="rgba(34,197,94,0.4)" stroke="#22c55e" strokeWidth="1.3"/><rect x="1" y="1" width="18" height="3" rx="1.5" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1.3"/></svg>}
    />,
  },
];

type ToolEntry = {
  name: string;
  route: string;
  desc: string;
  icon: React.ReactNode;
  badge?: "NEW" | "HOT" | "PRO";
};

function CategorySection({ title, tools }: { title: string; tools: ToolEntry[] }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide whitespace-nowrap">{title}</h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tools.map((t) => (
          <ToolCard key={t.route} name={t.name} description={t.desc} route={t.route} icon={t.icon} badge={t.badge} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyState, setNotifyState] = useState<"idle" | "loading" | "done" | "error">("idle");
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white border-b border-gray-100 py-10 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-3">
              Every PDF tool you need
            </h1>
            <p className="text-gray-500 text-base">
              100% private · runs in your browser · free for 3 files
            </p>
          </div>
        </section>

        {/* Tool categories */}
        <section className="max-w-7xl mx-auto px-4 py-10">
          <CategorySection title="Organize PDF" tools={ORGANIZE_TOOLS} />
          <CategorySection title="Convert PDF" tools={CONVERT_TOOLS} />
          <CategorySection title="Edit & Security" tools={SECURITY_TOOLS} />
        </section>

        {/* Pricing teaser */}
        <section className="bg-gray-50 border-t border-gray-100 py-12 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <h2 className="text-xl font-black text-gray-900 mb-2">Simple, honest pricing</h2>
            <p className="text-gray-500 text-sm mb-6">Start free. Pay only when you need more. No hidden fees.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm text-center min-w-[140px]">
                <div className="font-black text-xl text-gray-900">$0</div>
                <div className="text-gray-500 text-xs mt-0.5">Free forever</div>
              </div>
              <div className="text-gray-300 font-bold hidden sm:block">·</div>
              <div className="bg-white border border-amber-300 rounded-xl px-5 py-3 text-sm text-center min-w-[140px]">
                <div className="font-black text-xl text-gray-900">$1</div>
                <div className="text-gray-500 text-xs mt-0.5">Day pass · 24 hrs</div>
              </div>
              <div className="text-gray-300 font-bold hidden sm:block">·</div>
              <div className="bg-white border-2 border-red-500 rounded-xl px-5 py-3 text-sm text-center min-w-[140px]">
                <div className="font-black text-xl text-gray-900">$5<span className="text-xs text-gray-400 font-normal">/mo</span></div>
                <div className="text-red-600 text-xs font-semibold mt-0.5">Pro · unlimited</div>
              </div>
            </div>
            <a href="/pricing" className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:underline">
              See full pricing →
            </a>
          </div>
        </section>

        {/* Mobile app placeholder */}
        <section className="bg-white border-t border-gray-100 py-12 text-center">
          <div className="max-w-xl mx-auto px-4">
            <h2 className="text-xl font-black text-gray-900 mb-2">RizzPDF app — coming soon</h2>
            <p className="text-gray-500 text-sm mb-6">Take PDF tools anywhere. iOS and Android.</p>
            <div className="flex items-center justify-center gap-4 mb-6 opacity-40">
              <div className="bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-not-allowed select-none">
                App Store
              </div>
              <div className="bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-not-allowed select-none">
                Google Play
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
              {notifyState === "done" ? (
                <p className="text-sm text-green-600 font-semibold">✓ You&apos;re on the list!</p>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <button
                    disabled={notifyState === "loading"}
                    onClick={async () => {
                      if (!notifyEmail.includes("@")) return;
                      setNotifyState("loading");
                      const res = await fetch("/api/notify-signup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: notifyEmail }),
                      });
                      setNotifyState(res.ok ? "done" : "error");
                    }}
                    className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {notifyState === "loading" ? "…" : "Notify me"}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

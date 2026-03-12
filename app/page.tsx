"use client";

import { useState, useCallback, useEffect } from "react";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import FileCard, { FileEntry } from "@/components/FileCard";
import PaywallModal from "@/components/PaywallModal";

const FREE_LIMIT = 3;

export default function Home() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);

  // Check if user has an active paid bulk session
  useEffect(() => {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) {
      setIsPro(true);
    }
  }, []);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const currentCount = files.length;
      const allowed = isPro ? Infinity : FREE_LIMIT;

      if (currentCount >= allowed) {
        setShowPaywall(true);
        return;
      }

      const toAdd = newFiles.slice(0, allowed - currentCount);
      const overflow = newFiles.length - toAdd.length;

      const entries: FileEntry[] = toAdd.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "idle",
      }));

      setFiles((prev) => [...prev, ...entries]);

      if (overflow > 0) {
        setTimeout(() => setShowPaywall(true), 300);
      }
    },
    [files.length, isPro]
  );

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleStatusChange = useCallback(
    (id: string, status: FileEntry["status"], error?: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status, error } : f))
      );
    },
    []
  );

  const handlePay = () => {
    // PaywallModal handles Stripe redirect directly
    setShowPaywall(false);
  };

  const hasFiles = files.length > 0;

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
          {
            "@type": "Offer",
            "name": "Free",
            "price": "0",
            "priceCurrency": "USD",
            "description": "Up to 3 PDF files, 10MB per file"
          },
          {
            "@type": "Offer",
            "name": "One-time Drop",
            "price": "1",
            "priceCurrency": "USD",
            "description": "Unlimited files for 24 hours, 50MB per file"
          },
          {
            "@type": "Offer",
            "name": "Pro",
            "price": "7",
            "priceCurrency": "USD",
            "description": "Unlimited files always, 100MB per file, full unlock history, CSV bulk unlock"
          }
        ],
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Is RizzPDF free to use?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes! RizzPDF is free for up to 3 PDF files per session. No account required. For unlimited files, you can get a one-time $1 bulk session or upgrade to Pro for $7/month."
            }
          },
          {
            "@type": "Question",
            "name": "Is it safe to unlock my PDFs with RizzPDF?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "100% safe. All PDF processing happens entirely inside your browser — your files are never uploaded to any server. We never see your files or passwords."
            }
          },
          {
            "@type": "Question",
            "name": "How do I remove a password from a PDF?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Simply drag and drop your password-protected PDF onto RizzPDF, enter the password you already know, and click Unlock. The unlocked PDF downloads instantly."
            }
          },
          {
            "@type": "Question",
            "name": "Can RizzPDF crack or guess PDF passwords?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. RizzPDF removes password protection from PDFs when you already know the correct password. It does not brute-force or crack unknown passwords."
            }
          },
          {
            "@type": "Question",
            "name": "What is the maximum file size for PDF unlocking?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Free users can unlock PDFs up to 10MB. Drop ($1) users get up to 50MB. Pro ($7/month) users get up to 100MB per file."
            }
          }
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-4 pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            100% private — files processed in your browser
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-gray-900 leading-tight mb-4">
            Unlock PDFs with{" "}
            <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              Rizz
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
            Remove PDF password protection instantly. Free for up to 3 files.
            No account. No subscription. No cap.
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400 mb-12">
            {[
              { label: "Files unlocked", value: "2.4k+" },
              { label: "Always free", value: "3 files" },
              { label: "Bulk unlock", value: "$1 only" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="font-black text-gray-800 text-xl">{value}</div>
                <div className="text-xs">{label}</div>
              </div>
            ))}
          </div>

          {/* Upload zone */}
          <UploadZone onFilesAdded={handleFilesAdded} />

          {/* Free tier indicator */}
          {!isPro && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-8 h-1.5 rounded-full transition-colors ${
                      i < files.length ? "bg-purple-500" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">
                {files.length}/3 free files used
                {files.length >= FREE_LIMIT && (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="ml-2 text-purple-600 font-semibold hover:underline"
                  >
                    Go bulk for $1 →
                  </button>
                )}
              </span>
            </div>
          )}

          {isPro && (
            <p className="mt-4 text-xs text-green-600 font-semibold">
              ✓ Bulk mode active — unlimited files for 24 hours
            </p>
          )}
        </section>

        {/* File list */}
        {hasFiles && (
          <section className="max-w-3xl mx-auto px-4 pb-16">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Your files ({files.length})
              </h2>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-3">
              {files.map((entry) => (
                <FileCard
                  key={entry.id}
                  entry={entry}
                  onRemove={handleRemove}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section id="how-it-works" className="bg-gray-50 py-20">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-black text-gray-900 mb-12">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  emoji: "📁",
                  title: "Drop your PDF",
                  desc: "Drag and drop or click to select your password-protected PDF files.",
                },
                {
                  step: "02",
                  emoji: "🔑",
                  title: "Enter the password",
                  desc: "Type in the password you already know. We never guess or brute-force.",
                },
                {
                  step: "03",
                  emoji: "⬇️",
                  title: "Download unlocked",
                  desc: "Get your PDF back without the password restriction. Instantly.",
                },
              ].map(({ step, emoji, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-2xl">
                    {emoji}
                  </div>
                  <p className="text-xs font-bold text-purple-500 mb-1">{step}</p>
                  <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-black text-gray-900 mb-4">Pricing that slaps</h2>
            <p className="text-gray-500 mb-12">Simple pricing. No surprises.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Free */}
              <div className="border border-gray-200 rounded-3xl p-8 text-left">
                <p className="text-sm font-semibold text-gray-500 mb-1">Free forever</p>
                <p className="text-4xl font-black text-gray-900 mb-4">$0</p>
                <ul className="space-y-2 text-sm text-gray-700 mb-6">
                  {["Up to 3 files", "Max 10MB per file", "No account needed", "Instant download"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-purple-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-full border border-gray-200 rounded-2xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Start free
                </button>
              </div>

              {/* Drop */}
              <div className="border border-gray-200 rounded-3xl p-8 text-left">
                <p className="text-sm font-semibold text-purple-600 mb-1">One-time drop</p>
                <p className="text-4xl font-black text-gray-900 mb-4">$1</p>
                <ul className="space-y-2 text-sm text-gray-700 mb-6">
                  {["Unlimited files", "Up to 50MB per file", "Valid for 24 hours", "No subscription ever", "No account required"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-purple-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowPaywall(true)}
                  className="w-full border border-gray-200 rounded-2xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Unlock bulk →
                </button>
              </div>

              {/* Pro */}
              <div className="border-2 border-purple-500 rounded-3xl p-8 text-left relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  PRO
                </div>
                <p className="text-sm font-semibold text-purple-600 mb-1">Pro plan</p>
                <p className="text-4xl font-black text-gray-900 mb-1">$7<span className="text-lg font-semibold text-gray-500">/mo</span></p>
                <p className="text-xs text-gray-400 mb-4">Cancel anytime</p>
                <ul className="space-y-2 text-sm text-gray-700 mb-6">
                  {["Unlimited files always", "Up to 100MB per file", "Full unlock history", "CSV bulk unlock + ZIP", "Priority support"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-purple-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/sign-up"
                  className="block w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-2xl py-2.5 text-sm font-bold hover:opacity-90 transition-opacity text-center"
                >
                  Get Pro →
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <p className="font-bold text-gray-800">
            Rizz<span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">PDF</span>
          </p>
          <p>© {new Date().getFullYear()} RizzPDF. Made with 💜</p>
          <div className="flex gap-4">
            <a href="/blog" className="hover:text-gray-600 transition-colors">Blog</a>
            <a href="mailto:support@rizzpdf.com" className="hover:text-gray-600 transition-colors">Support</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {/* Paywall modal */}
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onPay={handlePay}
        />
      )}
    </div>
  );
}

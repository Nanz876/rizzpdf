import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Split a PDF Online Free — Extract Pages Instantly",
  description:
    "Split a PDF into separate pages or extract a range — free, no account, no upload. Everything runs in your browser.",
  keywords: [
    "split PDF online free",
    "extract pages from PDF",
    "split PDF",
    "separate PDF pages",
    "PDF splitter",
  ],
  alternates: { canonical: "https://rizzpdf.com/blog/split-pdf-online-free" },
  openGraph: {
    title: "How to Split a PDF Online Free",
    description: "Extract pages or split into separate files — free, no upload, files stay on your device.",
    url: "https://rizzpdf.com/blog/split-pdf-online-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "How to Split a PDF Online Free — Extract Pages Instantly",
  description: "Split a PDF into separate pages or extract a page range, entirely in your browser.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://rizzpdf.com" },
  datePublished: "2025-03-24",
  url: "https://rizzpdf.com/blog/split-pdf-online-free",
};

export default function SplitPDFBlog() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100 px-6 py-4">
          <Link href="/" className="text-xl font-black">
            <span className="text-gray-900">Rizz</span><span className="text-red-600">PDF</span>
          </Link>
        </nav>

        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Guide</div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 leading-tight">
            How to Split a PDF Online Free — Extract Pages Instantly
          </h1>
          <p className="text-gray-500 text-sm mb-8">March 24, 2025 · 4 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Got a 50-page PDF but only need pages 3–7? Or want to split every page into its own file? Splitting PDFs is one of the most common document tasks — and it takes seconds with the right tool.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to split a PDF in 3 steps</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Open <Link href="/tools/split" className="text-red-600 font-semibold hover:underline">RizzPDF Split PDF</Link></li>
              <li>Upload your PDF and choose a split mode:
                <ul className="list-disc list-inside ml-5 mt-2 space-y-1 text-sm text-gray-600">
                  <li><strong>By range</strong> — enter page numbers like "1-3, 5, 8-10"</li>
                  <li><strong>Every page</strong> — split into individual single-page PDFs</li>
                </ul>
              </li>
              <li>Click <strong>Split</strong> — each part downloads as a separate PDF</li>
            </ol>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Common reasons to split a PDF</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Extract a single page</strong> — pull one page from a large report</li>
              <li><strong>Separate chapters</strong> — break a book or manual into sections</li>
              <li><strong>Remove confidential pages</strong> — share only the relevant sections</li>
              <li><strong>Reduce file size</strong> — send only the pages someone actually needs</li>
              <li><strong>Re-merge in different order</strong> — split then merge with different ordering</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What&apos;s the page range syntax?</h2>
            <p>Enter page numbers separated by commas. Use a dash for ranges:</p>
            <div className="bg-gray-100 rounded-xl p-4 font-mono text-sm space-y-1">
              <p><span className="text-gray-500">// Single pages</span></p>
              <p>1, 3, 7</p>
              <p><span className="text-gray-500">// Page ranges</span></p>
              <p>1-5, 10-15</p>
              <p><span className="text-gray-500">// Mixed</span></p>
              <p>1, 3-6, 9, 12-20</p>
            </div>
            <p>Each comma-separated segment becomes a separate output PDF.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Are my files safe?</h2>
            <p>
              Yes — splitting happens entirely in your browser. Your PDF is never sent to any server. This is important for confidential documents like legal filings, medical records, or financial reports.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Split PDF vs. Organize PDF — what&apos;s the difference?</h2>
            <p>
              <strong>Split PDF</strong> divides a document into separate files. <strong>Organize PDF</strong> lets you reorder, rotate, or delete individual pages within a single document. For most extraction tasks, Split is what you want.
            </p>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">✂️</div>
            <h3 className="font-black text-gray-900 mb-1">Split your PDF free</h3>
            <p className="text-sm text-gray-500 mb-4">Extract any pages. Files never leave your browser.</p>
            <Link
              href="/tools/split"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Split PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Merge PDF", href: "/tools/merge" },
                { label: "Organize PDF", href: "/tools/organize" },
                { label: "Compress PDF", href: "/tools/compress" },
                { label: "All tools", href: "/tools" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="text-sm bg-white border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg text-gray-700 hover:text-red-600 transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Crop a PDF Online Free — Trim Margins and Scan Edges",
  description:
    "Cut the white margins off a PDF, straighten a badly scanned edge, or crop every page at once. Free, in your browser, nothing uploaded.",
  keywords: [
    "crop PDF online free",
    "trim PDF margins",
    "remove white space from PDF",
    "crop scanned PDF",
    "resize PDF page",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/blog/crop-pdf-online-free" },
  openGraph: {
    title: "How to Crop a PDF Online Free",
    description: "Trim margins and scan edges from a PDF in your browser — free, no upload, no account.",
    url: "https://www.rizzpdf.com/blog/crop-pdf-online-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "How to Crop a PDF Online Free — Trim Margins and Scan Edges",
  description: "Why cropping a PDF hides content rather than deleting it, and how to crop pages properly for reading and printing.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://www.rizzpdf.com" },
  datePublished: "2026-09-20",
  url: "https://www.rizzpdf.com/blog/crop-pdf-online-free",
};

export default function CropPdfBlog() {
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
            How to Crop a PDF — Trim Margins and Scan Edges
          </h1>
          <p className="text-gray-500 text-sm mb-8">September 20, 2026 · 4 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Cropping is the fix for three everyday annoyances: enormous white margins that waste half the screen on a tablet, the black edge and shadow a scanner leaves down one side, and a slide deck exported with space around every slide.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to crop a PDF</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Open <Link href="/tools/crop" className="text-red-600 font-semibold hover:underline">RizzPDF Crop PDF</Link></li>
              <li>Upload your file and drag the crop box on the page preview</li>
              <li>Apply it to every page, or just the pages you pick</li>
              <li>Download the cropped PDF</li>
            </ol>
            <p>
              If the margins are simply white space, let the tool detect them: it finds the edges of the actual content and trims to them, which is faster and more consistent than eyeballing a box.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Cropping hides; it doesn&apos;t delete</h2>
            <p>
              This surprises people. A normal PDF crop changes the page&apos;s declared boundaries — the content outside them is still in the file, just not displayed. Another program can often reveal it by resetting the crop.
            </p>
            <p>
              That&apos;s fine for reading and printing. It is <strong>not</strong> a way to hide something sensitive at the edge of a page. For that you want <Link href="/tools/redact" className="text-red-600 font-semibold hover:underline">redaction</Link>, which removes the content, or a permanent crop that rewrites the pages so the trimmed area is genuinely gone.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">When to crop, and when to do something else</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Problem</th>
                    <th className="text-left px-4 py-2 font-semibold">What to do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-4 py-2 font-medium">Huge margins on an e-reader</td><td className="px-4 py-2">Crop to the content</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">Black scanner edge or shadow</td><td className="px-4 py-2">Crop that edge away</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Page is sideways</td><td className="px-4 py-2"><Link href="/tools/rotate" className="text-red-600 font-semibold hover:underline">Rotate</Link>, not crop</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">File is too big to email</td><td className="px-4 py-2"><Link href="/tools/compress" className="text-red-600 font-semibold hover:underline">Compress</Link> — cropping alone saves little</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Whole pages you don&apos;t want</td><td className="px-4 py-2"><Link href="/tools/delete-pages" className="text-red-600 font-semibold hover:underline">Delete pages</Link></td></tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Does cropping shrink the file?</h2>
            <p>
              Barely. The content is still there, so the size hardly moves. If your goal is a smaller file, compress it; if the document is a scan, compressing the images is where the megabytes actually are.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Tips</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Leave a few millimetres of margin — text cropped flush to the page edge looks cramped and can be clipped by printers</li>
              <li>Check a page from the middle of the document as well as the first one; scans drift</li>
              <li>Cropping a mixed document (portrait and landscape pages) page by page beats one box for all</li>
              <li>Keep the original if the document is a record you may need to produce intact</li>
            </ul>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">✂️</div>
            <h3 className="font-black text-gray-900 mb-1">Crop a PDF free</h3>
            <p className="text-sm text-gray-500 mb-4">Unlimited, no account, nothing uploaded.</p>
            <Link
              href="/tools/crop"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Crop PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Rotate PDF", href: "/tools/rotate" },
                { label: "Compress PDF", href: "/tools/compress" },
                { label: "Delete Pages", href: "/tools/delete-pages" },
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

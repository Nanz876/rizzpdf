import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Compress a PDF to Reduce File Size — Free Online Tool",
  description:
    "Shrink PDF file size for email and sharing. Works best on scanned and image-heavy PDFs. Runs in your browser, files never uploaded.",
  keywords: [
    "compress PDF without losing quality",
    "reduce PDF file size",
    "compress PDF online free",
    "shrink PDF",
    "PDF compressor",
  ],
  alternates: { canonical: "https://rizzpdf.com/blog/compress-pdf-without-losing-quality" },
  openGraph: {
    title: "How to Compress a PDF Without Losing Quality",
    description: "Reduce PDF size without blurring text or images — free, no upload, no account.",
    url: "https://rizzpdf.com/blog/compress-pdf-without-losing-quality",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "How to Compress a PDF Without Losing Quality — Free Online Tool",
  description: "Reduce PDF file size without making it blurry or unreadable.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://rizzpdf.com" },
  datePublished: "2025-03-24",
  url: "https://rizzpdf.com/blog/compress-pdf-without-losing-quality",
};

export default function CompressPDFBlog() {
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
            How to Compress a PDF to Reduce File Size
          </h1>
          <p className="text-gray-500 text-sm mb-8">March 24, 2025 · 5 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Large PDFs are a pain — they fail to email, take forever to upload, and clog up storage. But nobody wants a blurry, unreadable compressed file either. Here&apos;s how to shrink a PDF while keeping it sharp.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What actually makes PDFs large?</h2>
            <p>PDFs get big for a few reasons:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Embedded images</strong> — scanned pages or high-res photos are the biggest culprit</li>
              <li><strong>Embedded fonts</strong> — full font files baked into the PDF</li>
              <li><strong>Metadata and thumbnails</strong> — version history, comments, and preview images</li>
              <li><strong>Uncompressed objects</strong> — PDFs created from certain apps with no optimization</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to compress without ruining quality</h2>
            <p>The key is choosing the right compression level for your use case:</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Level</th>
                    <th className="text-left px-4 py-2 font-semibold">Best for</th>
                    <th className="text-center px-4 py-2 font-semibold">Size reduction</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-4 py-2 font-medium">Screen</td><td className="px-4 py-2">Email, web viewing</td><td className="text-center px-4 py-2">Up to 80%</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">eBook</td><td className="px-4 py-2">Digital distribution</td><td className="text-center px-4 py-2">40–60%</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Printer</td><td className="px-4 py-2">High-quality printing</td><td className="text-center px-4 py-2">10–30%</td></tr>
                </tbody>
              </table>
            </div>

            <p>
              For most use cases — sending a scanned document via email, uploading to a portal — <strong>Screen</strong> quality is fine. Note: RizzPDF&apos;s compression re-renders each page as a JPEG image, so text in the output will be visually readable but not selectable or searchable. If you need to keep text selectable, remove unnecessary pages instead to reduce size while preserving structure.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Step-by-step: compress a PDF free</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Open <Link href="/tools/compress" className="text-red-600 font-semibold hover:underline">RizzPDF Compress PDF</Link></li>
              <li>Drop your PDF onto the page</li>
              <li>Choose a compression level (Screen, eBook, or Printer)</li>
              <li>Click <strong>Compress</strong> and download</li>
            </ol>
            <p>Your file never leaves your browser — it&apos;s processed entirely on your device.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Why is my PDF still large after compressing?</h2>
            <p>
              Because the tool re-renders every page as a JPEG, text-native PDFs will still compress — but the gains may be modest while the output loses text selectability. This tool is most effective on scanned documents and image-heavy PDFs. For text-only PDFs where file size is the issue, removing unnecessary pages is usually a better approach.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Email size limits by provider</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Gmail: 25MB attachment limit</li>
              <li>Outlook: 20MB attachment limit</li>
              <li>Yahoo Mail: 25MB attachment limit</li>
            </ul>
            <p>
              If your PDF exceeds these limits, compressing to Screen quality usually brings it well under 10MB.
            </p>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">🗜️</div>
            <h3 className="font-black text-gray-900 mb-1">Compress your PDF free</h3>
            <p className="text-sm text-gray-500 mb-4">Three quality levels. Files never leave your device.</p>
            <Link
              href="/tools/compress"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Compress PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Merge PDF", href: "/tools/merge" },
                { label: "Split PDF", href: "/tools/split" },
                { label: "PDF to JPG", href: "/tools/pdf-to-jpg" },
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

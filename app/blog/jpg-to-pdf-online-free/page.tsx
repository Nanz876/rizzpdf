import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JPG to PDF Online Free — Convert Images to PDF in Seconds",
  description:
    "Convert one or more JPG images into a single PDF file. Free, no account required, files never uploaded to any server.",
  keywords: [
    "JPG to PDF online free",
    "convert image to PDF",
    "JPG to PDF",
    "photo to PDF",
    "image to PDF converter",
  ],
  alternates: { canonical: "https://rizzpdf.com/blog/jpg-to-pdf-online-free" },
  openGraph: {
    title: "JPG to PDF Online Free — Convert Images to PDF Instantly",
    description: "Turn photos or scans into a PDF — free, no upload, no account needed.",
    url: "https://rizzpdf.com/blog/jpg-to-pdf-online-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "JPG to PDF Online Free — Convert Images to PDF in Seconds",
  description: "Convert JPG images to PDF entirely in your browser — no upload, no account.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://rizzpdf.com" },
  datePublished: "2025-03-24",
  url: "https://rizzpdf.com/blog/jpg-to-pdf-online-free",
};

export default function JpgToPdfBlog() {
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
            JPG to PDF Online Free — Convert Images to PDF in Seconds
          </h1>
          <p className="text-gray-500 text-sm mb-8">March 24, 2025 · 4 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Need to send a photo as a PDF? Scanning documents with your phone, submitting ID photos, or packaging multiple images into one file — converting JPGs to PDF is a daily task for millions of people.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to convert JPG to PDF free</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Go to <Link href="/tools/jpg-to-pdf" className="text-red-600 font-semibold hover:underline">RizzPDF JPG to PDF</Link></li>
              <li>Drop your JPG files — you can add multiple images at once</li>
              <li>Drag to reorder if needed</li>
              <li>Click <strong>Convert to PDF</strong> and download</li>
            </ol>
            <p>Each image becomes one page in the final PDF, in the order you specify.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What image formats are supported?</h2>
            <p>
              RizzPDF&apos;s JPG to PDF tool supports <strong>JPG, JPEG, and PNG</strong> files. Each image is embedded at full resolution as a separate page in the output PDF.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Will image quality be reduced?</h2>
            <p>
              No. Images are embedded at their original resolution. The conversion doesn&apos;t compress or resize your photos. If your original image is sharp, the PDF will be too.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Common use cases</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Scanned documents</strong> — phone-scanned pages combined into one PDF</li>
              <li><strong>ID submission</strong> — passport or licence photo in PDF format</li>
              <li><strong>Photo portfolios</strong> — bundle multiple images into a single file</li>
              <li><strong>Receipts and invoices</strong> — photos of receipts into one expense PDF</li>
              <li><strong>Whiteboards and notes</strong> — photos of handwritten notes as a PDF</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">JPG to PDF vs. scanning apps</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Method</th>
                    <th className="text-center px-4 py-2 font-semibold">Free</th>
                    <th className="text-center px-4 py-2 font-semibold">Browser-based</th>
                    <th className="text-center px-4 py-2 font-semibold">Multi-image</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-red-50">
                    <td className="px-4 py-2 font-semibold text-red-600">RizzPDF</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Adobe Acrobat Online</td>
                    <td className="text-center px-4 py-2">Limited</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">✗</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Phone scanning apps</td>
                    <td className="text-center px-4 py-2">Limited</td>
                    <td className="text-center px-4 py-2">✗</td>
                    <td className="text-center px-4 py-2">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What about PDF to JPG? (reverse)</h2>
            <p>
              If you need to go the other direction — extract images from a PDF — RizzPDF also has a{" "}
              <Link href="/tools/pdf-to-jpg" className="text-red-600 hover:underline font-semibold">PDF to JPG</Link>{" "}
              tool that renders each page as a high-quality image.
            </p>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">🖼️</div>
            <h3 className="font-black text-gray-900 mb-1">Convert JPG to PDF free</h3>
            <p className="text-sm text-gray-500 mb-4">Multiple images, one PDF. Files never leave your browser.</p>
            <Link
              href="/tools/jpg-to-pdf"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              JPG to PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "PDF to JPG", href: "/tools/pdf-to-jpg" },
                { label: "Compress PDF", href: "/tools/compress" },
                { label: "Merge PDF", href: "/tools/merge" },
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

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OCR a PDF Online Free — Make a Scan Searchable in Your Browser",
  description:
    "Turn a scanned PDF into text you can search, select and copy. Runs in your browser, so the scan is never uploaded — free, no account.",
  keywords: [
    "OCR PDF online free",
    "make scanned PDF searchable",
    "scanned PDF to text",
    "free OCR no upload",
    "extract text from scanned PDF",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/blog/ocr-pdf-online-free" },
  openGraph: {
    title: "OCR a PDF Online Free — Make a Scan Searchable",
    description: "Recognise the text in a scanned PDF without uploading it anywhere. Free and browser-based.",
    url: "https://www.rizzpdf.com/blog/ocr-pdf-online-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "OCR a PDF Online Free — Make a Scan Searchable in Your Browser",
  description: "How OCR works, what it can and can't read, and how to make a scanned PDF searchable without uploading it.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://www.rizzpdf.com" },
  datePublished: "2026-09-20",
  url: "https://www.rizzpdf.com/blog/ocr-pdf-online-free",
};

export default function OcrPdfBlog() {
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
            How to OCR a PDF Free — Make a Scan Searchable
          </h1>
          <p className="text-gray-500 text-sm mb-8">September 20, 2026 · 5 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              A scanned PDF is a stack of photographs. You can see the words, but your computer can&apos;t: Ctrl+F finds nothing, you can&apos;t copy a paragraph, and the file is invisible to search. OCR — optical character recognition — reads those pictures and works out what the letters say.
            </p>
            <p>
              The good version of OCR doesn&apos;t change how your document looks. It leaves the scan exactly as it is and adds an invisible layer of text on top, lined up with the words in the image. The page looks identical; it&apos;s just become searchable.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to OCR a PDF</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Open <Link href="/tools/ocr" className="text-red-600 font-semibold hover:underline">RizzPDF OCR PDF</Link></li>
              <li>Drop in your scanned PDF — it tells you whether the file already has real text</li>
              <li>Pick the pages and the language of the document</li>
              <li>Wait while each page is recognised (a second or two per page)</li>
              <li>Download the searchable PDF, or the plain text as a .txt file</li>
            </ol>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Why &quot;no upload&quot; matters here</h2>
            <p>
              Think about what people actually scan: passports, bank statements, medical letters, signed contracts, tax paperwork. Most free OCR sites upload that to a server, process it there, and hold a copy for some period described in a privacy policy you didn&apos;t read.
            </p>
            <p>
              RizzPDF runs the recognition inside your browser tab. The scan never leaves your device, so there is no copy to delete, no retention window, and nothing to breach. The only thing downloaded is the language model that does the reading.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What OCR reads well — and what it doesn&apos;t</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Type of page</th>
                    <th className="text-left px-4 py-2 font-semibold">How it goes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-4 py-2 font-medium">Flatbed scan of printed text</td><td className="px-4 py-2">Excellent — close to perfect on a clean 300 DPI scan</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">Phone photo of a document</td><td className="px-4 py-2">Good, if it&apos;s flat, sharp and evenly lit</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Faxed or heavily compressed scan</td><td className="px-4 py-2">Mixed — expect to correct some words</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">Handwriting</td><td className="px-4 py-2">Poor. OCR is built for printed type, not cursive</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Dense tables and forms</td><td className="px-4 py-2">Words are read correctly, but the layout isn&apos;t preserved</td></tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Get a better result: scan settings that matter</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>300 DPI</strong> is the sweet spot. Below 200 the letters break up; above 400 you gain little and wait longer.</li>
              <li><strong>Straighten the page.</strong> A few degrees of rotation costs real accuracy — OCR reads along horizontal lines.</li>
              <li><strong>Even light, no shadow.</strong> A shadow across the gutter of a book is the most common cause of garbled words.</li>
              <li><strong>Grayscale beats colour</strong> for plain text, and produces a smaller file.</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Does OCR change my scan?</h2>
            <p>
              It shouldn&apos;t, and in RizzPDF it doesn&apos;t. Your pages keep their original resolution, size, rotation and crop — a 300 DPI archival scan stays a 300 DPI archival scan. The file grows only by the size of the text layer. Some tools rebuild every page as a fresh, lower-resolution image, which quietly degrades the document you were trying to preserve.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Is it free?</h2>
            <p>
              Free for the first 10 pages of any document, with no account and no watermark. Longer documents need <Link href="/pricing" className="text-red-600 font-semibold hover:underline">Pro</Link> at $5 a month, which is what pays for the tools everyone else uses for free. Every other single-file tool on RizzPDF is free and unlimited.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">After OCR: what you can suddenly do</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Find any clause in a 40-page contract with Ctrl+F</li>
              <li>Copy a paragraph out of a scanned letter instead of retyping it</li>
              <li>Let your computer&apos;s search index find the file by its contents</li>
              <li>Convert it to Word — <Link href="/tools/pdf-to-word" className="text-red-600 font-semibold hover:underline">PDF to Word</Link> needs real text to work with</li>
            </ul>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-black text-gray-900 mb-1">Make a scan searchable now</h3>
            <p className="text-sm text-gray-500 mb-4">First 10 pages free. Your scan never leaves your browser.</p>
            <Link
              href="/tools/ocr"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              OCR a PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "PDF to Word", href: "/tools/pdf-to-word" },
                { label: "Compress PDF", href: "/tools/compress" },
                { label: "Crop PDF", href: "/tools/crop" },
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

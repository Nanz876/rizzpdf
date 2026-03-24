import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Merge PDF Files Online Free — No Install, No Sign Up",
  description:
    "Combine multiple PDF files into one in seconds. Works entirely in your browser — no uploads, no account, no software to install.",
  keywords: [
    "merge PDF files online free",
    "combine PDF",
    "merge PDF online",
    "join PDF files",
    "PDF merger free",
  ],
  alternates: { canonical: "https://rizzpdf.com/blog/merge-pdf-files-online-free" },
  openGraph: {
    title: "How to Merge PDF Files Online Free",
    description: "Combine multiple PDFs into one — free, no sign up, files never leave your browser.",
    url: "https://rizzpdf.com/blog/merge-pdf-files-online-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "How to Merge PDF Files Online Free — No Install, No Sign Up",
  description: "Combine multiple PDF files into one in seconds, entirely in your browser.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://rizzpdf.com" },
  datePublished: "2025-03-24",
  url: "https://rizzpdf.com/blog/merge-pdf-files-online-free",
};

export default function MergePDFBlog() {
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
            How to Merge PDF Files Online Free — No Install, No Sign Up
          </h1>
          <p className="text-gray-500 text-sm mb-8">March 24, 2025 · 4 min read</p>

          <div className="prose prose-gray max-w-none space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Need to combine several PDF documents into one? Whether you&apos;re assembling a report, packaging invoices, or combining chapters, merging PDFs takes about 10 seconds when you use the right tool.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to merge PDFs in 3 steps</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>Go to <Link href="/tools/merge" className="text-red-600 font-semibold hover:underline">RizzPDF Merge PDF</Link></li>
              <li>Drop your PDF files onto the page — drag to reorder them</li>
              <li>Click <strong>Merge PDFs</strong> and download your combined file</li>
            </ol>
            <p>That&apos;s it. No account, no email, no software to install.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Are my files safe?</h2>
            <p>
              Yes — because they never leave your device. RizzPDF runs entirely in your browser using JavaScript. Your PDFs are processed locally and never uploaded to any server. This makes it safe for sensitive documents like contracts, financial statements, or medical records.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How many files can I merge for free?</h2>
            <p>
              The free tier allows up to <strong>3 files per session</strong>. If you need to merge more, a{" "}
              <Link href="/pricing" className="text-red-600 hover:underline font-semibold">$1 day pass</Link>{" "}
              gives you unlimited merges for 24 hours. Pro subscribers ($5/month) get unlimited everything, always.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Can I reorder pages before merging?</h2>
            <p>
              Yes. After uploading your files, drag them into the order you want before clicking Merge. Each file becomes a section in the final PDF in the order you specify.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Common use cases</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Combine a cover page with a report body</li>
              <li>Package multiple invoices into one PDF for accounting</li>
              <li>Assemble scanned documents into a single file</li>
              <li>Merge chapters from separate exports into one eBook</li>
              <li>Bundle a CV with cover letter and references</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Merge PDF vs. other tools</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Tool</th>
                    <th className="text-center px-4 py-2 font-semibold">Free</th>
                    <th className="text-center px-4 py-2 font-semibold">No upload</th>
                    <th className="text-center px-4 py-2 font-semibold">No account</th>
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
                    <td className="px-4 py-2">iLovePDF</td>
                    <td className="text-center px-4 py-2">Limited</td>
                    <td className="text-center px-4 py-2">✗</td>
                    <td className="text-center px-4 py-2">✗</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Smallpdf</td>
                    <td className="text-center px-4 py-2">Limited</td>
                    <td className="text-center px-4 py-2">✗</td>
                    <td className="text-center px-4 py-2">✗</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Adobe Acrobat</td>
                    <td className="text-center px-4 py-2">✗</td>
                    <td className="text-center px-4 py-2">✗</td>
                    <td className="text-center px-4 py-2">✗</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">📄</div>
            <h3 className="font-black text-gray-900 mb-1">Merge PDFs free right now</h3>
            <p className="text-sm text-gray-500 mb-4">No account. Files never leave your browser.</p>
            <Link
              href="/tools/merge"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Merge PDFs →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">More PDF tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Split PDF", href: "/tools/split" },
                { label: "Compress PDF", href: "/tools/compress" },
                { label: "Unlock PDF", href: "/tools/unlock" },
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

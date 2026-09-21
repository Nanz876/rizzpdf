import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Redact a PDF Properly — Black Boxes Are Not Enough",
  description:
    "Drawing a black rectangle over text doesn't remove it — anyone can copy it straight back out. How to actually delete sensitive text from a PDF, free and in your browser.",
  keywords: [
    "redact PDF free",
    "redact PDF online",
    "remove text from PDF permanently",
    "black out text in PDF",
    "PDF redaction tool",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/blog/redact-pdf-online-free" },
  openGraph: {
    title: "How to Redact a PDF Properly",
    description: "Why black boxes leak, and how to permanently remove sensitive text from a PDF for free.",
    url: "https://www.rizzpdf.com/blog/redact-pdf-online-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "How to Redact a PDF Properly — Black Boxes Are Not Enough",
  description: "The difference between covering text and removing it, and how to redact a PDF so the words are genuinely gone.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://www.rizzpdf.com" },
  datePublished: "2026-09-20",
  url: "https://www.rizzpdf.com/blog/redact-pdf-online-free",
};

export default function RedactPdfBlog() {
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
            How to Redact a PDF Properly — Black Boxes Are Not Enough
          </h1>
          <p className="text-gray-500 text-sm mb-8">September 20, 2026 · 5 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Governments, law firms and banks have all made the same mistake in public: they drew black rectangles over sensitive text in a PDF, published it, and someone selected the text underneath and pasted it into a notepad. The names were still there the whole time.
            </p>
            <p>
              It happens because a PDF page has two separate things going on. There is what the page <em>looks</em> like, and there is the text stored in the file. A black rectangle only changes the first one.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Three ways people &quot;redact&quot;, and what actually happens</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Method</th>
                    <th className="text-left px-4 py-2 font-semibold">Is the text gone?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-4 py-2 font-medium">Black rectangle drawn on top</td><td className="px-4 py-2">No — copy and paste retrieves it</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">Highlighter set to black</td><td className="px-4 py-2">No — it&apos;s an annotation, removable in one click</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Print to PDF after covering</td><td className="px-4 py-2">Usually yes, but the whole document becomes a flat image and stops being searchable</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2 font-medium">True redaction</td><td className="px-4 py-2">Yes — the characters are deleted from the file itself</td></tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to redact a PDF for real</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Open <Link href="/tools/redact" className="text-red-600 font-semibold hover:underline">RizzPDF Redact PDF</Link></li>
              <li>Upload the document</li>
              <li>Drag a box over anything sensitive, or search for it — you can also match every email address, phone number or ID at once</li>
              <li>Check the list of what will be removed</li>
              <li>Download. The boxes are drawn <em>and</em> the underlying characters are deleted</li>
            </ol>
            <p>
              Afterwards, prove it to yourself: open the redacted file, try to select the blacked-out area, and search for a word you removed. Nothing should come back.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">The parts people forget to check</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Metadata.</strong> Author, title and the original filename often name the person the document is about.</li>
              <li><strong>The file name itself.</strong> &quot;Smith_termination_final.pdf&quot; defeats an afternoon of careful redaction.</li>
              <li><strong>Attachments and comments.</strong> Sticky notes and reviewer comments travel with the file — <Link href="/tools/flatten" className="text-red-600 font-semibold hover:underline">flattening</Link> deals with those.</li>
              <li><strong>Copies of the same data elsewhere</strong> in the document — a total in a table, a name repeated in a footer.</li>
              <li><strong>Small images.</strong> A signature, a logo or a screenshot can identify someone as surely as text.</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Why an offline tool is the right choice here</h2>
            <p>
              Redaction exists because a document contains something that must not spread. Uploading that document to a stranger&apos;s server to remove the secret is a strange way to keep it. RizzPDF works inside your browser: the file is never transmitted, so the unredacted version only ever exists on your own machine.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Is it free?</h2>
            <p>
              Yes — unlimited, no account, no watermark, no page limit. Redaction is exactly the kind of thing people need once, urgently, and shouldn&apos;t have to buy a subscription to do safely.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">One caution</h2>
            <p>
              Redaction can&apos;t be undone, and it shouldn&apos;t be — that&apos;s the point. Keep the original somewhere safe before you redact, and always review the finished file before sending it on.
            </p>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">⬛</div>
            <h3 className="font-black text-gray-900 mb-1">Redact a PDF free</h3>
            <p className="text-sm text-gray-500 mb-4">The text is removed, not covered. Nothing is uploaded.</p>
            <Link
              href="/tools/redact"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Redact PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Flatten PDF", href: "/tools/flatten" },
                { label: "Protect PDF", href: "/tools/protect" },
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

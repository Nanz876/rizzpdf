import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Delete a Page from a PDF Without Acrobat (Free, No Sign-Up)",
  description:
    "Delete pages from any PDF for free — no Adobe Acrobat, no account, no upload. Works in your browser on Windows, Mac, iPhone, and Android.",
  keywords: [
    "how to delete a page from a pdf without acrobat",
    "delete pages from pdf free",
    "remove page from pdf without adobe",
    "delete pdf page online free",
    "remove pages from pdf no sign up",
  ],
  alternates: { canonical: "https://rizzpdf.com/blog/how-to-delete-pages-from-pdf-without-acrobat" },
  openGraph: {
    title: "How to Delete a Page from a PDF Without Acrobat (Free, No Sign-Up)",
    description: "Delete PDF pages for free — no Adobe, no account, files never leave your browser.",
    url: "https://rizzpdf.com/blog/how-to-delete-pages-from-pdf-without-acrobat",
  },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Delete a Page from a PDF Without Acrobat",
  description: "Remove pages from a PDF file for free without Adobe Acrobat, using your browser.",
  totalTime: "PT1M",
  step: [
    {
      "@type": "HowToStep",
      name: "Open the Delete Pages tool",
      text: "Go to rizzpdf.com/tools/delete-pages in any browser — no account or download required.",
      url: "https://rizzpdf.com/tools/delete-pages",
    },
    {
      "@type": "HowToStep",
      name: "Upload your PDF",
      text: "Drag and drop your PDF onto the page or click to select it. Your file stays in your browser and is never uploaded.",
    },
    {
      "@type": "HowToStep",
      name: "Select pages to delete",
      text: "Thumbnail previews of every page appear. Click the pages you want to remove — they highlight in red.",
    },
    {
      "@type": "HowToStep",
      name: "Download the result",
      text: "Click Delete Pages and your browser immediately downloads the cleaned PDF with those pages removed.",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Can I delete pages from a PDF without Adobe Acrobat?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Browser-based tools like RizzPDF let you delete pages from any PDF for free without Adobe Acrobat. Your file is processed entirely in your browser — nothing is uploaded.",
      },
    },
    {
      "@type": "Question",
      name: "Does deleting a page affect the quality of the rest of the PDF?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. When you delete pages using a PDF library tool (not a print-to-PDF workaround), the remaining pages keep their original resolution, fonts, and vector graphics. Quality is identical to the original.",
      },
    },
    {
      "@type": "Question",
      name: "How do I delete pages from a password-protected PDF?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You need to unlock the PDF first. Use the RizzPDF Unlock tool to remove the password, then open the unlocked file in the Delete Pages tool.",
      },
    },
    {
      "@type": "Question",
      name: "Can I delete multiple pages at once?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Click as many page thumbnails as you want to mark them for deletion, then click Delete Pages once to remove all of them in a single step.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a file size limit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Since processing happens in your browser, the limit is your device's available memory. Most PDFs under 100 MB work without issue on a modern laptop or phone.",
      },
    },
  ],
};

export default function DeletePagesBlog() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100 px-6 py-4">
          <Link href="/" className="text-xl font-black">
            <span className="text-gray-900">Rizz</span><span className="text-red-600">PDF</span>
          </Link>
        </nav>

        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Guide</div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 leading-tight">
            How to Delete a Page from a PDF Without Acrobat (Free, No Sign-Up)
          </h1>
          <p className="text-gray-500 text-sm mb-8">March 30, 2026 · 6 min read</p>

          <div className="prose prose-gray max-w-none space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Adobe Acrobat charges $20/month just to delete a page. You don&apos;t need it. There are several fast, free
              ways to remove pages from a PDF — including one that works entirely in your browser with zero uploads and zero
              sign-up. Here&apos;s every method, ranked by speed and ease.
            </p>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 my-6">
              <p className="font-black text-gray-900 mb-1">Delete Pages from Any PDF — Free, Instant, No Account</p>
              <p className="text-sm text-gray-600 mb-3">Your file stays in your browser. Nothing is uploaded to any server.</p>
              <Link
                href="/tools/delete-pages"
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                Delete Pages Now — Free →
              </Link>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">The Fastest Way: Delete PDF Pages Free in Your Browser</h2>
            <p>
              The quickest method is a browser-based tool that processes your PDF locally — no upload, no waiting for a
              server, and no account wall.
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                Go to{" "}
                <Link href="/tools/delete-pages" className="text-red-600 font-semibold hover:underline">
                  RizzPDF Delete Pages
                </Link>
              </li>
              <li>Drag your PDF onto the upload zone — thumbnails of every page appear immediately</li>
              <li>Click each page you want to remove (they highlight in red)</li>
              <li>Click <strong>Delete Pages</strong> — your browser downloads the updated PDF in seconds</li>
            </ol>
            <p>
              The whole process takes under 30 seconds. Because everything runs in JavaScript inside your browser tab,
              your document is never transmitted to any server. This matters for contracts, medical records, financial
              statements, or anything you&apos;d prefer to keep private.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to Delete PDF Pages in Google Chrome (Print to PDF)</h2>
            <p>
              Chrome&apos;s built-in Print function can remove pages — but with a catch. It re-renders the PDF as a
              printed document, which means fonts may change, vector graphics can soften, and file size often increases.
              Use this only as a last resort.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Open the PDF in Chrome (drag it onto a Chrome tab)</li>
              <li>Press <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) to open Print</li>
              <li>Under <strong>Pages</strong>, select <strong>Custom</strong> and type the pages you want to <em>keep</em> (e.g. <code>1-4, 6-10</code> to skip page 5)</li>
              <li>Set <strong>Destination</strong> to <strong>Save as PDF</strong></li>
              <li>Click <strong>Save</strong></li>
            </ol>
            <p>
              The limitation: Chrome Print flattens the PDF. If the original had fillable form fields, selectable text
              with custom fonts, or high-res embedded images, the output will look slightly different. For visual-only
              documents this is fine; for structured PDFs it isn&apos;t.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to Delete PDF Pages on Mac (Built-in Preview)</h2>
            <p>
              Mac users have the best built-in option: Preview. It preserves PDF quality perfectly because it doesn&apos;t
              re-render — it deletes the page objects directly.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Open the PDF in <strong>Preview</strong> (double-click the file)</li>
              <li>Open the Thumbnails sidebar: <strong>View → Thumbnails</strong></li>
              <li>Click the page(s) you want to delete. Hold <strong>Cmd</strong> to select multiple</li>
              <li>Press <strong>Delete</strong> on your keyboard</li>
              <li>Save: <strong>File → Export as PDF</strong> (not just Save — use Export to avoid overwriting the original)</li>
            </ol>
            <p>
              Preview is free, ships with every Mac, and produces output identical in quality to the original. If
              you&apos;re on a Mac, this is the best offline option.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to Delete PDF Pages on Windows Without Adobe</h2>
            <p>
              Windows doesn&apos;t have a built-in equivalent to Preview. Your options are:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Browser tool (recommended):</strong> Use{" "}
                <Link href="/tools/delete-pages" className="text-red-600 hover:underline font-semibold">RizzPDF</Link>{" "}
                — works on any Windows browser, no install needed
              </li>
              <li><strong>Microsoft Word:</strong> Open the PDF in Word (it converts it), delete the page, save as PDF. Works but reflows the text layout — not suitable for complex PDFs</li>
              <li><strong>Google Chrome Print to PDF:</strong> Covered above — quick but reduces quality</li>
              <li>
                <strong>PDF-to-Word then back:</strong> For heavily formatted documents where you also need to edit content,{" "}
                <Link href="/tools/pdf-to-word" className="text-red-600 hover:underline">convert to Word first</Link>,
                delete the page, then export back to PDF
              </li>
            </ul>
            <p>
              For most Windows users, the browser tool is the fastest path — no download, no install, works in Edge,
              Chrome, or Firefox.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Does Deleting Pages Affect File Quality?</h2>
            <p>
              It depends on the method. Here&apos;s the key difference:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Method</th>
                    <th className="text-center px-4 py-2 font-semibold">Quality preserved</th>
                    <th className="text-center px-4 py-2 font-semibold">Text selectable</th>
                    <th className="text-center px-4 py-2 font-semibold">No account</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-red-50">
                    <td className="px-4 py-2 font-semibold text-red-600">RizzPDF (browser tool)</td>
                    <td className="text-center px-4 py-2">✓ Identical</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Mac Preview</td>
                    <td className="text-center px-4 py-2">✓ Identical</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">✓ (Mac only)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Chrome Print to PDF</td>
                    <td className="text-center px-4 py-2">⚠ Re-rendered</td>
                    <td className="text-center px-4 py-2">Usually</td>
                    <td className="text-center px-4 py-2">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Microsoft Word</td>
                    <td className="text-center px-4 py-2">✗ Reflows layout</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">Needs Office</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Adobe Acrobat</td>
                    <td className="text-center px-4 py-2">✓ Identical</td>
                    <td className="text-center px-4 py-2">✓</td>
                    <td className="text-center px-4 py-2">✗ $20/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              When a tool removes pages by manipulating PDF objects directly (as pdf-lib does in RizzPDF), the remaining
              pages are byte-for-byte identical to the original. No re-rendering, no quality loss, no change to fonts
              or images.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Can I Delete Pages from a Password-Protected PDF?</h2>
            <p>
              Not directly — a locked PDF won&apos;t let any tool modify it until the password restriction is removed.
              The fix is a two-step process:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>
                First,{" "}
                <Link href="/tools/unlock" className="text-red-600 font-semibold hover:underline">
                  unlock your PDF
                </Link>{" "}
                using the RizzPDF Unlock tool — removes the password restriction in seconds
              </li>
              <li>Then open the unlocked file in the Delete Pages tool and remove what you need</li>
            </ol>
            <p>
              If you don&apos;t know the password, see our guide on{" "}
              <Link href="/blog/how-to-remove-pdf-password" className="text-red-600 hover:underline">
                how to remove a PDF password
              </Link>{" "}
              for the options available.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Frequently Asked Questions</h2>

            <h3 className="text-base font-bold text-gray-900 mt-5 mb-2">Can I delete multiple pages at once?</h3>
            <p>
              Yes. In RizzPDF, click as many page thumbnails as you want before clicking Delete Pages — all selected
              pages are removed in one step. You can also select pages non-consecutively (e.g. pages 2, 5, and 9).
            </p>

            <h3 className="text-base font-bold text-gray-900 mt-5 mb-2">Does deleting a page reduce the file size?</h3>
            <p>
              Yes, proportionally. A PDF&apos;s file size is roughly correlated with its page count and the content on
              those pages. Deleting image-heavy pages can significantly reduce size; deleting mostly-text pages has
              a smaller but still measurable effect.
            </p>

            <h3 className="text-base font-bold text-gray-900 mt-5 mb-2">Is there a file size limit?</h3>
            <p>
              Because RizzPDF processes files in your browser (not on a server), the limit is your device&apos;s available
              memory rather than an artificial server cap. Most PDFs under 100 MB process without issue on a modern
              laptop. Very large PDFs (300+ pages, lots of images) may be slow on older devices.
            </p>

            <h3 className="text-base font-bold text-gray-900 mt-5 mb-2">Can I undo a deletion?</h3>
            <p>
              The tool downloads a new file — your original PDF is unchanged on your device. If you made a mistake,
              just open the original file again and redo the deletion with the correct pages selected.
            </p>

            <h3 className="text-base font-bold text-gray-900 mt-5 mb-2">Does this work on iPhone and Android?</h3>
            <p>
              Yes. RizzPDF is a web app that works in Safari on iPhone and Chrome on Android. The interface is
              touch-friendly — tap pages to select them, then tap Delete Pages to download.
            </p>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">✂️</div>
            <h3 className="font-black text-gray-900 mb-1">Delete PDF pages free right now</h3>
            <p className="text-sm text-gray-500 mb-4">No account. No upload. Works on Windows, Mac, iPhone, Android.</p>
            <Link
              href="/tools/delete-pages"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Delete Pages Now →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">More PDF tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Merge PDF", href: "/tools/merge" },
                { label: "Split PDF", href: "/tools/split" },
                { label: "Unlock PDF", href: "/tools/unlock" },
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

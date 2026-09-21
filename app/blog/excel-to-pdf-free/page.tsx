import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Convert Excel to PDF Without Cutting Off Columns",
  description:
    "The problem with Excel to PDF isn't converting it — it's fitting a spreadsheet onto a page. How to get a readable PDF, free and without uploading the file.",
  keywords: [
    "excel to pdf free",
    "convert xlsx to pdf",
    "excel to pdf without cutting columns",
    "spreadsheet to pdf online",
    "excel to pdf no upload",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/blog/excel-to-pdf-free" },
  openGraph: {
    title: "How to Convert Excel to PDF Without Cutting Off Columns",
    description: "Fit a wide spreadsheet onto a page properly — free, in your browser, nothing uploaded.",
    url: "https://www.rizzpdf.com/blog/excel-to-pdf-free",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: "How to Convert Excel to PDF Without Cutting Off Columns",
  description: "Why spreadsheets convert badly to PDF, and how to get a readable result with headers and columns intact.",
  author: { "@type": "Organization", name: "RizzPDF" },
  publisher: { "@type": "Organization", name: "RizzPDF", url: "https://www.rizzpdf.com" },
  datePublished: "2026-09-20",
  url: "https://www.rizzpdf.com/blog/excel-to-pdf-free",
};

export default function ExcelToPdfBlog() {
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
            How to Convert Excel to PDF Without Cutting Off Columns
          </h1>
          <p className="text-gray-500 text-sm mb-8">September 20, 2026 · 4 min read</p>

          <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Everyone who has printed a spreadsheet knows the failure: page one has the first six columns, page four has three more with no idea which row they belong to, and the headers appeared exactly once. Converting Excel to PDF is easy. Producing a PDF someone can actually read is the hard part.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Convert a spreadsheet to PDF</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Open <Link href="/tools/excel-to-pdf" className="text-red-600 font-semibold hover:underline">RizzPDF Excel to PDF</Link></li>
              <li>Drop in your .xlsx and pick which sheets to include</li>
              <li>Choose portrait, landscape, or let it decide per sheet</li>
              <li>Download</li>
            </ol>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What makes the result readable</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Wide sheets split by column groups</strong>, and every group after the first repeats the left-hand column — so on page three you can still tell which row you&apos;re looking at. Columns are never quietly chopped off.</li>
              <li><strong>Header rows repeat</strong> at the top of every page.</li>
              <li><strong>Landscape when it helps.</strong> Set it to auto and each sheet gets the orientation that suits it.</li>
              <li><strong>Each sheet starts a new page</strong>, titled with the sheet name.</li>
              <li><strong>Values read as values.</strong> Dates stay dates rather than turning into numbers like 45321, percentages and currency keep their formatting, and formulas show their result — not the formula.</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Make the spreadsheet easier to convert</h2>
            <p>
              A few minutes in Excel first improves any conversion, whatever tool you use:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Hide working columns nobody needs to see</li>
              <li>Widen columns so nothing shows as <code className="bg-gray-100 px-1 rounded">#####</code></li>
              <li>Freeze the header row — it&apos;s how the converter knows what a header is</li>
              <li>Take out blank spacer columns; they cost page width and say nothing</li>
              <li>If a sheet is genuinely enormous, filter it to what the reader needs</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What doesn&apos;t come across</h2>
            <p>
              Charts, images, conditional formatting colours, pivot tables and per-cell fonts aren&apos;t re-created — you get a clean, readable table of your data. If a chart is the point of the document, screenshot it into a document instead, or use Excel&apos;s own export.
            </p>
            <p>
              And because the built-in PDF fonts are Latin-only, a sheet that genuinely needs Chinese, Cyrillic or emoji is refused with a clear message rather than coming out as boxes.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Why convert at all?</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Send the .xlsx when</th>
                    <th className="text-left px-4 py-2 font-semibold">Send a PDF when</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-4 py-2">They need to edit or re-sort it</td><td className="px-4 py-2">The numbers are final</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-2">They&apos;ll build on your formulas</td><td className="px-4 py-2">You&apos;d rather they didn&apos;t see your formulas</td></tr>
                  <tr><td className="px-4 py-2">They also have Excel</td><td className="px-4 py-2">It&apos;s being read on a phone, or printed</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              That second row matters more than people expect. A spreadsheet carries hidden sheets, comments, filtered-out rows and the formulas behind your figures. A PDF carries only what you meant to send.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Your data stays on your machine</h2>
            <p>
              Spreadsheets are payroll, pricing, client lists and budgets — the files a company least wants sitting on a stranger&apos;s server. RizzPDF converts inside your browser tab, so the file is never transmitted anywhere.
            </p>
          </div>

          <div className="mt-10 bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-black text-gray-900 mb-1">Convert Excel to PDF free</h3>
            <p className="text-sm text-gray-500 mb-4">Headers repeat, columns stay readable, nothing uploaded.</p>
            <Link
              href="/tools/excel-to-pdf"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Excel to PDF →
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3 font-semibold">Related tools:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Word to PDF", href: "/tools/word-to-pdf" },
                { label: "PowerPoint to PDF", href: "/tools/powerpoint-to-pdf" },
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

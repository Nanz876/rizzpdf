import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PDF Tips & Guides | RizzPDF",
  description:
    "Free guides on how to merge, split, compress, sign, and convert PDFs online — no software, no account needed.",
  alternates: { canonical: "https://www.rizzpdf.com/blog" },
};

const posts = [
  {
    slug: "merge-pdf-files-online-free",
    title: "How to Merge PDF Files Online Free — No Install, No Sign Up",
    description: "Combine multiple PDF files into one in seconds. Works entirely in your browser — no uploads, no account.",
    date: "March 24, 2026",
    readTime: "4 min read",
  },
  {
    slug: "compress-pdf-without-losing-quality",
    title: "How to Compress a PDF Without Losing Quality",
    description: "Reduce PDF file size without making it blurry. Three compression levels, runs in your browser, files never uploaded.",
    date: "March 24, 2026",
    readTime: "5 min read",
  },
  {
    slug: "split-pdf-online-free",
    title: "How to Split a PDF Online Free — Extract Pages Instantly",
    description: "Split a PDF into separate pages or extract a range — free, no account, no upload. Everything runs in your browser.",
    date: "March 24, 2026",
    readTime: "4 min read",
  },
  {
    slug: "jpg-to-pdf-online-free",
    title: "JPG to PDF Online Free — Convert Images to PDF in Seconds",
    description: "Convert one or more JPG images into a single PDF file. Free, no account, files never uploaded to any server.",
    date: "March 24, 2026",
    readTime: "4 min read",
  },
  {
    slug: "sign-pdf-online-free",
    title: "How to Sign a PDF Online Free — Draw or Upload Your Signature",
    description: "Add your signature to any PDF without printing. Draw it or upload an image — free, no account, files stay in your browser.",
    date: "March 24, 2026",
    readTime: "5 min read",
  },
  {
    slug: "convert-pdf-to-word-online-free",
    title: "Convert PDF to Word Online Free — No Email, No Sign Up",
    description: "Convert any PDF to an editable Word document online for free. No sign-up, no email required — runs entirely in your browser.",
    date: "March 23, 2026",
    readTime: "4 min read",
  },
  {
    slug: "pdf-to-word-without-losing-formatting",
    title: "How to Convert PDF to Word Without Losing Formatting",
    description: "Why PDF formatting gets lost during conversion, which tools preserve it best, and tips to get clean output every time.",
    date: "March 23, 2026",
    readTime: "5 min read",
  },
  {
    slug: "how-to-edit-pdf-in-word",
    title: "How to Edit a PDF in Word — Free, Without Adobe Acrobat",
    description: "Two methods to edit a PDF in Word: convert it first, or edit directly in your browser. Step-by-step guide.",
    date: "March 23, 2026",
    readTime: "4 min read",
  },
  {
    slug: "how-to-unlock-pdf-without-password",
    title: "How to Unlock a PDF Without the Password (3 Methods)",
    description:
      "Forgot your PDF password? Here are 3 methods to unlock a PDF without knowing the password — including free in-browser tools.",
    date: "March 12, 2026",
    readTime: "5 min read",
  },
  {
    slug: "remove-pdf-restrictions-online",
    title: "How to Remove PDF Restrictions Online — Free, No Software",
    description:
      "Remove editing, printing, and copying restrictions from any PDF online for free. No software download, no account required.",
    date: "March 12, 2026",
    readTime: "4 min read",
  },
  {
    slug: "how-to-remove-pdf-password",
    title: "How to Remove a Password from a PDF (Free, No Software)",
    description:
      "Step-by-step guide to removing PDF password protection for free — no Adobe Acrobat needed, works on Mac, Windows and mobile.",
    date: "March 12, 2026",
    readTime: "4 min read",
  },
  {
    slug: "unlock-pdf-online-free",
    title: "Unlock PDF Online Free — No Email, No Sign Up Required",
    description:
      "Unlock any password-protected PDF online for free. No sign up, no email required, files processed entirely in your browser.",
    date: "March 12, 2026",
    readTime: "3 min read",
  },
  {
    slug: "best-pdf-password-remover",
    title: "5 Best Free PDF Password Removers in 2026",
    description:
      "Comparing the best free PDF password removal tools in 2026 — features, privacy, price and ease of use.",
    date: "March 12, 2026",
    readTime: "5 min read",
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-white hover:text-purple-400 transition-colors">
            RizzPDF
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">PDF Tips &amp; Guides</h1>
          <p className="text-gray-400 text-lg">
            Free guides to help you work smarter with PDFs
          </p>
        </div>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group"
            >
              <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-purple-500 transition-colors">
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span>{post.date}</span>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="text-xl font-semibold mb-2 group-hover:text-purple-400 transition-colors">
                  {post.title}
                </h2>
                <p className="text-gray-400 leading-relaxed">{post.description}</p>
                <div className="mt-4 text-purple-400 text-sm font-medium">
                  Read article →
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 mt-16">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} RizzPDF ·{" "}
            <Link href="/" className="hover:text-gray-300 transition-colors">Unlock a PDF</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

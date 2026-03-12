import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Remove a Password from a PDF (Free, No Software)",
  description:
    "Step-by-step guide to removing PDF password protection for free — no Adobe Acrobat needed, works on Mac, Windows and mobile.",
  alternates: {
    canonical: "https://www.rizzpdf.com/blog/how-to-remove-pdf-password",
  },
};

export default function HowToRemovePdfPassword() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-white hover:text-purple-400 transition-colors">
            RizzPDF
          </Link>
          <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← All guides
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-6">
          <span>March 12, 2025</span>
          <span>·</span>
          <span>4 min read</span>
        </div>

        <h1 className="text-4xl font-bold mb-6 leading-tight">
          How to Remove a Password from a PDF (Free)
        </h1>

        <p className="text-gray-300 text-lg leading-relaxed mb-10">
          You've got a PDF locked behind a password. Maybe you set it years ago and forgot it, or a client sent you a locked file you can't easily open. Whatever the reason, removing a PDF password should be simple — and it doesn't require expensive software. Here are three free methods, from easiest to most manual.
        </p>

        <div className="space-y-12">
          {/* Method 1 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">
              Method 1 — Use RizzPDF (Free, In-Browser)
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              <Link href="https://www.rizzpdf.com" className="text-purple-400 hover:text-purple-300 underline">RizzPDF</Link> is the fastest way to unlock a PDF without installing anything. The entire process happens inside your browser — your files never get uploaded to any server, which makes it completely private.
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>Go to <Link href="https://www.rizzpdf.com" className="text-purple-400 hover:text-purple-300 underline">rizzpdf.com</Link></li>
              <li>Drag and drop your password-protected PDF onto the upload zone (or click to browse)</li>
              <li>Enter the PDF password when prompted, then click <strong className="text-white">Unlock</strong></li>
              <li>Download your unlocked PDF instantly</li>
            </ol>
            <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
              <strong className="text-white">Free tier:</strong> Unlock up to 3 PDFs for free, no account needed. Need more? Pay $1 for unlimited unlocks for 24 hours.
            </div>
          </section>

          {/* Method 2 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">
              Method 2 — Google Chrome Print Trick
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you know the password to the PDF, Chrome has a built-in trick that effectively strips the password by printing to a new PDF file.
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>Open the password-protected PDF in Google Chrome</li>
              <li>Enter the password to unlock it for viewing</li>
              <li>Press <kbd className="bg-gray-800 px-2 py-0.5 rounded text-white text-xs">Ctrl+P</kbd> (Windows) or <kbd className="bg-gray-800 px-2 py-0.5 rounded text-white text-xs">Cmd+P</kbd> (Mac) to open the print dialog</li>
              <li>Under <em>Destination</em>, select <strong className="text-white">Save as PDF</strong></li>
              <li>Click <strong className="text-white">Save</strong> — the new file will have no password</li>
            </ol>
            <p className="mt-4 text-gray-400 text-sm">
              <strong className="text-gray-300">Limitation:</strong> This only works if you already know the password. It won't help if you've forgotten it.
            </p>
          </section>

          {/* Method 3 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">
              Method 3 — Adobe Acrobat (Paid)
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Adobe Acrobat Pro can remove PDF passwords natively. Open the PDF, go to <strong className="text-white">Tools → Protect → Encrypt → Remove Security</strong>. However, Acrobat Pro costs ~$25/month, which is overkill for this single task.
            </p>
            <p className="text-gray-400 text-sm">
              Unless you already have an Acrobat subscription, the methods above are far more practical.
            </p>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-bold mb-6 text-white">Frequently Asked Questions</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Is it safe to unlock a PDF online?</h3>
                <p className="text-gray-300 leading-relaxed">
                  With RizzPDF, yes — your file never leaves your browser. Everything is processed locally using PDF.js. Other tools that upload your files to their servers carry more risk, especially for sensitive documents.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Does this work on mobile?</h3>
                <p className="text-gray-300 leading-relaxed">
                  Yes. RizzPDF works on any device with a modern browser — iPhone, Android, Mac, Windows or Linux. No app download needed.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">What if I forgot the password?</h3>
                <p className="text-gray-300 leading-relaxed">
                  If you've set and forgotten the owner password (the one that restricts editing/printing), RizzPDF can often remove those restrictions. However, if you've forgotten the <em>open password</em> (the one required to view the file), no free tool can recover it — that requires password cracking software.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-purple-900/30 border border-purple-700/40 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Ready to unlock your PDF?</h2>
            <p className="text-gray-300 mb-6">Free for 3 files. No sign-up. Files stay in your browser.</p>
            <Link
              href="/"
              className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Unlock PDF Free →
            </Link>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 mt-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} RizzPDF ·{" "}
            <Link href="/blog" className="hover:text-gray-300 transition-colors">All guides</Link>
            {" · "}
            <Link href="/" className="hover:text-gray-300 transition-colors">Unlock a PDF</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

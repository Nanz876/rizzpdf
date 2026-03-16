// components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#1a1a2e] text-gray-400 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Product</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/tools" className="hover:text-white transition-colors">All Tools</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Tools</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tools/merge" className="hover:text-white transition-colors">Merge PDF</Link></li>
              <li><Link href="/tools/split" className="hover:text-white transition-colors">Split PDF</Link></li>
              <li><Link href="/tools/compress" className="hover:text-white transition-colors">Compress PDF</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Unlock PDF</Link></li>
              <li><Link href="/tools/rotate" className="hover:text-white transition-colors">Rotate PDF</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Legal</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Company</p>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:support@rizzpdf.com" className="hover:text-white transition-colors">Support</a></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-lg font-black">
            Rizz<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">PDF</span>
          </p>
          <p className="text-sm">© {new Date().getFullYear()} RizzPDF. All processing happens in your browser.</p>
          <div className="flex gap-4">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">Twitter</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            RizzPDF
          </span>
          <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
            BETA
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <a href="#how-it-works" className="hover:text-purple-600 transition-colors hidden sm:block">
            How it works
          </a>
          <a href="#pricing" className="hover:text-purple-600 transition-colors hidden sm:block">
            Pricing
          </a>
          <button className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity">
            Sign up free
          </button>
        </div>
      </div>
    </nav>
  );
}

// components/Navbar.tsx
"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav className="w-full border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">

        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            RizzPDF
          </span>
        </Link>

        {/* Primary nav links — ALL CAPS */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          <Link
            href="/tools/merge"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            Merge PDF
          </Link>
          <Link
            href="/tools/split"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            Split PDF
          </Link>
          <Link
            href="/tools/compress"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            Compress PDF
          </Link>
          <Link
            href="/tools"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            All PDF Tools ▾
          </Link>
        </div>

        {/* Right side auth */}
        <div className="ml-auto flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block text-[13px] font-semibold text-gray-600 hover:text-purple-600 transition-colors"
              >
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden sm:block text-[13px] font-semibold text-gray-600 border border-gray-300 px-4 py-1.5 rounded-full hover:border-purple-400 hover:text-purple-600 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-[13px] font-bold bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}

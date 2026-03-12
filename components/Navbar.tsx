"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { isSignedIn, isLoaded } = useUser();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="w-full border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={scrollToTop} className="flex items-center gap-2 cursor-pointer">
          <span className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            RizzPDF
          </span>
          <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
            BETA
          </span>
        </button>

        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <button
            onClick={() => scrollTo("how-it-works")}
            className="hover:text-purple-600 transition-colors hidden sm:block"
          >
            How it works
          </button>
          <button
            onClick={() => scrollTo("pricing")}
            className="hover:text-purple-600 transition-colors hidden sm:block"
          >
            Pricing
          </button>
          <a
            href="mailto:support@rizzpdf.com"
            className="hover:text-purple-600 transition-colors hidden sm:block"
          >
            Support
          </a>

          {isLoaded && isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="hover:text-purple-600 transition-colors hidden sm:block"
              >
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hover:text-purple-600 transition-colors hidden sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
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

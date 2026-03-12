import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = "https://www.rizzpdf.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "RizzPDF — Remove PDF Password Protection Instantly & Free",
    template: "%s | RizzPDF",
  },
  description:
    "Remove PDF password protection instantly — free for up to 3 files. No account needed, no uploads, files stay in your browser. Unlock PDFs in seconds.",
  keywords: [
    "unlock PDF",
    "remove PDF password",
    "PDF password remover",
    "PDF unlocker",
    "unlock password protected PDF",
    "remove PDF restrictions",
    "free PDF unlock",
    "online PDF unlocker",
    "decrypt PDF",
    "PDF password tool",
  ],
  authors: [{ name: "RizzPDF" }],
  creator: "RizzPDF",
  publisher: "RizzPDF",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "RizzPDF",
    title: "RizzPDF — Remove PDF Password Protection Instantly & Free",
    description:
      "Unlock any password-protected PDF in seconds. Free for 3 files, no account needed. Files never leave your browser.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RizzPDF — Unlock PDF Passwords Instantly",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RizzPDF — Remove PDF Password Protection Instantly & Free",
    description:
      "Unlock any password-protected PDF in seconds. Free for 3 files, no account needed.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} antialiased bg-white text-gray-900`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

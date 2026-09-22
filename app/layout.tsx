import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = "https://www.rizzpdf.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "RizzPDF — Free Online PDF Tools: Merge, Split, Compress & More",
    template: "%s | RizzPDF",
  },
  description:
    "Free online PDF tools that run 100% in your browser. Merge, split, compress, rotate, convert, sign, watermark and unlock PDFs — no uploads, no account required.",
  keywords: [
    "PDF tools online",
    "merge PDF",
    "split PDF",
    "compress PDF",
    "rotate PDF",
    "unlock PDF",
    "remove PDF password",
    "PDF to JPG",
    "JPG to PDF",
    "PDF to Word",
    "sign PDF",
    "watermark PDF",
    "free PDF editor",
    "online PDF converter",
    "PDF organizer",
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
  verification: {
    google: "arJypJwKAtHOBHWgE326pVJAWJpCRi3-bF640z7CXLI",
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "RizzPDF",
    title: "RizzPDF — Free Online PDF Tools",
    description:
      "Merge, split, compress, convert, sign and unlock PDFs — all free, all in your browser. No uploads. No account needed.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RizzPDF — Free Online PDF Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RizzPDF — Free Online PDF Tools",
    description:
      "Merge, split, compress, convert, sign and unlock PDFs — all free, all in your browser.",
    images: ["/og-image.png"],
  },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RizzPDF",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  url: BASE_URL,
  description:
    "Free online PDF tools that run 100% in your browser. Merge, split, compress, rotate, convert, sign, watermark and unlock PDFs — no uploads, no account required.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Merge PDF",
    "Split PDF",
    "Compress PDF",
    "Rotate PDF",
    "Delete Pages",
    "PDF to Word",
    "PDF to JPG",
    "JPG to PDF",
    "Unlock PDF",
    "Sign PDF",
    "Watermark PDF",
    "Organize PDF",
    "Add Page Numbers",
    "Protect PDF",
    "Repair PDF",
    "PDF to PNG",
    "Batch Processing",
    "Crop PDF",
    "Redact PDF",
    "Fill PDF Forms",
    "Flatten PDF",
    "Word to PDF",
    "Excel to PDF",
    "PowerPoint to PDF",
    "OCR PDF",
    "Edit PDF Text",
  ],
  publisher: {
    "@type": "Organization",
    name: "RizzPDF",
    url: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        // Google and GitHub sign-in are switched on in the Clerk production
        // instance but have no OAuth credentials yet, so both buttons send
        // visitors to a Google/GitHub "Access blocked: missing client_id" page.
        // Hidden until the credentials are added in Clerk; email codes work.
        // Remove these two lines once social sign-in is configured.
        elements: {
          socialButtonsRoot: { display: "none" },
          dividerRow: { display: "none" },
        },
      }}
    >
      <html lang="en">
        <body className={`${inter.className} antialiased bg-white text-gray-900`}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
          />
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}

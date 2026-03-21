import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress PDF Online Free — Reduce File Size | RizzPDF",
  description: "Reduce PDF file size without losing quality. Free, browser-based compression — your files never leave your device. No sign-up required.",
  keywords: ["compress pdf", "reduce pdf size", "compress pdf online free", "pdf compressor", "shrink pdf"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/compress" },
  openGraph: {
    title: "Compress PDF Online Free | RizzPDF",
    description: "Reduce PDF file size instantly. Free, browser-only, no upload.",
    url: "https://www.rizzpdf.com/tools/compress",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Compress PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/compress",
      "description": "Reduce PDF file size online for free. Browser-based — files never uploaded to a server.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Compress PDF", "item": "https://www.rizzpdf.com/tools/compress" },
      ],
    },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}

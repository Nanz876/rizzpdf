import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to PNG Converter Online Free | RizzPDF",
  description: "Convert PDF pages to high-quality PNG images with transparency support. Free, browser-based — files never leave your device.",
  keywords: ["pdf to png", "convert pdf to png online free", "pdf to png converter", "pdf page to image", "pdf to transparent png"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/pdf-to-png" },
  openGraph: {
    title: "PDF to PNG Converter Online Free | RizzPDF",
    description: "Convert PDF pages to PNG images. Free, browser-only.",
    url: "https://www.rizzpdf.com/tools/pdf-to-png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PDF to PNG — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/pdf-to-png",
      "description": "Convert PDF pages to PNG images online for free. Browser-based, no upload needed.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "PDF to PNG", "item": "https://www.rizzpdf.com/tools/pdf-to-png" },
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

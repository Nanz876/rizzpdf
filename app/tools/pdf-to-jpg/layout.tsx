import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to JPG Converter Online Free | RizzPDF",
  description: "Convert PDF pages to high-quality JPG images instantly. Free, browser-based — your files never leave your device. No sign-up required.",
  keywords: ["pdf to jpg", "pdf to jpeg", "convert pdf to image", "pdf to jpg online free", "pdf to picture"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/pdf-to-jpg" },
  openGraph: {
    title: "PDF to JPG Converter Online Free | RizzPDF",
    description: "Convert PDF pages to JPG images. Free, instant, browser-only.",
    url: "https://www.rizzpdf.com/tools/pdf-to-jpg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PDF to JPG — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/pdf-to-jpg",
      "description": "Convert PDF pages to JPG images online for free. Browser-based, no upload needed.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "PDF to JPG", "item": "https://www.rizzpdf.com/tools/pdf-to-jpg" },
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

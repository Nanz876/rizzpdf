import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rotate PDF Pages Online Free | RizzPDF",
  description: "Rotate PDF pages 90°, 180°, or 270°. Rotate all pages or select specific ones. Free, browser-based — no software or sign-up needed.",
  keywords: ["rotate pdf", "rotate pdf pages", "rotate pdf online free", "flip pdf pages", "pdf rotate"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/rotate" },
  openGraph: {
    title: "Rotate PDF Pages Online Free | RizzPDF",
    description: "Rotate PDF pages instantly. Free, browser-only, no upload.",
    url: "https://www.rizzpdf.com/tools/rotate",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Rotate PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/rotate",
      "description": "Rotate PDF pages 90, 180, or 270 degrees online for free.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Rotate PDF", "item": "https://www.rizzpdf.com/tools/rotate" },
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

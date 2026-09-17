import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crop PDF Online Free — Trim Margins | RizzPDF",
  description: "Trim margins from a PDF by dragging a crop box or entering exact percentages. Crop all pages, one page, or a custom range. Free, browser-based — no software or sign-up needed.",
  keywords: ["crop pdf", "trim pdf margins", "crop pdf online free", "resize pdf page", "pdf crop tool"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/crop" },
  openGraph: {
    title: "Crop PDF Online Free — Trim Margins | RizzPDF",
    description: "Trim PDF margins instantly. Free, browser-only, no upload.",
    url: "https://www.rizzpdf.com/tools/crop",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Crop PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/crop",
      "description": "Trim margins from PDF pages online for free by dragging a crop box or entering exact percentages.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Crop PDF", "item": "https://www.rizzpdf.com/tools/crop" },
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

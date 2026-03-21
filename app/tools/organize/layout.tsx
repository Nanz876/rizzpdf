import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organize PDF Pages Online Free — Reorder & Delete | RizzPDF",
  description: "Drag and drop to reorder or delete PDF pages. Visual page editor — free, browser-based, no sign-up required.",
  keywords: ["organize pdf pages", "reorder pdf pages", "rearrange pdf pages online free", "pdf page organizer", "delete pdf pages"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/organize" },
  openGraph: {
    title: "Organize PDF Pages Online Free | RizzPDF",
    description: "Reorder and delete PDF pages visually. Free, browser-only.",
    url: "https://www.rizzpdf.com/tools/organize",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Organize PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/organize",
      "description": "Reorder and delete PDF pages with a drag-and-drop editor. Free and browser-based.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Organize PDF", "item": "https://www.rizzpdf.com/tools/organize" },
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

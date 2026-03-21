import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete PDF Pages Online Free | RizzPDF",
  description: "Remove unwanted pages from your PDF instantly. Select and delete any pages — free, browser-based, no account or software needed.",
  keywords: ["delete pdf pages", "remove pdf pages online free", "delete pages from pdf", "remove pages pdf", "pdf page remover"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/delete-pages" },
  openGraph: {
    title: "Delete PDF Pages Online Free | RizzPDF",
    description: "Remove pages from PDFs instantly. Free, browser-only.",
    url: "https://www.rizzpdf.com/tools/delete-pages",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Delete PDF Pages — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/delete-pages",
      "description": "Delete specific pages from PDF files online for free. Browser-based, no upload needed.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Delete PDF Pages", "item": "https://www.rizzpdf.com/tools/delete-pages" },
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

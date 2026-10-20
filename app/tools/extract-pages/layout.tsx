import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract PDF Pages Online Free | RizzPDF",
  description:
    "Pull selected pages out of a PDF into a new file. Pick the pages you want to keep — free, browser-based, no account or software needed.",
  keywords: [
    "extract pdf pages",
    "extract pages from pdf online free",
    "pull pages from pdf",
    "save pdf pages as new file",
    "pdf page extractor",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/tools/extract-pages" },
  openGraph: {
    title: "Extract PDF Pages Online Free | RizzPDF",
    description: "Keep only the pages you want. Free, browser-only, no uploads.",
    url: "https://www.rizzpdf.com/tools/extract-pages",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Extract PDF Pages — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/extract-pages",
      "description": "Extract selected pages from a PDF into a new file online for free. Browser-based, no upload needed.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Extract PDF Pages", "item": "https://www.rizzpdf.com/tools/extract-pages" },
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

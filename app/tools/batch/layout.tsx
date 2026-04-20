import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Batch Process PDFs Online Free — Compress, Rotate & More | RizzPDF",
  description: "Process multiple PDF files at once. Batch compress, rotate, watermark, add page numbers, convert to JPG, or unlock PDFs — free, browser-based, no uploads.",
  keywords: ["batch pdf", "batch compress pdf", "process multiple pdfs", "bulk pdf tool", "batch pdf converter", "pdf batch processing online"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/batch" },
  openGraph: {
    title: "Batch Process PDFs Online Free | RizzPDF",
    description: "Compress, rotate, watermark and more — process multiple PDFs at once. Free and browser-only.",
    url: "https://www.rizzpdf.com/tools/batch",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Batch PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/batch",
      "description": "Process multiple PDF files at once. Batch compress, rotate, watermark, add page numbers, convert to JPG, or unlock PDFs — free and browser-based.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Batch PDF", "item": "https://www.rizzpdf.com/tools/batch" },
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

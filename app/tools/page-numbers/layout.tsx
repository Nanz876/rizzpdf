import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Page Numbers to PDF Online Free | RizzPDF",
  description: "Add page numbers to any PDF instantly. Choose position, format, and starting number. Free, browser-based — no account or software needed.",
  keywords: ["add page numbers to pdf", "pdf page numbers online free", "number pdf pages", "pdf pagination", "add page numbers"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/page-numbers" },
  openGraph: {
    title: "Add Page Numbers to PDF Online Free | RizzPDF",
    description: "Add page numbers to PDFs instantly. Free, browser-only.",
    url: "https://www.rizzpdf.com/tools/page-numbers",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Add Page Numbers to PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/page-numbers",
      "description": "Add customizable page numbers to PDF files online for free.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Add Page Numbers", "item": "https://www.rizzpdf.com/tools/page-numbers" },
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

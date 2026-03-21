import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Repair PDF Online Free — Fix Corrupted PDFs | RizzPDF",
  description: "Fix corrupted or damaged PDF files online. Free, browser-based repair tool — no software download or account required.",
  keywords: ["repair pdf", "fix corrupted pdf", "repair pdf online free", "pdf repair tool", "fix broken pdf"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/repair" },
  openGraph: {
    title: "Repair PDF Online Free | RizzPDF",
    description: "Fix corrupted PDF files instantly. Free, browser-only.",
    url: "https://www.rizzpdf.com/tools/repair",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Repair PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/repair",
      "description": "Repair and recover corrupted PDF files online for free. Browser-based, no upload needed.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Repair PDF", "item": "https://www.rizzpdf.com/tools/repair" },
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

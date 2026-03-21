import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Split PDF Online Free — Extract Pages Instantly | RizzPDF",
  description: "Split a PDF into individual pages or custom page ranges. Free, browser-based — files never leave your device. No account needed.",
  keywords: ["split pdf", "split pdf online free", "extract pdf pages", "pdf splitter", "divide pdf"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/split" },
  openGraph: {
    title: "Split PDF Online Free | RizzPDF",
    description: "Split PDFs into pages or ranges. Free, instant, browser-only.",
    url: "https://www.rizzpdf.com/tools/split",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Split PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/split",
      "description": "Split a PDF into individual pages or extract custom page ranges, free in your browser.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Split PDF", "item": "https://www.rizzpdf.com/tools/split" },
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

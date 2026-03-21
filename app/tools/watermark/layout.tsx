import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Watermark to PDF Online Free | RizzPDF",
  description: "Add custom text watermarks to your PDF pages. Choose opacity, rotation, and position. Free, browser-based — files never leave your device.",
  keywords: ["add watermark to pdf", "pdf watermark online free", "watermark pdf", "stamp pdf", "pdf text watermark"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/watermark" },
  openGraph: {
    title: "Add Watermark to PDF Online Free | RizzPDF",
    description: "Add text watermarks to PDFs. Free, instant, browser-only.",
    url: "https://www.rizzpdf.com/tools/watermark",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Watermark PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/watermark",
      "description": "Add custom text watermarks to PDF files online for free.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Watermark PDF", "item": "https://www.rizzpdf.com/tools/watermark" },
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

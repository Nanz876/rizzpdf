import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge PDF Files Online Free — No Upload Needed | RizzPDF",
  description: "Combine multiple PDF files into one document instantly. Free, browser-based — your files never leave your device. No sign-up required.",
  keywords: ["merge pdf", "combine pdf files", "merge pdf online free", "join pdf files", "pdf merger"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/merge" },
  openGraph: {
    title: "Merge PDF Files Online Free | RizzPDF",
    description: "Combine multiple PDFs into one file. Free, instant, browser-only.",
    url: "https://www.rizzpdf.com/tools/merge",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Merge PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/merge",
      "description": "Combine multiple PDF files into one document online, free, with no file upload required.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Merge PDF", "item": "https://www.rizzpdf.com/tools/merge" },
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

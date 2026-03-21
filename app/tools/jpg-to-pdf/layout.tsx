import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JPG to PDF Converter Online Free | RizzPDF",
  description: "Convert JPG, PNG, or any image to a PDF file instantly. Free, browser-based — your files never leave your device. No account needed.",
  keywords: ["jpg to pdf", "image to pdf", "jpeg to pdf", "png to pdf", "convert image to pdf online free"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/jpg-to-pdf" },
  openGraph: {
    title: "JPG to PDF Converter Online Free | RizzPDF",
    description: "Convert images to PDF instantly. Free, browser-only, no upload.",
    url: "https://www.rizzpdf.com/tools/jpg-to-pdf",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "JPG to PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/jpg-to-pdf",
      "description": "Convert JPG and other images to PDF online for free. Browser-based, no upload needed.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "JPG to PDF", "item": "https://www.rizzpdf.com/tools/jpg-to-pdf" },
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

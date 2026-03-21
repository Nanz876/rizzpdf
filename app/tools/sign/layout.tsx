import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign PDF Online Free — Draw or Upload Signature | RizzPDF",
  description: "Add your signature to a PDF online. Draw it or upload a photo — place it exactly where you want. Free, browser-based, no account needed.",
  keywords: ["sign pdf online free", "add signature to pdf", "pdf signature", "esign pdf", "sign pdf without software"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/sign" },
  openGraph: {
    title: "Sign PDF Online Free | RizzPDF",
    description: "Draw or upload your signature and place it on any PDF. Free, browser-only.",
    url: "https://www.rizzpdf.com/tools/sign",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Sign PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/sign",
      "description": "Sign PDF files online for free. Draw or upload a signature and place it precisely on any page.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Sign PDF", "item": "https://www.rizzpdf.com/tools/sign" },
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

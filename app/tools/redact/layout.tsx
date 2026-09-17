import type { Metadata } from "next";

const TITLE = "Redact PDF Online Free — Permanently Remove Text | RizzPDF";
const DESCRIPTION =
  "Black out names, numbers, emails and images in a PDF. Text and images under the boxes are permanently removed, not just covered; redacted pages become images. Free and private — your file never leaves your browser.";
const URL = "https://www.rizzpdf.com/tools/redact";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["redact pdf", "redact pdf online free", "black out text in pdf", "remove sensitive information from pdf", "pdf redaction tool"],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Permanently remove text and images under black boxes. Redacted pages become images. Browser-only, no upload.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Redact PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Permanently remove text and images under black boxes in a PDF, in your browser. Redacted pages are converted to images.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Redact PDF", "item": URL },
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

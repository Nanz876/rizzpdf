import type { Metadata } from "next";

const TITLE = "Compare PDF Free — Find Differences Between Two PDFs | RizzPDF";
const DESCRIPTION =
  "Compare two PDFs and see exactly what changed. Added and removed words are highlighted side by side, free and in your browser. No sign-up, no uploads.";
const URL = "https://www.rizzpdf.com/tools/compare";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "compare pdf",
    "compare two pdfs",
    "pdf diff online free",
    "find differences between pdfs",
    "pdf comparison tool",
    "compare pdf no email",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Compare two PDFs and see what changed, highlighted side by side. Free, browser-only, no uploads.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Compare PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Compare the text of two PDFs and highlight added and removed words side by side, in your browser.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Compare PDF", "item": URL },
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

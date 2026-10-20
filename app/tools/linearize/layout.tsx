import type { Metadata } from "next";

const TITLE = "Fast Web View — Linearize PDF Online Free | RizzPDF";
const DESCRIPTION =
  "Optimize a PDF for Fast Web View (linearization) so the first page loads instantly over the web. Free, browser-based, no sign-up, no uploads.";
const URL = "https://www.rizzpdf.com/tools/linearize";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "linearize pdf",
    "fast web view pdf",
    "optimize pdf for web",
    "pdf fast web view online free",
    "web optimized pdf",
    "linearize pdf online",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Optimize a PDF for Fast Web View so the first page loads instantly. Free, browser-only, no uploads.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Fast Web View (Linearize PDF) — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Linearize a PDF for Fast Web View so the first page renders before the whole file downloads, in your browser.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Fast Web View", "item": URL },
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

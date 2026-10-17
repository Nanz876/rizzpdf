import type { Metadata } from "next";

const TITLE = "PDF to PowerPoint Free — Convert PDF to PPTX Online | RizzPDF";
const DESCRIPTION =
  "Convert PDF to PowerPoint (.pptx) free in your browser. Each page becomes a full-slide image that looks exactly like your PDF. No sign-up, no uploads.";
const URL = "https://www.rizzpdf.com/tools/pdf-to-powerpoint";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "pdf to powerpoint",
    "pdf to powerpoint free",
    "convert pdf to pptx online free",
    "pdf to ppt converter",
    "pdf to slides",
    "pdf to powerpoint no email",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Convert PDF to a PowerPoint (.pptx) deck free in your browser. One slide per page. No sign-up, no uploads.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PDF to PowerPoint — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Convert a PDF into a PowerPoint (.pptx) deck, one page per slide, in your browser. Slides hold a faithful image of each page.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "PDF to PowerPoint", "item": URL },
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

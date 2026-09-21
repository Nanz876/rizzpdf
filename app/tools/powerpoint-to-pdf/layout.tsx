import type { Metadata } from "next";

const TITLE = "PowerPoint to PDF Free — Convert PPTX in Your Browser | RizzPDF";
const DESCRIPTION =
  "Convert PowerPoint (.pptx) to PDF free — one page per slide, with selectable text, pictures, colours and layout preserved. Runs entirely in your browser; your deck is never uploaded.";
const URL = "https://www.rizzpdf.com/tools/powerpoint-to-pdf";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "powerpoint to pdf free",
    "powerpoint to pdf",
    "pptx to pdf",
    "convert powerpoint to pdf online",
    "ppt to pdf converter",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Turn a .pptx into a PDF with one page per slide and real, selectable text. Browser-only, no upload.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PowerPoint to PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description":
        "Convert a PowerPoint .pptx presentation to PDF in your browser: one page per slide, with selectable text, images, positions and colours re-created.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "PowerPoint to PDF", "item": URL },
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

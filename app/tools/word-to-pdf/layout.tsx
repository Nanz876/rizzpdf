import type { Metadata } from "next";

const TITLE = "Word to PDF Free — Convert DOCX to PDF in Your Browser | RizzPDF";
const DESCRIPTION =
  "Convert a Word .docx to a PDF with real, selectable text — headings, bold and italic, lists, tables, images and links are re-created. Free and private: your document never leaves your browser.";
const URL = "https://www.rizzpdf.com/tools/word-to-pdf";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "word to pdf free",
    "word to pdf",
    "docx to pdf",
    "convert word to pdf online",
    "doc to pdf converter",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description:
      "Turn a .docx into a PDF with selectable text, lists, tables, images and working links. Browser-only, no upload.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Word to PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description":
        "Convert a Word .docx into a PDF with real, selectable text, in your browser. Headings, formatting, lists, tables, images and hyperlinks are re-created; exact Word pagination is not.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Word to PDF", "item": URL },
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

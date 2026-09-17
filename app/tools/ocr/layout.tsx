import type { Metadata } from "next";

const TITLE = "OCR PDF Online Free — Make Scanned PDFs Searchable | RizzPDF";
const DESCRIPTION =
  "Free online OCR for scanned PDFs. Adds a searchable, selectable text layer to your scan and can export the plain text as .txt. Runs entirely in your browser — your file is never uploaded.";
const URL = "https://www.rizzpdf.com/tools/ocr";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "ocr pdf",
    "ocr pdf online free",
    "scanned pdf to text",
    "make scanned pdf searchable",
    "extract text from scanned pdf",
    "free ocr tool",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Turn a scanned PDF into a searchable one, or pull the plain text out of it. Browser-only, no upload.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "OCR PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description":
        "Read the text in a scanned PDF and add an invisible, searchable text layer to it, in your browser. Also exports the recognised text as a .txt file.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "OCR PDF", "item": URL },
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

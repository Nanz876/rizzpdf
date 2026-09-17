import type { Metadata } from "next";

const TITLE = "Edit PDF Text Online Free — Replace or Add Text | RizzPDF";
const DESCRIPTION =
  "Click a line of text in your PDF and type the replacement, or add a new text box. The original font is matched to the closest standard font. Free and private — your file never leaves your browser.";
const URL = "https://www.rizzpdf.com/tools/edit-text";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "edit pdf text",
    "edit pdf text online free",
    "change text in pdf",
    "replace text in pdf",
    "pdf text editor",
    "add text to pdf",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description:
      "Replace a line of text or add a new text box in your PDF. The original font is matched to the closest standard font. Browser-only, no upload.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Edit PDF Text — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description":
        "Replace a line of text or add a new text box in a PDF, in your browser. The original text is removed and redrawn in the closest standard font (Helvetica, Times or Courier).",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can I edit PDF text in the exact original font?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. PDFs usually embed only the glyphs they already use, so the letters you type may not exist in the file's font. RizzPDF removes the line you picked and redraws your text in the closest standard font — Helvetica, Times or Courier, with bold and italic variants.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I edit a scanned PDF?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A scanned page is an image with no text to click, so there is nothing to replace. You can still add new text boxes anywhere on the page.",
          },
        },
        {
          "@type": "Question",
          "name": "Is the edited file uploaded anywhere?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. All editing happens in your browser with JavaScript; the PDF never leaves your device.",
          },
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Edit PDF Text", "item": URL },
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

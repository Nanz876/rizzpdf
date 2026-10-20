import type { Metadata } from "next";

const TITLE = "PDF to Markdown Free — Convert PDF to MD Online | RizzPDF";
const DESCRIPTION =
  "Convert PDF to clean Markdown free in your browser. Headings, lists and tables are preserved — perfect for LLMs, wikis and static sites. No sign-up, no uploads.";
const URL = "https://www.rizzpdf.com/tools/pdf-to-markdown";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "pdf to markdown",
    "pdf to markdown free",
    "convert pdf to markdown online free",
    "pdf to md converter",
    "pdf to markdown for llm",
    "pdf to markdown no email",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Convert PDF to clean Markdown free in your browser. Headings, lists and tables preserved. No sign-up, no uploads.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PDF to Markdown — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Convert a PDF to Markdown, preserving headings, lists and tables, in your browser.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "PDF to Markdown", "item": URL },
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

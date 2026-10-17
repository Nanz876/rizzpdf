import type { Metadata } from "next";

const TITLE = "PDF to Excel Free — Convert PDF to XLSX Online | RizzPDF";
const DESCRIPTION =
  "Convert PDF tables to editable Excel (.xlsx) free in your browser. Columns are rebuilt and numbers, currency and percentages come through as real values. No sign-up, no uploads.";
const URL = "https://www.rizzpdf.com/tools/pdf-to-excel";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "pdf to excel",
    "pdf to excel free",
    "convert pdf to excel online free",
    "pdf to xlsx converter",
    "extract table from pdf to excel",
    "pdf to excel no email",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Convert PDF tables to editable Excel (.xlsx) free in your browser. No sign-up, no uploads.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PDF to Excel — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Convert a PDF's tables and data into an editable Excel (.xlsx) workbook, in your browser. One sheet per page; numbers stay numeric.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "PDF to Excel", "item": URL },
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

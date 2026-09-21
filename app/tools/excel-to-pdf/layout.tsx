import type { Metadata } from "next";

const TITLE = "Excel to PDF Free — Convert XLSX to PDF Online | RizzPDF";
const DESCRIPTION =
  "Convert Excel (.xlsx) to PDF free in your browser. Real selectable text, correct dates and currency formatting, wide sheets split across pages with the header and first column repeated. No sign-up, no uploads.";
const URL = "https://www.rizzpdf.com/tools/excel-to-pdf";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "excel to pdf",
    "excel to pdf free",
    "convert xlsx to pdf online free",
    "xlsx to pdf converter",
    "excel to pdf no email",
    "convert spreadsheet to pdf",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: "Convert Excel (.xlsx) to a readable PDF table free in your browser. No sign-up, no uploads.",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Excel to PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": URL,
      "description": "Convert an Excel (.xlsx) workbook into a readable PDF table, in your browser. Values and layout are re-created as a table; charts, images and pivot tables aren't carried over.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Excel to PDF", "item": URL },
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

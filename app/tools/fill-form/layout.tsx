import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fill PDF Forms Online Free — No Sign-up | RizzPDF",
  description: "Fill in PDF form fields — text, checkboxes, radio buttons and dropdowns — right in your browser. Free, no account needed, files never leave your device.",
  keywords: ["fill pdf form online free", "fill in pdf form", "pdf form filler", "edit pdf form fields", "fill pdf without software"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/fill-form" },
  openGraph: {
    title: "Fill PDF Forms Online Free | RizzPDF",
    description: "Fill in a PDF's form fields — text, checkboxes, radios and dropdowns — for free, right in your browser.",
    url: "https://www.rizzpdf.com/tools/fill-form",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Fill PDF Form — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/fill-form",
      "description": "Fill PDF form fields online for free. Text, checkboxes, radio buttons and dropdowns, filled right in your browser.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Fill PDF Form", "item": "https://www.rizzpdf.com/tools/fill-form" },
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

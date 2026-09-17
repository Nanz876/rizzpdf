import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flatten PDF Online Free — Forms & Annotations | RizzPDF",
  description: "Bake filled-in form fields and annotations permanently into a PDF's pages. Free, browser-based — no software or sign-up needed.",
  keywords: ["flatten pdf", "flatten pdf form", "flatten pdf annotations", "flatten pdf online free", "make pdf uneditable"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/flatten" },
  openGraph: {
    title: "Flatten PDF Online Free — Forms & Annotations | RizzPDF",
    description: "Flatten PDF forms and annotations instantly. Free, browser-only, no upload.",
    url: "https://www.rizzpdf.com/tools/flatten",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Flatten PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/flatten",
      "description": "Flatten PDF form fields and annotations into the page content online for free.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Flatten PDF", "item": "https://www.rizzpdf.com/tools/flatten" },
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

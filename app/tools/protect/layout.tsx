import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Password Protect PDF Online Free — Encrypt & Lock PDF | RizzPDF",
  description: "Add a password to your PDF instantly. Encrypt and lock PDF files to prevent unauthorized access — free, browser-based, your file never leaves your device.",
  keywords: ["password protect pdf", "encrypt pdf", "lock pdf with password", "pdf password protection", "secure pdf online", "add password to pdf free"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/protect" },
  openGraph: {
    title: "Password Protect PDF Online Free | RizzPDF",
    description: "Encrypt and lock your PDF with a password. Free, instant, browser-only — your file stays on your device.",
    url: "https://www.rizzpdf.com/tools/protect",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Protect PDF — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/protect",
      "description": "Add a password to your PDF online for free. Encrypt and lock PDF files to prevent unauthorized access — no file upload required.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Protect PDF", "item": "https://www.rizzpdf.com/tools/protect" },
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

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Birth Chart Calculator — Natal Chart & PDF Report | RizzPDF",
  description: "Generate a free natal birth chart. Enter a name, birth date, time, and location to see Sun, Moon, Rising signs, planets, houses, and aspects — then download a PDF report. Calculated in your browser.",
  keywords: ["birth chart calculator", "natal chart", "free astrology chart", "sun moon rising calculator", "birth chart pdf", "astrology report"],
  alternates: { canonical: "https://www.rizzpdf.com/tools/birth-chart" },
  openGraph: {
    title: "Free Birth Chart Calculator | RizzPDF",
    description: "Generate a natal chart with Sun, Moon, Rising, planets, houses, and aspects. Free, browser-only, downloadable as a PDF.",
    url: "https://www.rizzpdf.com/tools/birth-chart",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Birth Chart Calculator — RizzPDF",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "url": "https://www.rizzpdf.com/tools/birth-chart",
      "description": "Free natal birth chart calculator with a downloadable PDF report.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rizzpdf.com" },
        { "@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://www.rizzpdf.com/tools" },
        { "@type": "ListItem", "position": 3, "name": "Birth Chart Calculator", "item": "https://www.rizzpdf.com/tools/birth-chart" },
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

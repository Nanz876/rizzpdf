import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — RizzPDF | Free & Pro Plans",
  description:
    "All 26 PDF tools free with no limits. Upgrade to Pro for $5/month for unlimited batch processing, bulk CSV unlock, OCR for whole documents, and file history. Cancel any time.",
  keywords: [
    "PDF tools pricing",
    "free PDF tools",
    "RizzPDF pro",
    "PDF tool subscription",
    "cheap PDF tools",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/pricing" },
  openGraph: {
    title: "RizzPDF Pricing — Free & Pro",
    description: "All 26 PDF tools free. Upgrade only when you need more.",
    url: "https://www.rizzpdf.com/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

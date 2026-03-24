import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — RizzPDF | Free, Day Pass & Pro Plans",
  description:
    "Start free with all 16 PDF tools. Upgrade to a $1 day pass or $5/month Pro for unlimited files, 200MB uploads, and file history. No subscriptions you'll forget about.",
  keywords: [
    "PDF tools pricing",
    "free PDF tools",
    "RizzPDF pro",
    "PDF tool subscription",
    "cheap PDF tools",
  ],
  alternates: { canonical: "https://rizzpdf.com/pricing" },
  openGraph: {
    title: "RizzPDF Pricing — Free, Day Pass & Pro",
    description: "All 16 PDF tools free. Upgrade only when you need more.",
    url: "https://rizzpdf.com/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Online PDF Tools — Merge, Split, Compress & More | RizzPDF",
  description: "14 free online PDF tools: merge, split, compress, rotate, convert PDF to JPG, sign, watermark, add page numbers, and more. Browser-based — files never leave your device.",
  keywords: ["pdf tools online free", "pdf editor online", "merge pdf", "split pdf", "compress pdf", "pdf converter"],
  alternates: { canonical: "https://www.rizzpdf.com/tools" },
  openGraph: {
    type: "website",
    url: "https://www.rizzpdf.com/tools",
    siteName: "RizzPDF",
    title: "Free Online PDF Tools | RizzPDF",
    description: "14 free browser-based PDF tools. No upload, no account, no software.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Online PDF Tools | RizzPDF",
    description: "14 free browser-based PDF tools. No upload, no account, no software.",
  },
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

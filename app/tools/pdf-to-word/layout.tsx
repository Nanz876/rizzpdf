import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Word Converter — Free, No Email Required",
  description:
    "Convert PDF to editable Word (.docx) documents free in your browser. No sign-up, no file uploads. Extract text from any PDF instantly.",
  keywords: [
    "PDF to Word",
    "convert PDF to Word online free",
    "PDF to docx converter",
    "PDF to Word no email",
    "free PDF to Word converter",
    "convert PDF to editable Word",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/tools/pdf-to-word" },
  openGraph: {
    title: "PDF to Word Converter — Free, No Email Required",
    description: "Convert PDF to editable Word (.docx) free in your browser. No sign-up, no uploads.",
    url: "https://www.rizzpdf.com/tools/pdf-to-word",
  },
};

export default function PdfToWordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

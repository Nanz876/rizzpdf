import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RizzPDF — Unlock PDF Passwords Instantly",
  description: "Remove PDF password protection instantly. Free for up to 3 files. No account needed. Files never leave your browser.",
  keywords: ["PDF unlock", "remove PDF password", "PDF unlocker", "free PDF tool"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-white text-gray-900`}>
        {children}
      </body>
    </html>
  );
}

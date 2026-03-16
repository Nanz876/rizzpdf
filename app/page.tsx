// app/page.tsx
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "RizzPDF",
      "url": "https://www.rizzpdf.com",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "description": "Free browser-based PDF toolkit. Merge, split, compress, unlock, rotate and convert PDFs. Files never leave your browser.",
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is RizzPDF free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes! All tools are free. Files are processed entirely in your browser." }
        },
        {
          "@type": "Question",
          "name": "Is it safe to use RizzPDF?",
          "acceptedAnswer": { "@type": "Answer", "text": "100% safe. All PDF processing happens inside your browser — your files are never uploaded to any server." }
        }
      ]
    }
  ]
};

const CATEGORIES = ["All", "Organize PDF", "Convert PDF", "Edit PDF", "PDF Security"] as const;
type Category = typeof CATEGORIES[number];

const PDF_TOOLS: {
  name: string;
  href: string;
  emoji: string;
  iconBg: string;
  description: string;
  categories: Category[];
}[] = [
  {
    name: "Unlock PDF",
    href: "/",
    emoji: "🔓",
    iconBg: "#EDE9FE",
    description: "Remove PDF password protection instantly.",
    categories: ["PDF Security"],
  },
  {
    name: "Merge PDF",
    href: "/tools/merge",
    emoji: "🔗",
    iconBg: "#FDECEA",
    description: "Combine multiple PDFs into one file.",
    categories: ["Organize PDF"],
  },
  {
    name: "Split PDF",
    href: "/tools/split",
    emoji: "✂️",
    iconBg: "#FDECEA",
    description: "Separate pages into individual PDF files.",
    categories: ["Organize PDF"],
  },
  {
    name: "Compress PDF",
    href: "/tools/compress",
    emoji: "📦",
    iconBg: "#E8F5E9",
    description: "Reduce file size while keeping quality.",
    categories: ["Organize PDF"],
  },
  {
    name: "Rotate PDF",
    href: "/tools/rotate",
    emoji: "🔄",
    iconBg: "#E3F2FD",
    description: "Rotate pages to the correct orientation.",
    categories: ["Organize PDF"],
  },
  {
    name: "PDF to JPG",
    href: "/tools/pdf-to-jpg",
    emoji: "🖼️",
    iconBg: "#FEF9C3",
    description: "Convert each PDF page to a JPG image.",
    categories: ["Convert PDF"],
  },
  {
    name: "JPG to PDF",
    href: "/tools/jpg-to-pdf",
    emoji: "📄",
    iconBg: "#FEF9C3",
    description: "Turn JPG images into a PDF document.",
    categories: ["Convert PDF"],
  },
  {
    name: "PDF to PNG",
    href: "/tools/pdf-to-png",
    emoji: "🎨",
    iconBg: "#F0FDF4",
    description: "Convert PDF pages to high-quality PNG images.",
    categories: ["Convert PDF"],
  },
  {
    name: "Watermark PDF",
    href: "/tools/watermark",
    emoji: "💧",
    iconBg: "#E0F7FA",
    description: "Stamp text watermarks onto your PDF.",
    categories: ["Edit PDF"],
  },
  {
    name: "Organize PDF",
    href: "/tools/organize",
    emoji: "🗂️",
    iconBg: "#FFF3E0",
    description: "Reorder, add or remove pages visually.",
    categories: ["Organize PDF"],
  },
  {
    name: "Page Numbers",
    href: "/tools/page-numbers",
    emoji: "🔢",
    iconBg: "#E3F2FD",
    description: "Add page numbers with custom position and style.",
    categories: ["Organize PDF", "Edit PDF"],
  },
  {
    name: "Sign PDF",
    href: "/tools/sign",
    emoji: "✍️",
    iconBg: "#EEF2FF",
    description: "Draw or upload a signature onto your PDF.",
    categories: ["Edit PDF"],
  },
  {
    name: "Delete Pages",
    href: "/tools/delete-pages",
    emoji: "🗑️",
    iconBg: "#FEE2E2",
    description: "Remove unwanted pages from a PDF.",
    categories: ["Organize PDF"],
  },
  {
    name: "Repair PDF",
    href: "/tools/repair",
    emoji: "🔧",
    iconBg: "#F3F4F6",
    description: "Fix corrupted or damaged PDF files.",
    categories: ["PDF Security"],
  },
];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filteredTools =
    activeCategory === "All"
      ? PDF_TOOLS
      : PDF_TOOLS.filter((t) => t.categories.includes(activeCategory));

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F7FF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
            Your PDF toolkit
          </h1>
          <p className="text-gray-500 text-base">
            Free, private, browser-based. Files never leave your device.
          </p>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-purple-700 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTools.map((tool) => (
            <a
              key={tool.href + tool.name}
              href={tool.href}
              className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col gap-3"
            >
              {/* Colored icon square */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: tool.iconBg }}
              >
                {tool.emoji}
              </div>
              {/* Text */}
              <div>
                <p className="font-bold text-[14px] text-gray-900 group-hover:text-purple-700 transition-colors">
                  {tool.name}
                </p>
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

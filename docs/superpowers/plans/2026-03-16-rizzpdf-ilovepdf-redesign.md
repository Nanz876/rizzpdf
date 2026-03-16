# RizzPDF iLovePDF Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RizzPDF's hero-first homepage and navbar with an iLovePDF-inspired tool-grid-first layout, keeping the purple/pink brand identity and all existing functionality.

**Architecture:** Four surgical file changes — new Footer component, rewritten Navbar, rewritten homepage, minor ToolShell bg update. All PDF tool logic, API routes, and payment code remain untouched.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Clerk auth

**Dev server:** `cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && npm run dev -- --port 3001`
**App URL:** http://localhost:3001

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/Footer.tsx` | **Create** | Dark multi-column footer with 4 link columns |
| `components/Navbar.tsx` | **Rewrite** | iLovePDF-style: ALL CAPS tool links, user/grid icons |
| `app/page.tsx` | **Rewrite** | Tool-grid homepage with category filter pills |
| `components/ToolShell.tsx` | **Edit** | Change bg from `bg-gray-50` → `bg-[#F9F7FF]` |

---

## Chunk 1: Footer Component + Navbar

### Task 1: Create `components/Footer.tsx`

**Files:**
- Create: `components/Footer.tsx`

- [ ] **Step 1: Create the Footer component**

```tsx
// components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#1a1a2e] text-gray-400 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Product</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/tools" className="hover:text-white transition-colors">All Tools</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Tools</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tools/merge" className="hover:text-white transition-colors">Merge PDF</Link></li>
              <li><Link href="/tools/split" className="hover:text-white transition-colors">Split PDF</Link></li>
              <li><Link href="/tools/compress" className="hover:text-white transition-colors">Compress PDF</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Unlock PDF</Link></li>
              <li><Link href="/tools/rotate" className="hover:text-white transition-colors">Rotate PDF</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Legal</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-bold text-sm uppercase tracking-widest mb-4">Company</p>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:support@rizzpdf.com" className="hover:text-white transition-colors">Support</a></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-lg font-black">
            Rizz<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">PDF</span>
          </p>
          <p className="text-sm">© {new Date().getFullYear()} RizzPDF. All processing happens in your browser.</p>
          <div className="flex gap-4">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">Twitter</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-sm">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify dev server shows no errors**

Run: `cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && npm run build 2>&1 | tail -20`
Expected: Output ends with `✓ Compiled successfully` or `Route (app)` table listing routes. Zero TypeScript errors. Zero `Type error:` lines.

---

### Task 2: Rewrite `components/Navbar.tsx`

**Files:**
- Modify: `components/Navbar.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Navbar to iLovePDF style**

```tsx
// components/Navbar.tsx
"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav className="w-full border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">

        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            RizzPDF
          </span>
        </Link>

        {/* Primary nav links — ALL CAPS */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          <Link
            href="/tools/merge"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            Merge PDF
          </Link>
          <Link
            href="/tools/split"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            Split PDF
          </Link>
          <Link
            href="/tools/compress"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            Compress PDF
          </Link>
          <Link
            href="/tools"
            className="text-[13px] font-bold uppercase tracking-wide text-gray-700 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            All PDF Tools ▾
          </Link>
        </div>

        {/* Right side auth */}
        <div className="ml-auto flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block text-[13px] font-semibold text-gray-600 hover:text-purple-600 transition-colors"
              >
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden sm:block text-[13px] font-semibold text-gray-600 border border-gray-300 px-4 py-1.5 rounded-full hover:border-purple-400 hover:text-purple-600 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-[13px] font-bold bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Build check**

Run: `cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && npm run build 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && git add components/Footer.tsx components/Navbar.tsx && git commit -m "feat: iLovePDF-style navbar + dark footer component"
```

---

## Chunk 2: Homepage Rewrite

### Task 3: Rewrite `app/page.tsx`

**Files:**
- Modify: `app/page.tsx` (full rewrite)

This is the biggest change. The new homepage:
- Uses `bg-[#F9F7FF]` background
- Has a short centered heading + subtitle
- Has category filter pills (client-side JS filter)
- Shows a 4-column tool grid with colored icon cards
- Uses the new `Footer` component
- Preserves `PaywallModal` and all existing paywall/file state logic (moved to `app/unlock/page.tsx` eventually — but for now, the unlock logic is removed from homepage entirely since Unlock PDF is just a card linking to `/`)

**Note:** The Unlock PDF tool currently lives at `/` (the homepage). The new homepage is a tool grid. `Unlock PDF` card links to `/` — but clicking it will just reload the homepage. That's acceptable for now; a future task can move the unlock tool to `/tools/unlock`. For this task, just link it to `/` as before.

- [ ] **Step 1: Write the new homepage**

> ⚠️ **Important:** File must start with `"use client"` — uses `useState` for category filter.
> ⚠️ **Important:** The existing inline `<footer>` in the old `page.tsx` is replaced by `<Footer />` — do NOT keep both.
> ⚠️ **Important:** JSON-LD structured data from the original homepage is preserved below for SEO.

```tsx
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
```

- [ ] **Step 2: Build check — confirm no TS errors**

Run: `cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && npm run build 2>&1 | tail -30`
Expected: Build succeeds, 0 errors

- [ ] **Step 3: Visual check on dev server**

Visit http://localhost:3001 — confirm:
- [ ] Tool grid displays with 14 cards
- [ ] Category pills filter correctly (click "Convert PDF" → shows 3 tools)
- [ ] Cards show colored icon square + name + description
- [ ] Navbar shows ALL CAPS links
- [ ] Dark footer renders at bottom
- [ ] No console errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && git add app/page.tsx && git commit -m "feat: replace hero homepage with iLovePDF-style tool grid"
```

---

## Chunk 3: ToolShell + Final Polish

### Task 4: Update `components/ToolShell.tsx` background

**Files:**
- Modify: `components/ToolShell.tsx` — one line change

- [ ] **Step 1: Change bg class**

In `components/ToolShell.tsx`, find line:
```tsx
<div className="min-h-screen bg-gray-50">
```
Replace with:
```tsx
<div className="min-h-screen bg-[#F9F7FF]">
```

- [ ] **Step 2: Also swap Footer in ToolShell**

The ToolShell currently has no footer. Add Footer import and render it after `</main>`:

```tsx
// Add import at top:
import Footer from "./Footer";

// Add before closing </div>:
<Footer />
```

Final ToolShell structure:
```tsx
"use client";

import Link from "next/link";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface ToolShellProps {
  name: string;
  description: string;
  icon: string;
  children: React.ReactNode;
}

export default function ToolShell({ name, description, icon, children }: ToolShellProps) {
  return (
    <div className="min-h-screen bg-[#F9F7FF] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        {/* Breadcrumb — flex-1 on main ensures footer is pushed to bottom */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Link href="/" className="hover:text-purple-600 transition-colors">Home</Link>
          <span>›</span>
          <Link href="/tools" className="hover:text-purple-600 transition-colors">PDF Tools</Link>
          <span>›</span>
          <span className="text-gray-600 font-medium">{name}</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">{icon}</div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">{name}</h1>
          <p className="text-gray-500 text-lg">{description}</p>
          <p className="text-xs text-gray-400 mt-2">🔒 Files never leave your browser</p>
        </div>

        {/* Tool content */}
        {children}

        {/* Footer: Other tools */}
        <div className="mt-16 border-t border-gray-200 pt-10">
          <p className="text-center text-sm text-gray-400 mb-5">More PDF tools</p>
          <div className="flex flex-wrap justify-center gap-3">
            {OTHER_TOOLS.filter(t => t.name !== name).slice(0, 6).map(t => (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-full px-4 py-2 hover:border-purple-400 hover:text-purple-600 transition-colors"
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </Link>
            ))}
            <Link
              href="/tools"
              className="text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-4 py-2 hover:bg-purple-100 transition-colors font-medium"
            >
              All tools →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

const OTHER_TOOLS = [
  { name: "Unlock PDF", href: "/", icon: "🔓" },
  { name: "Merge PDF", href: "/tools/merge", icon: "🔗" },
  { name: "Split PDF", href: "/tools/split", icon: "✂️" },
  { name: "Compress PDF", href: "/tools/compress", icon: "📦" },
  { name: "Rotate PDF", href: "/tools/rotate", icon: "🔄" },
  { name: "PDF to JPG", href: "/tools/pdf-to-jpg", icon: "🖼️" },
  { name: "JPG to PDF", href: "/tools/jpg-to-pdf", icon: "📄" },
  { name: "Watermark PDF", href: "/tools/watermark", icon: "💧" },
  { name: "Organize PDF", href: "/tools/organize", icon: "🗂️" },
  { name: "Page Numbers", href: "/tools/page-numbers", icon: "🔢" },
  { name: "Sign PDF", href: "/tools/sign", icon: "✍️" },
  { name: "Delete Pages", href: "/tools/delete-pages", icon: "🗑️" },
  { name: "PDF to PNG", href: "/tools/pdf-to-png", icon: "🎨" },
  { name: "Repair PDF", href: "/tools/repair", icon: "🔧" },
];
```

- [ ] **Step 3: Build check**

Run: `cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Visual check — spot-check one tool page**

Visit http://localhost:3001/tools/merge — confirm:
- [ ] Background is light purple-white (not gray)
- [ ] Dark footer appears at bottom
- [ ] Navbar ALL CAPS links visible

- [ ] **Step 5: Final commit**

```bash
cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && git add components/ToolShell.tsx && git commit -m "feat: update ToolShell bg + add footer to tool pages"
```

---

## Chunk 4: Deploy

### Task 5: Deploy to Vercel

- [ ] **Step 1: Push to main**

```bash
cd "C:/Users/kael_/OneDrive/Desktop/rizzpdf-app" && git push origin main
```

- [ ] **Step 2: Confirm Vercel deploy**

Check https://vercel.com for the deployment status. Wait for green.

- [ ] **Step 3: Smoke test production**

Visit https://www.rizzpdf.com and confirm:
- [ ] Tool grid loads
- [ ] Category filter pills work
- [ ] Navbar links correct
- [ ] Footer visible
- [ ] At least 2 tool pages load correctly (click Merge PDF and Split PDF from the grid)

---

## Notes for Implementor

- **Unlock PDF tool** currently lives at `/`. The new homepage is also `/`. The Unlock PDF card links to `/` which reloads the homepage — this is intentional for now. Moving it to `/tools/unlock` is a separate future task.
- **PaywallModal, UploadZone, FileCard** — all existing code is preserved but not rendered on the new homepage. Do not delete any of these files.
- **Stripe/payment code** in `app/api/` — completely untouched.
- **`app/tools/page.tsx`** — the existing tools listing page is untouched; the new homepage effectively replaces it as the primary tool discovery surface.

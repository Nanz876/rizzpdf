# RizzPDF Full UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild RizzPDF's visual design to match iLovePDF's quality — red brand, modern tool hub cards, and interactive PDF thumbnail workspaces for every tool.

**Architecture:** Three phases — shared UI components first, then brand shell (navbar/cards/ToolShell), then tool-specific workspace UIs. All tools share a `WorkspaceBar` + `ThumbnailGrid` built on the existing `renderThumbnails` function in `lib/pdf-tools.ts`. No PDF processing logic changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, pdfjs-dist (already in use via `renderThumbnails`), pdf-lib (no changes), TypeScript.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `components/pdf/WorkspaceBar.tsx` | Top toolbar shown after file upload (filename, action buttons) |
| `components/pdf/ThumbnailGrid.tsx` | Reusable page thumbnail grid with optional checkboxes, rotation badges, drag handles |
| `components/pdf/SidebarWorkspace.tsx` | Two-panel layout: left options sidebar + right content area |

### Modified files
| File | Change |
|---|---|
| `components/Navbar.tsx` | Logo split, all purple→red |
| `components/ToolShell.tsx` | New banner layout + step indicators |
| `components/UploadZone.tsx` | Red color scheme |
| `app/page.tsx` | New card grid + category filter + SVG icons |
| `app/tools/page.tsx` | Same card grid as home |
| `app/globals.css` | pulse-border color |
| `app/tools/rotate/page.tsx` | Thumbnail grid + per-page rotate buttons |
| `app/tools/delete-pages/page.tsx` | Thumbnail grid + click-to-select checkboxes |
| `app/tools/organize/page.tsx` | WorkspaceBar + styled ThumbnailGrid (logic already exists) |
| `app/tools/split/page.tsx` | Sidebar options + page strip with split markers |
| `app/tools/compress/page.tsx` | File info card + 3-option compression cards |
| `app/tools/watermark/page.tsx` | Sidebar options + live PDF preview |
| `app/tools/page-numbers/page.tsx` | Sidebar options + live PDF preview |
| `app/tools/merge/page.tsx` | Multi-file thumbnail grid |
| `app/tools/pdf-to-jpg/page.tsx` | Thumbnail grid with page selection |
| `app/tools/pdf-to-png/page.tsx` | Thumbnail grid with page selection |
| `app/tools/jpg-to-pdf/page.tsx` | Image preview grid |
| `app/tools/repair/page.tsx` | File info card + action |
| `app/tools/sign/page.tsx` | purple→red color pass only (already rebuilt) |

---

## Task 1: WorkspaceBar Component

**Files:**
- Create: `components/pdf/WorkspaceBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/pdf/WorkspaceBar.tsx
"use client";
import React from "react";

interface WorkspaceBarProps {
  icon: React.ReactNode;           // SVG element, shown in 32px red box
  title: string;                   // Tool name
  subtitle?: string;               // e.g. "contract.pdf · 4 pages"
  onReset?: () => void;            // "✕ Remove" button
  primaryLabel: string;            // e.g. "Rotate PDF →"
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;         // optional second action
  onSecondary?: () => void;
  children?: React.ReactNode;      // extra toolbar controls between subtitle and buttons
}

export default function WorkspaceBar({
  icon, title, subtitle, onReset, primaryLabel, onPrimary,
  primaryDisabled, secondaryLabel, onSecondary, children,
}: WorkspaceBarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 leading-none">{title}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
        {children && <div className="flex items-center gap-2 ml-2">{children}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onReset && (
          <button onClick={onReset} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors">
            ✕ Remove
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button onClick={onSecondary} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            {secondaryLabel}
          </button>
        )}
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-40 transition-colors"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add components/pdf/WorkspaceBar.tsx
git commit -m "feat: add WorkspaceBar component for tool post-upload header"
```

---

## Task 2: ThumbnailGrid Component

**Files:**
- Create: `components/pdf/ThumbnailGrid.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/pdf/ThumbnailGrid.tsx
"use client";
import React from "react";

export interface ThumbnailPage {
  dataUrl: string;
  pageNumber: number;        // 1-based
  label?: string;            // override label (e.g. "90°")
  labelColor?: string;       // e.g. "bg-red-600"
}

interface ThumbnailGridProps {
  pages: ThumbnailPage[];
  selectedPages?: Set<number>;         // 1-based page numbers that are "selected" (checked)
  onToggleSelect?: (page: number) => void;
  onRotateLeft?: (page: number) => void;
  onRotateRight?: (page: number) => void;
  onDelete?: (page: number) => void;
  draggable?: boolean;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDrop?: (index: number) => void;
  dragOverIndex?: number | null;
  showCheckboxes?: boolean;
  showRotateButtons?: boolean;
  columns?: 3 | 4 | 5;
}

export default function ThumbnailGrid({
  pages, selectedPages, onToggleSelect, onRotateLeft, onRotateRight,
  onDelete, draggable, onDragStart, onDragOver, onDrop, dragOverIndex,
  showCheckboxes, showRotateButtons, columns = 4,
}: ThumbnailGridProps) {
  const colClass = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[columns];

  return (
    <div className={`grid ${colClass} gap-3`}>
      {pages.map((pg, idx) => {
        const selected = selectedPages?.has(pg.pageNumber) ?? false;
        const isDragOver = dragOverIndex === idx;
        return (
          <div
            key={pg.pageNumber}
            className={`relative bg-white rounded-xl overflow-hidden shadow-sm border-2 transition-all cursor-default
              ${selected ? "border-red-500 bg-red-50" : "border-gray-100 hover:border-gray-300"}
              ${isDragOver ? "border-red-400 scale-105" : ""}
              ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
            `}
            draggable={draggable}
            onDragStart={() => onDragStart?.(idx)}
            onDragOver={(e) => { e.preventDefault(); onDragOver?.(idx); }}
            onDrop={() => onDrop?.(idx)}
          >
            {/* Checkbox */}
            {showCheckboxes && onToggleSelect && (
              <button
                onClick={() => onToggleSelect(pg.pageNumber)}
                className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center z-10 transition-colors
                  ${selected ? "bg-red-600 border-red-600" : "bg-white border-gray-300 hover:border-red-400"}`}
              >
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            )}

            {/* Page label badge */}
            {pg.label && (
              <div className={`absolute top-2 left-2 ${pg.labelColor ?? "bg-red-600"} text-white text-xs font-bold px-1.5 py-0.5 rounded z-10`}>
                {pg.label}
              </div>
            )}

            {/* Thumbnail image */}
            <div className="aspect-[3/4] relative overflow-hidden bg-gray-50">
              <img
                src={pg.dataUrl}
                alt={`Page ${pg.pageNumber}`}
                draggable={false}
                className="w-full h-full object-contain"
              />

              {/* Rotate hover buttons */}
              {showRotateButtons && (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                  {onRotateLeft && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRotateLeft(pg.pageNumber); }}
                      className="w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Rotate left"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                        <path d="M4 12a8 8 0 108-8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                        <path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                  {onRotateRight && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRotateRight(pg.pageNumber); }}
                      className="w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Rotate right"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                        <path d="M20 12a8 8 0 11-8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                        <path d="M12 4V8M12 8l3-3m-3 3l-3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className={`text-xs font-semibold ${selected ? "text-red-600" : "text-gray-500"}`}>
                Page {pg.pageNumber}
              </span>
              {onDelete && (
                <button
                  onClick={() => onDelete(pg.pageNumber)}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                >✕</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add components/pdf/ThumbnailGrid.tsx
git commit -m "feat: add ThumbnailGrid component for PDF page previews"
```

---

## Task 3: SidebarWorkspace Component

**Files:**
- Create: `components/pdf/SidebarWorkspace.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/pdf/SidebarWorkspace.tsx
import React from "react";

interface SidebarWorkspaceProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: string;
}

export default function SidebarWorkspace({
  sidebar, children, sidebarWidth = "w-56",
}: SidebarWorkspaceProps) {
  return (
    <div className="flex min-h-[360px] bg-gray-100 rounded-b-2xl overflow-hidden">
      <div className={`${sidebarWidth} bg-white border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto`}>
        {sidebar}
      </div>
      <div className="flex-1 p-5 overflow-auto">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add components/pdf/SidebarWorkspace.tsx
git commit -m "feat: add SidebarWorkspace layout component"
```

---

## Task 4: Brand Shell — Navbar + UploadZone + globals.css

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: `components/UploadZone.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update Navbar logo and colors**

In `components/Navbar.tsx`, replace the logo span (line ~16):
```tsx
// OLD:
<span className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">RizzPDF</span>

// NEW:
<span className="text-xl font-black"><span className="text-gray-900">Rizz</span><span className="text-red-600">PDF</span></span>
```

Replace all remaining purple/pink class names in Navbar.tsx:
- `hover:text-purple-600` → `hover:text-red-600`
- `hover:border-purple-400` → `hover:border-red-400`
- `from-purple-600 to-pink-500` (sign up button gradient) → remove gradient, use `bg-red-600 hover:bg-red-700`

- [ ] **Step 2: Update UploadZone**

In `components/UploadZone.tsx`, replace:
- Upload icon background gradient → `bg-red-600`
- `border-purple-500` → `border-red-500`
- `bg-purple-50` → `bg-red-50`
- Any `purple` class → `red` equivalent

- [ ] **Step 3: Update pulse-border keyframe in globals.css**

```css
/* Replace: */
@keyframes pulse-border {
  0%, 100% { border-color: #a855f7; }
  50% { border-color: #ec4899; }
}

/* With: */
@keyframes pulse-border {
  0%, 100% { border-color: #dc2626; }
  50% { border-color: #f97316; }
}
```

- [ ] **Step 4: Commit**
```bash
git add components/Navbar.tsx components/UploadZone.tsx app/globals.css
git commit -m "feat: rebrand navbar and upload zone to red color scheme"
```

---

## Task 5: ToolShell Redesign

**Files:**
- Modify: `components/ToolShell.tsx`

- [ ] **Step 1: Rewrite ToolShell with new banner + optional step indicators**

```tsx
// components/ToolShell.tsx
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import React from "react";

const MORE_TOOLS = [
  { name: "Merge PDF", href: "/tools/merge" },
  { name: "Split PDF", href: "/tools/split" },
  { name: "Compress PDF", href: "/tools/compress" },
  { name: "Rotate PDF", href: "/tools/rotate" },
  { name: "Sign PDF", href: "/tools/sign" },
  { name: "Watermark PDF", href: "/tools/watermark" },
];

interface ToolShellProps {
  name: string;
  description: string;
  icon: string;
  svgIcon?: React.ReactNode;
  steps?: [string, string, string];
  children: React.ReactNode;
}

export default function ToolShell({ name, description, icon, svgIcon, steps, children }: ToolShellProps) {
  const defaultIcon = (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
      <rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.8"/>
      <path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Breadcrumb */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-red-600 transition-colors">Home</Link>
          <span>›</span>
          <Link href="/tools" className="hover:text-red-600 transition-colors">PDF Tools</Link>
          <span>›</span>
          <span className="text-gray-600 font-medium">{name}</span>
        </div>
      </div>

      {/* Tool banner */}
      <div className="bg-gradient-to-r from-red-50 to-white border-b border-red-100">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              {svgIcon ?? defaultIcon}
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">{name}</h1>
              <p className="text-sm text-gray-500 mt-1 max-w-md">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 self-start flex-shrink-0">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="#16a34a" strokeWidth="2"/>
              <path d="M8 11V7a4 4 0 018 0v4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-semibold text-green-700">Files stay in your browser</span>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5">
          {/* Step indicators */}
          {steps && (
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
              {steps.map((label, i) => (
                <div key={i} className={`flex-1 flex items-center gap-2.5 px-4 py-3 ${i < steps.length - 1 ? "border-r border-gray-200" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-xs font-black text-red-600 flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs text-gray-500 leading-snug">{label}</span>
                </div>
              ))}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* More tools */}
      <div className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">More PDF tools</p>
          <div className="flex flex-wrap gap-2">
            {MORE_TOOLS.filter(t => t.name !== name).map(t => (
              <Link key={t.href} href={t.href}
                className="px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:border-red-400 hover:text-red-600 transition-colors">
                {t.name}
              </Link>
            ))}
            <Link href="/tools" className="px-4 py-2 text-sm text-red-600 font-semibold hover:underline">
              All tools →
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add components/ToolShell.tsx
git commit -m "feat: redesign ToolShell with red banner, privacy badge, step indicators"
```

---

## Task 6: Home Page + Tools Hub — Cards, Filter, SVG Icons

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/tools/page.tsx`

The tool data (name, route, category, icon color, SVG) is defined once and shared. Since both pages use the same grid, define the tool list in a shared constant at the top of each file (no need for a separate file — YAGNI).

- [ ] **Step 1: Define the shared tool list and SVG icons**

Add this constant near the top of both `app/page.tsx` and `app/tools/page.tsx`:

```tsx
const TOOLS = [
  {
    name: "Merge PDF", route: "/tools/merge", category: "Organize PDF",
    desc: "Combine multiple PDFs into one",
    iconBg: "#fef2f2",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 6h7v12H4V6z" fill="#fca5a5"/><path d="M13 6h7v12h-7V6z" fill="#ef4444"/><path d="M10 12h4" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Split PDF", route: "/tools/split", category: "Organize PDF",
    desc: "Split a PDF into multiple files",
    iconBg: "#fff7ed",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5"/><path d="M12 4v16M4 12h16" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/></svg>,
  },
  {
    name: "Compress PDF", route: "/tools/compress", category: "Organize PDF",
    desc: "Reduce PDF file size",
    iconBg: "#f0fdf4",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 20l-8-4V8l8-4 8 4v8l-8 4z" fill="#bbf7d0" stroke="#22c55e" strokeWidth="1.5"/><path d="M12 12l8-4M12 12v8M12 12L4 8" stroke="#22c55e" strokeWidth="1.5"/></svg>,
  },
  {
    name: "Rotate PDF", route: "/tools/rotate", category: "Organize PDF",
    desc: "Rotate pages in any direction",
    iconBg: "#fef2f2",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    name: "PDF to JPG", route: "/tools/pdf-to-jpg", category: "Convert PDF",
    desc: "Convert PDF pages to JPG images",
    iconBg: "#eff6ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/><path d="M8 7h8M8 10h8M8 13h5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 17l2-2 2 2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "JPG to PDF", route: "/tools/jpg-to-pdf", category: "Convert PDF",
    desc: "Convert images to a PDF file",
    iconBg: "#eff6ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="2" fill="#3b82f6" opacity=".4"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    name: "PDF to PNG", route: "/tools/pdf-to-png", category: "Convert PDF",
    desc: "Export PDF pages as PNG images",
    iconBg: "#f0fdfa",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#99f6e4" stroke="#14b8a6" strokeWidth="1.5"/><circle cx="9" cy="9" r="2" fill="#14b8a6" opacity=".4"/><path d="M4 16l4-4 3 3 2-2 4 4" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    name: "Watermark PDF", route: "/tools/watermark", category: "Edit PDF",
    desc: "Add text watermarks to your PDF",
    iconBg: "#fff0f9",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1.5"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/><path d="M10 14l2-4 2 4M11 13h2" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Organize PDF", route: "/tools/organize", category: "Organize PDF",
    desc: "Reorder or remove pages visually",
    iconBg: "#fefce8",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="#fef08a" stroke="#eab308" strokeWidth="1.5"/></svg>,
  },
  {
    name: "Page Numbers", route: "/tools/page-numbers", category: "Edit PDF",
    desc: "Add page numbers to your PDF",
    iconBg: "#f0fdfa",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#99f6e4" stroke="#14b8a6" strokeWidth="1.5"/><path d="M8 8h8M8 12h6" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="17" r="2.5" fill="#14b8a6" opacity=".3" stroke="#14b8a6" strokeWidth="1.2"/><path d="M12 16v2" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  {
    name: "Sign PDF", route: "/tools/sign", category: "Edit PDF",
    desc: "Draw or upload your signature",
    iconBg: "#fdf4ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" fill="#e9d5ff" stroke="#a855f7" strokeWidth="1.5"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 20h8" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    name: "Delete Pages", route: "/tools/delete-pages", category: "Organize PDF",
    desc: "Remove specific pages from a PDF",
    iconBg: "#fff7ed",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5"/><path d="M9 9l6 6M15 9l-6 6" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    name: "Repair PDF", route: "/tools/repair", category: "PDF Security",
    desc: "Fix corrupted or damaged PDFs",
    iconBg: "#f5f3ff",
    svg: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 4l1.4 4.2H18l-3.7 2.7 1.4 4.2L12 12.4l-3.7 2.7 1.4-4.2L6 8.2h4.6L12 4z" fill="#ddd6fe" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  },
];

const CATEGORIES = ["All", "Organize PDF", "Convert PDF", "Edit PDF", "PDF Security"];
```

- [ ] **Step 2: Rewrite the tool grid section of `app/page.tsx`**

Replace the tool grid and add category filtering. The page needs `"use client"` if it doesn't already have it. Add state for active category:

```tsx
"use client";
import { useState } from "react";
// ... existing imports ...

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const filtered = activeCategory === "All" ? TOOLS : TOOLS.filter(t => t.category === activeCategory);

  return (
    // ... keep existing page structure ...
    // Replace tool grid section with:
    <>
      {/* Category pills */}
      <div className="flex flex-wrap gap-2 justify-center my-6">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors
              ${activeCategory === cat
                ? "bg-red-600 text-white border-red-600"
                : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map(tool => (
          <a key={tool.route} href={tool.route}
            className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm hover:border-red-400 hover:shadow-md transition-all group">
            <div className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center" style={{ background: tool.iconBg }}>
              {tool.svg}
            </div>
            <div className="text-sm font-bold text-gray-900 mt-3 leading-tight">{tool.name}</div>
            <div className="text-xs text-gray-400 mt-1 leading-snug">{tool.desc}</div>
          </a>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Apply the same grid to `app/tools/page.tsx`** (same TOOLS constant + same grid, no unlock tool)

- [ ] **Step 4: Commit**
```bash
git add app/page.tsx app/tools/page.tsx
git commit -m "feat: new tool hub cards with SVG icons, category filter, red accent"
```

---

## Task 7: Bulk Purple→Red Replace Across Tool Pages

**Files:**
- Modify: all `app/tools/*/page.tsx` files (13 files)

- [ ] **Step 1: Run sed replace across all tool pages**
```bash
cd /c/Users/kael_/rizzpdf-app
find app/tools -name "page.tsx" | xargs sed -i \
  -e 's/bg-purple-600/bg-red-600/g' \
  -e 's/bg-purple-700/bg-red-700/g' \
  -e 's/hover:bg-purple-700/hover:bg-red-700/g' \
  -e 's/hover:border-purple-400/hover:border-red-400/g' \
  -e 's/focus:border-purple-400/focus:border-red-400/g' \
  -e 's/hover:text-purple-600/hover:text-red-600/g' \
  -e 's/text-purple-600/text-red-600/g' \
  -e 's/border-purple-400/border-red-400/g' \
  -e 's/border-purple-200/border-red-200/g' \
  -e 's/accent-purple-600/accent-red-600/g' \
  -e 's/bg-purple-50/bg-red-50/g'
```

- [ ] **Step 2: Verify no purple remains**
```bash
grep -r "purple" app/tools --include="*.tsx"
# Should return empty or only intentional purple (Sign PDF uses purple for the signature tool icon itself — that's OK)
```

- [ ] **Step 3: Commit**
```bash
git add app/tools
git commit -m "feat: replace purple→red across all tool pages"
```

---

## Task 8: Rotate PDF — Thumbnail Grid with Per-Page Rotation

**Files:**
- Modify: `app/tools/rotate/page.tsx`

- [ ] **Step 1: Rewrite rotate page**

Replace the entire page with thumbnail-based UI. Key state: `rotations: Record<number, number>` (page → cumulative rotation in degrees).

```tsx
"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import { renderThumbnails, rotatePDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function RotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});  // pageNum→degrees
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading"); setRotations({});
    const t = await renderThumbnails(files[0], 0.4);
    setThumbs(t); setStatus("ready");
  }, []);

  const rotate = (pageNum: number, delta: number) =>
    setRotations(r => ({ ...r, [pageNum]: ((r[pageNum] ?? 0) + delta + 360) % 360 }));

  const rotateAll = (delta: number) =>
    setRotations(r => Object.fromEntries(thumbs.map((_, i) => [i + 1, ((r[i + 1] ?? 0) + delta + 360) % 360])));

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({
    dataUrl: url,
    pageNumber: i + 1,
    label: rotations[i + 1] ? `${rotations[i + 1]}°` : undefined,
    labelColor: "bg-red-600",
  }));

  const handleApply = async () => {
    if (!file) return;
    setStatus("processing");
    // Build per-page angles — pass the most common rotation, then handle per-page via pdf-lib
    // For simplicity: use rotatePDF with angle=90 for pages that have 90° rotation, etc.
    // Since rotatePDF supports per-page: pass "all" with dominant angle or reconstruct
    // Strategy: group pages by rotation angle and call rotatePDF once per group
    try {
      const { PDFDocument } = await import("pdf-lib");
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pgList = doc.getPages();
      pgList.forEach((pg, i) => {
        const deg = rotations[i + 1] ?? 0;
        if (deg !== 0) pg.setRotation({ type: "degrees", angle: (pg.getRotation().angle + deg) % 360 });
      });
      const out = await doc.save();
      downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" }), file.name.replace(/\.pdf$/i, "_rotated.pdf"));
      setStatus("done");
    } catch {
      setError("Rotation failed."); setStatus("error");
    }
  };

  const reset = () => { setFile(null); setThumbs([]); setRotations({}); setStatus("idle"); setError(""); };

  const rotateIcon = <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M12 4V8M12 8l-3-3m3 3l3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;

  return (
    <ToolShell name="Rotate PDF" description="Rotate individual pages or all pages at once." icon="🔄"
      steps={file ? undefined : ["Upload your PDF", "Click pages to rotate", "Download result"]}>
      {!file && <UploadZone onFilesAdded={handleFile} disabled={status === "loading"} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={rotateIcon} title="Rotate PDF" subtitle={`${file.name} · ${thumbs.length} pages`}
            onReset={reset}
            secondaryLabel="↺ Rotate all left" onSecondary={() => rotateAll(-90)}
            primaryLabel={status === "processing" ? "Rotating…" : status === "done" ? "✓ Downloaded!" : "Rotate All Right →"}
            onPrimary={status === "done" ? reset : handleApply}
            primaryDisabled={status === "processing"}
          >
            <button onClick={() => rotateAll(90)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
              ↻ Rotate all right
            </button>
          </WorkspaceBar>
          {error && <p className="text-red-500 text-sm px-5 py-3">{error}</p>}
          <div className="p-5 bg-gray-50">
            <ThumbnailGrid pages={pages} showRotateButtons
              onRotateLeft={p => rotate(p, -90)} onRotateRight={p => rotate(p, 90)} columns={4} />
          </div>
        </div>
      )}
    </ToolShell>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/rotate/page.tsx
git commit -m "feat: rotate PDF - thumbnail grid with per-page rotation buttons"
```

---

## Task 9: Delete Pages — Thumbnail Grid with Checkboxes

**Files:**
- Modify: `app/tools/delete-pages/page.tsx`

- [ ] **Step 1: Rewrite delete-pages with click-to-select thumbnails**

```tsx
"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import ThumbnailGrid, { ThumbnailPage } from "@/components/pdf/ThumbnailGrid";
import { renderThumbnails, deletePages, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function DeletePagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading"); setSelected(new Set());
    const t = await renderThumbnails(files[0], 0.4);
    setThumbs(t); setStatus("ready");
  }, []);

  const togglePage = (pageNum: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(pageNum) ? s.delete(pageNum) : s.add(pageNum); return s; });

  const pages: ThumbnailPage[] = thumbs.map((url, i) => ({ dataUrl: url, pageNumber: i + 1 }));

  const handleDelete = async () => {
    if (!file || selected.size === 0) return;
    setStatus("processing");
    const result = await deletePages(file, [...selected]);
    if (result.success && result.blob) {
      downloadBlob(result.blob, file.name.replace(/\.pdf$/i, "_deleted.pdf"));
      setStatus("done");
    } else { setError(result.error ?? "Failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setSelected(new Set()); setStatus("idle"); setError(""); };

  const trashIcon = <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;

  return (
    <ToolShell name="Delete Pages" description="Click pages to select them, then delete." icon="🗑️"
      steps={file ? undefined : ["Upload your PDF", "Click pages to select", "Delete & download"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(status === "ready" || status === "processing" || status === "done" || status === "error") && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={trashIcon} title="Delete Pages"
            subtitle={`${file.name} · ${thumbs.length} pages${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Deleting…" : status === "done" ? "✓ Downloaded!" : `Delete ${selected.size} page${selected.size !== 1 ? "s" : ""}`}
            onPrimary={status === "done" ? reset : handleDelete}
            primaryDisabled={selected.size === 0 || status === "processing"} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <div className="p-5 bg-gray-50">
            <p className="text-xs text-gray-400 mb-3">Click a page to select it for deletion</p>
            <ThumbnailGrid pages={pages} selectedPages={selected} onToggleSelect={togglePage} showCheckboxes columns={4} />
          </div>
        </div>
      )}
    </ToolShell>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/delete-pages/page.tsx
git commit -m "feat: delete pages - visual thumbnail grid with click-to-select"
```

---

## Task 10: Organize PDF — Add WorkspaceBar (logic already exists)

**Files:**
- Modify: `app/tools/organize/page.tsx`

The organize tool already renders thumbnails and has drag-drop. This task wraps it in WorkspaceBar and ThumbnailGrid styling.

- [ ] **Step 1: Import WorkspaceBar and wrap the existing UI**

Add `WorkspaceBar` import. Replace the existing header/button area above the thumbnail grid with `<WorkspaceBar>`. Keep existing drag-drop state and handlers (`handleDragStart`, `handleDragOver`, `handleDrop`).

Pass `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `dragOverIndex` to `ThumbnailGrid`.

The existing `thumbnails` array (data URLs) maps to `ThumbnailPage[]`:
```tsx
const pages: ThumbnailPage[] = pageOrder.map((origIdx, displayIdx) => ({
  dataUrl: thumbnails[origIdx],
  pageNumber: displayIdx + 1,
}));
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/organize/page.tsx
git commit -m "feat: organize PDF - wrap existing drag-drop with WorkspaceBar + ThumbnailGrid"
```

---

## Task 11: Split PDF — Sidebar + Page Strip with Visual Split Markers

**Files:**
- Modify: `app/tools/split/page.tsx`

- [ ] **Step 1: Rewrite split page with sidebar options + visual page strip**

```tsx
"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import SidebarWorkspace from "@/components/pdf/SidebarWorkspace";
import { renderThumbnails, splitPDF, downloadBlob } from "@/lib/pdf-tools";

type Mode = "every-page" | "range";
type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("every-page");
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [splitCount, setSplitCount] = useState(0);

  const handleFile = useCallback(async (files: File[]) => {
    setFile(files[0]); setStatus("loading");
    const t = await renderThumbnails(files[0], 0.35);
    setThumbs(t); setStatus("ready");
  }, []);

  const handleSplit = async () => {
    if (!file) return;
    setStatus("processing");
    const result = await splitPDF(file, mode, mode === "range" ? rangeStr : undefined);
    if (result.success && result.blobs) {
      result.blobs.forEach((blob, i) => downloadBlob(blob, result.filenames![i]));
      setSplitCount(result.blobs.length); setStatus("done");
    } else { setError(result.error ?? "Split failed."); setStatus("error"); }
  };

  const reset = () => { setFile(null); setThumbs([]); setMode("every-page"); setRangeStr(""); setStatus("idle"); setError(""); };

  const scissorsIcon = <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" stroke="white" strokeWidth="1.8"/><circle cx="6" cy="18" r="2.5" stroke="white" strokeWidth="1.8"/><path d="M8.5 7.5L20 12M8.5 16.5L20 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>;

  const sidebar = (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Split Mode</p>
      {([["every-page", "Split every page", "Each page becomes a separate PDF"],
         ["range", "Custom ranges", "e.g. 1-3, 4-6, 7-end"]] as const).map(([val, label, desc]) => (
        <button key={val} onClick={() => setMode(val)}
          className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors
            ${mode === val ? "border-red-200 bg-red-50" : "border-transparent hover:bg-gray-50"}`}>
          <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 ${mode === val ? "border-red-600 bg-red-600" : "border-gray-300"}`}/>
          <div>
            <div className="text-xs font-semibold text-gray-800">{label}</div>
            <div className="text-xs text-gray-400">{desc}</div>
          </div>
        </button>
      ))}
      {mode === "range" && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Page ranges</label>
          <input value={rangeStr} onChange={e => setRangeStr(e.target.value)}
            placeholder="1-3, 4-6" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
          <p className="text-xs text-gray-400 mt-1">Separate ranges with commas</p>
        </div>
      )}
    </div>
  );

  return (
    <ToolShell name="Split PDF" description="Split a PDF into multiple files." icon="✂️"
      steps={file ? undefined : ["Upload your PDF", "Choose split mode", "Download files"]}>
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {status === "loading" && <div className="text-center py-12 text-gray-400">Rendering pages…</div>}
      {(["ready","processing","done","error"] as Status[]).includes(status) && file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar icon={scissorsIcon} title="Split PDF" subtitle={`${file.name} · ${thumbs.length} pages`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Splitting…" : status === "done" ? `✓ ${splitCount} files downloaded` : "Split PDF →"}
            onPrimary={status === "done" ? reset : handleSplit}
            primaryDisabled={status === "processing" || (mode === "range" && !rangeStr.trim())} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <SidebarWorkspace sidebar={sidebar}>
            <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
              {thumbs.map((url, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="flex-shrink-0 w-24">
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <img src={url} alt={`Page ${i+1}`} draggable={false} className="w-full object-contain aspect-[3/4]" />
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-1">{i+1}</div>
                  </div>
                  {i < thumbs.length - 1 && mode === "every-page" && (
                    <div className="w-0.5 self-stretch bg-red-400 rounded mx-1 relative flex-shrink-0">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs">✂</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SidebarWorkspace>
        </div>
      )}
    </ToolShell>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/split/page.tsx
git commit -m "feat: split PDF - sidebar options + visual page strip with split markers"
```

---

## Task 12: Compress PDF — File Info + Option Cards

**Files:**
- Modify: `app/tools/compress/page.tsx`

- [ ] **Step 1: Rewrite compress page with 3-option cards**

Replace the existing slider UI with a clean 3-card selection. Keep the existing `compressPDF` call logic.

```tsx
// State: file, quality ("extreme"|"recommended"|"less"), status, error
// UI:
// - UploadZone (no file)
// - After file: WorkspaceBar + file info card + 3 quality option cards

const QUALITY_OPTS = [
  { value: "extreme", label: "Extreme", emoji: "🔥", desc: "Smallest size, lower visual quality" },
  { value: "recommended", label: "Recommended", emoji: "✅", desc: "Best balance of size and quality" },
  { value: "less", label: "Less", emoji: "🎯", desc: "Slight compression, best quality" },
] as const;
type Quality = "extreme" | "recommended" | "less";
```

Map quality to the existing `compressPDF` call:
- `"extreme"` → imageQuality: 0.3, scale: 0.7
- `"recommended"` → imageQuality: 0.6, scale: 0.85
- `"less"` → imageQuality: 0.85, scale: 1.0

(Check the existing `compressPDF` signature in `lib/pdf-tools.ts` and pass appropriate params.)

- [ ] **Step 2: Commit**
```bash
git add app/tools/compress/page.tsx
git commit -m "feat: compress PDF - file info card + 3 quality option cards"
```

---

## Task 13: Watermark PDF — Sidebar + Live PDF Preview

**Files:**
- Modify: `app/tools/watermark/page.tsx`

- [ ] **Step 1: Rewrite watermark page**

State additions:
- `previewPage: number` (0-based, current preview page)
- `previewUrl: string | null` (rendered page data URL)
- `pageCount: number`

Preview rendering: after file upload, render page 1 with `renderThumbnails(file, 0.8)[0]` (higher scale for preview quality). Re-render on page nav.

Sidebar options (keep existing state: text, color, position, opacity):
- Text input
- 9-position grid (3×3, active = red-600)
- Opacity slider (range input, accent-red-600)
- Font size select

Live preview: show `<img src={previewUrl}>` with a CSS overlay for the watermark text at the configured position/opacity. This is a CSS preview, not re-rendering the PDF on every change.

Watermark CSS overlay approach:
```tsx
// Position the watermark text over the preview image using absolute positioning
// Map position ("center", "diagonal", etc.) to CSS transform/position
const overlayStyle = position === "diagonal"
  ? { position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", transform:"rotate(-30deg)" }
  : { position:"absolute", ...positionMap[position] };
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/watermark/page.tsx
git commit -m "feat: watermark PDF - sidebar options + live CSS preview"
```

---

## Task 14: Page Numbers — Sidebar + Live PDF Preview

**Files:**
- Modify: `app/tools/page-numbers/page.tsx`

- [ ] **Step 1: Rewrite page-numbers page**

Same pattern as watermark. Sidebar options:
- 9-position grid (map to `PageNumberOptions.position`)
- Format select: "1" / "Page 1" / "1 / N"
- Font size slider
- Start from input (number)

Live preview: show rendered page with a floating number badge positioned according to the grid selection.

```tsx
// Position badge using absolute positioning based on selected grid cell
const positionStyles: Record<string, React.CSSProperties> = {
  "bottom-center": { bottom: 8, left: "50%", transform: "translateX(-50%)" },
  "bottom-right": { bottom: 8, right: 8 },
  "bottom-left": { bottom: 8, left: 8 },
  "top-center": { top: 8, left: "50%", transform: "translateX(-50%)" },
};
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/page-numbers/page.tsx
git commit -m "feat: page numbers - sidebar options + live preview with number badge"
```

---

## Task 15: Merge PDF — Multi-File Thumbnail Grid

**Files:**
- Modify: `app/tools/merge/page.tsx`

- [ ] **Step 1: Rewrite merge page**

State:
- `files: File[]`
- `allThumbs: string[][]` (array of thumbnail arrays, one per file)
- `flatPages: { dataUrl: string; fileIndex: number; pageNumber: number }[]` (computed from allThumbs + files order)

After each file added, render its thumbnails and append to `allThumbs`.

UI:
- WorkspaceBar with "Add more files" secondary button and "Merge PDF →" primary
- Flat thumbnail grid showing all pages from all files with a file separator label between files
- Drag-to-reorder not needed (files are merged in order)

```tsx
// File separator: between pages of different files, show a divider with the filename
```

- [ ] **Step 2: Commit**
```bash
git add app/tools/merge/page.tsx
git commit -m "feat: merge PDF - multi-file thumbnail grid preview"
```

---

## Task 16: PDF to JPG + PDF to PNG — Thumbnail Grid with Page Selection

**Files:**
- Modify: `app/tools/pdf-to-jpg/page.tsx`
- Modify: `app/tools/pdf-to-png/page.tsx`

- [ ] **Step 1: Rewrite pdf-to-jpg with selectable thumbnail grid**

State: `selectedPages: Set<number>` (all selected by default on load).

WorkspaceBar: "Convert X pages →" button, disabled when nothing selected.

UI: thumbnail grid with checkboxes. "Select all / Deselect all" link above grid.

Apply same pattern to `pdf-to-png/page.tsx` (identical except calls `pdfToPng`).

- [ ] **Step 2: Commit**
```bash
git add app/tools/pdf-to-jpg/page.tsx app/tools/pdf-to-png/page.tsx
git commit -m "feat: pdf-to-jpg/png - selectable thumbnail grid"
```

---

## Task 17: JPG to PDF — Image Preview Grid + Repair Page Update

**Files:**
- Modify: `app/tools/jpg-to-pdf/page.tsx`
- Modify: `app/tools/repair/page.tsx`

- [ ] **Step 1: Rewrite jpg-to-pdf with image preview grid**

State: `images: File[]`, `previews: string[]` (object URLs or data URLs).

After image drop: create `URL.createObjectURL(file)` for each image preview.

WorkspaceBar: "Convert to PDF →", secondary "Add more images".

Grid: show image thumbnails in `grid-cols-4` with drag-to-reorder (same drag pattern as organize — HTML5 drag API).

- [ ] **Step 2: Update repair page**

Repair is simple — file info card + "Repair PDF →" button. No visual complexity needed. Just apply WorkspaceBar styling.

- [ ] **Step 3: Commit**
```bash
git add app/tools/jpg-to-pdf/page.tsx app/tools/repair/page.tsx
git commit -m "feat: jpg-to-pdf image grid, repair page cleanup"
```

---

## Task 18: Build Verification + Vercel Deploy

- [ ] **Step 1: Run local build**
```bash
cd /c/Users/kael_/rizzpdf-app
npm run build
```
Expected: no errors. Fix any TypeScript or import errors before proceeding.

- [ ] **Step 2: Check for leftover purple**
```bash
grep -r "purple" app components --include="*.tsx" | grep -v "node_modules" | grep -v ".next"
# Only acceptable: sign/page.tsx may have purple for the signature panel accent (by design)
```

- [ ] **Step 3: Final commit and push**
```bash
git add -A
git commit -m "feat: complete RizzPDF UI redesign - red brand, SVG cards, PDF workspace UIs"
git push origin main
```

- [ ] **Step 4: Verify Vercel deploy succeeds**

Check Vercel dashboard — build should pass. If it fails, check build logs for import errors.

- [ ] **Step 5: Smoke test in browser**
- [ ] Home page: tool cards show SVG icons, category filter works
- [ ] `/tools/rotate`: upload a PDF → thumbnails appear, click rotate buttons → rotation badge shows, download works
- [ ] `/tools/delete-pages`: upload → click pages → selected pages highlighted → delete works
- [ ] `/tools/split`: upload → sidebar options → split marker visible → download works
- [ ] `/tools/compress`: upload → 3 quality cards → compress works
- [ ] `/tools/watermark`: upload → sidebar + live preview → watermark applies
- [ ] `/tools/sign`: still works (unchanged except button color)

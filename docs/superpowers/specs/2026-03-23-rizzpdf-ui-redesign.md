# RizzPDF UI Redesign — Design Spec
**Date:** 2026-03-23
**Status:** Approved by user

---

## Overview

Full visual redesign of RizzPDF to match iLovePDF's clean, professional aesthetic while keeping RizzPDF's identity distinct. Three scoped changes: brand color, tool hub cards, and tool processing pages. No tool logic, APIs, auth, or blog pages are touched.

---

## Design Decisions (user-approved)

| Area | Decision |
|---|---|
| Brand color | Red (#dc2626) replaces purple everywhere |
| Tool hub cards | White cards, colored SVG icon tiles, red category filter pills |
| Tool page layout | Top banner + red icon box + privacy badge + full-width drop zone + step indicators |

---

## 1. Brand Color

**Primary:** `#dc2626` (Tailwind `red-600`)
**Primary hover:** `#b91c1c` (Tailwind `red-700`)
**Primary light bg:** `#fef2f2` (Tailwind `red-50`)
**Primary border/ring:** `#fca5a5` (Tailwind `red-300`)
**Focus ring:** `focus:border-red-400`
**Accent text:** `text-red-600`
**Range input accent:** `accent-red-600`

All occurrences of `purple-600`, `purple-700`, `purple-500`, `purple-400`, `purple-100`, `from-purple-600`, `to-pink-500`, `hover:text-purple-600`, `hover:border-purple-400` are replaced with the red equivalents. Confirmed via audit: every purple occurrence in tool pages is brand-only (buttons, focus rings, hover states, active toggles) — no non-brand purple exists.

---

## 2. Navbar (`components/Navbar.tsx`)

**Current logo implementation:** `<span className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">RizzPDF</span>`

**New logo:** Two `<span>` children inside the existing element:
```tsx
<span className="text-xl font-black">
  <span className="text-gray-900">Rizz</span>
  <span className="text-red-600">PDF</span>
</span>
```

**Other changes:**
- All nav link hover states: `hover:text-purple-600` → `hover:text-red-600`
- "Sign in" border button: `hover:border-purple-400 hover:text-purple-600` → `hover:border-red-400 hover:text-red-600`
- "Sign up" button: remove gradient, use `bg-red-600 hover:bg-red-700 text-white`

---

## 3. Home Page & Tools Hub (`app/page.tsx`, `app/tools/page.tsx`)

Both pages (`/` and `/tools`) exist independently as separate routes. Both get the same card grid and category filter treatment. `/` is the marketing home page; `/tools` is the plain tools hub. Both use identical card components.

### Category filter pills
```
[ All ] [ Organize PDF ] [ Convert PDF ] [ Edit PDF ] [ PDF Security ]
```
- Centered below the page subtitle, `flex flex-wrap gap-2 justify-center`
- Active: `bg-red-600 text-white border-red-600`
- Inactive: `border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm font-semibold hover:border-red-300 cursor-pointer`
- **Data source:** Hardcoded array in the component — categories are stable and do not come from an API. "All" is the default selected state on mount.
- **Empty state:** Cannot occur — every category has at least one tool. No empty-state UI needed.
- Client component — `useState` for active category, filters tool list by matching the `category` field on each tool definition.

### Tool card grid
- **Breakpoints:** `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4`
- **Card:** `bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer`
- **Card link:** entire card wrapped in `<Link href={route}>`
- **Icon box:** `w-11 h-11 rounded-xl mx-auto flex items-center justify-center` with per-tool background color
- **SVG icon:** 22×22px, inline SVG per tool
- **Tool name:** `text-sm font-bold text-gray-900 mt-3 leading-tight`
- **Tool description:** `text-xs text-gray-400 mt-1 leading-snug` — always visible (not hover-only)

### Tool icon color map (complete)

| Tool | Route | Category | Icon bg | SVG color |
|---|---|---|---|---|
| Unlock PDF | `/` (home) | PDF Security | `#fef2f2` | `#ef4444` |
| Merge PDF | `/tools/merge` | Organize PDF | `#fef2f2` | `#ef4444` |
| Split PDF | `/tools/split` | Organize PDF | `#fff7ed` | `#f97316` |
| Compress PDF | `/tools/compress` | Organize PDF | `#f0fdf4` | `#22c55e` |
| Rotate PDF | `/tools/rotate` | Organize PDF | `#fef2f2` | `#ef4444` |
| PDF to JPG | `/tools/pdf-to-jpg` | Convert PDF | `#eff6ff` | `#3b82f6` |
| JPG to PDF | `/tools/jpg-to-pdf` | Convert PDF | `#eff6ff` | `#3b82f6` |
| PDF to PNG | `/tools/pdf-to-png` | Convert PDF | `#f0fdfa` | `#14b8a6` |
| Watermark PDF | `/tools/watermark` | Edit PDF | `#fff0f9` | `#ec4899` |
| Organize PDF | `/tools/organize` | Organize PDF | `#fefce8` | `#eab308` |
| Page Numbers | `/tools/page-numbers` | Edit PDF | `#f0fdfa` | `#14b8a6` |
| Sign PDF | `/tools/sign` | Edit PDF | `#fdf4ff` | `#a855f7` |
| Delete Pages | `/tools/delete-pages` | Organize PDF | `#fff7ed` | `#f97316` |
| Repair PDF | `/tools/repair` | PDF Security | `#f5f3ff` | `#8b5cf6` |

SVG designs are simple, clean, geometric — not emoji. Each SVG is inlined directly in the card (no external file). The same SVG icons are reused in the ToolShell banner.

---

## 4. ToolShell (`components/ToolShell.tsx`)

### Updated props interface
```typescript
interface ToolShellProps {
  name: string;
  description: string;
  icon: string;                    // kept — used as fallback / meta
  svgIcon?: React.ReactNode;       // new: inline SVG for banner icon box (React.ReactNode)
  steps?: [string, string, string]; // new: 3-step labels; defaults shown below
  children: React.ReactNode;
}
```

**Default steps (used when `steps` prop is omitted):**
```typescript
["Upload your file", "Choose options", "Download result"]
```
Steps are always exactly 3 — every PDF tool workflow is: upload → configure → download. This is intentional; the tuple type `[string, string, string]` enforces it.

**Step bar visibility:** Rendered only when `steps` prop is provided. Absence of the prop = no step bar shown.

### Banner layout
```
┌─────────────────────────────────────────────────────────────────┐
│ padding: px-6 py-5                                              │
│ bg: bg-gradient-to-r from-red-50 to-white                       │
│ border-bottom: border-b border-red-100                          │
│                                                                 │
│  [56×56 red box]   Tool Name h1                 🔒 badge        │
│  rounded-2xl       text-2xl font-black                         │
│  bg-red-600        Description text-sm text-gray-500           │
│                    max-w-md                                     │
└─────────────────────────────────────────────────────────────────┘
```
- Banner: `flex items-start justify-between gap-4 flex-wrap` — on mobile (`< sm`), privacy badge wraps to second row below title (natural flex-wrap behavior). Icon box + title remain side-by-side at all breakpoints.
- Left: `flex items-start gap-4`
- Icon box: `w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center flex-shrink-0` — white SVG icon inside. If `svgIcon` is omitted, render a default document icon (simple page outline SVG in white, 28×28px).
- Title: `text-2xl font-black text-gray-900`
- Description: `text-sm text-gray-500 mt-1 max-w-md`
- Privacy badge (right, self-start): `flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 text-xs font-semibold text-green-700 whitespace-nowrap`
  - Content: `🔒 Files stay in your browser`

### Workspace
- `max-w-2xl mx-auto w-full px-6 py-8 space-y-5`

### Step indicators
```
┌──────────────────┬──────────────────┬──────────────────┐
│  ①               │  ②               │  ③               │
│  Upload your     │  Choose options  │  Download result │
│  file            │                  │                  │
└──────────────────┴──────────────────┴──────────────────┘
```
- Wrapper: `flex border border-gray-200 rounded-xl overflow-hidden mb-5`
- Each step: `flex-1 flex items-center gap-2.5 px-4 py-3 border-r border-gray-200 last:border-r-0`
- Number circle: `w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-xs font-black text-red-600 flex-shrink-0`
- Label: `text-xs text-gray-500 leading-snug`
- Rendered only when `steps` prop is provided

### "More PDF tools" section
- Existing structure kept
- Update hover: `hover:border-purple-400` → `hover:border-red-400`, `hover:text-purple-600` → `hover:text-red-600`

---

## 5. UploadZone (`components/UploadZone.tsx`)

- Upload icon background: `bg-red-600` (remove gradient)
- Drag-active border color: `border-red-500 bg-red-50`
- `pulse-border` keyframes in `globals.css`: `#a855f7` → `#dc2626`
- Any `purple` class in UploadZone: → `red` equivalent

---

## 6. Tool Pages — Color Replace

All occurrences in `app/tools/*/page.tsx` files:

| From | To |
|---|---|
| `bg-purple-600` | `bg-red-600` |
| `bg-purple-700` | `bg-red-700` |
| `hover:bg-purple-700` | `hover:bg-red-700` |
| `hover:border-purple-400` | `hover:border-red-400` |
| `focus:border-purple-400` | `focus:border-red-400` |
| `hover:text-purple-600` | `hover:text-red-600` |
| `text-purple-600` | `text-red-600` |
| `border-purple-400` | `border-red-400` |
| `accent-purple-600` | `accent-red-600` |
| `border-purple-200` | `border-red-200` |
| `bg-purple-50` | `bg-red-50` |

Audit confirmed: all purple in tool pages is brand-only. Safe to replace wholesale.

---

## 7. Files Changed (complete scope)

| File | Change type |
|---|---|
| `components/Navbar.tsx` | Logo split, button/hover colors |
| `components/ToolShell.tsx` | Full layout redesign, new props |
| `components/UploadZone.tsx` | Color scheme |
| `app/page.tsx` | Category filter, card grid, SVG icons |
| `app/tools/page.tsx` | Category filter, card grid, SVG icons |
| `app/globals.css` | `pulse-border` keyframe color |
| `app/tools/compress/page.tsx` | purple → red |
| `app/tools/delete-pages/page.tsx` | purple → red |
| `app/tools/jpg-to-pdf/page.tsx` | purple → red |
| `app/tools/merge/page.tsx` | purple → red |
| `app/tools/organize/page.tsx` | purple → red |
| `app/tools/page-numbers/page.tsx` | purple → red |
| `app/tools/pdf-to-jpg/page.tsx` | purple → red |
| `app/tools/pdf-to-png/page.tsx` | purple → red |
| `app/tools/repair/page.tsx` | purple → red |
| `app/tools/rotate/page.tsx` | purple → red |
| `app/tools/sign/page.tsx` | purple → red |
| `app/tools/split/page.tsx` | purple → red |
| `app/tools/watermark/page.tsx` | purple → red |

**Not changed:** Tool logic/processing, API routes, auth, payments, blog pages, dashboard, footer structure, SEO metadata.

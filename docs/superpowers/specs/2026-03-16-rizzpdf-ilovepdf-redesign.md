# RizzPDF — iLovePDF Design Replication Spec

## Summary

Replace RizzPDF's current hero-first homepage and navbar with an iLovePDF-inspired tool-grid-first layout, while keeping the purple/pink RizzPDF brand identity. All existing tool functionality remains untouched.

## Goals

- Homepage becomes the tool grid (no hero, no pricing, no how-it-works)
- Navbar matches iLovePDF structure: ALL CAPS links to top tools + dropdown, user/grid icons
- Tool pages get a lighter bg matching the new homepage palette
- Dark multi-column footer replaces the current minimal footer
- Existing Stripe/paywall logic stays intact (hidden, not deleted)

## Out of Scope

- Revenue model changes (future task)
- Tool page upload UI changes
- Any backend/API changes

## Design Language (iLovePDF-inspired, purple brand)

### Colors
- Page bg: `#F9F7FF` (very light purple-tinted white)
- Card bg: `#FFFFFF`
- Card shadow: `0 1px 6px rgba(0,0,0,0.08)`
- Card hover shadow: `0 4px 16px rgba(0,0,0,0.12)`
- Nav bg: `#FFFFFF`, border-bottom: `1px solid #f0f0f0`
- Footer bg: `#1a1a2e` (dark charcoal)
- Primary accent: `#7c3aed` (purple-700)
- Gradient: `from-purple-600 to-pink-500`

### Navbar
- White bg, sticky, z-50
- Logo: `RizzPDF` with purple→pink gradient (no BETA badge)
- Links: ALL CAPS, bold, `text-[13px]`, `tracking-wide`, gray-700, hover purple
- Links shown: `MERGE PDF` · `SPLIT PDF` · `COMPRESS PDF` · `ALL TOOLS ▾`
- Right: Sign In (outlined) + Sign Up (gradient pill) for logged-out; UserButton + grid icon for logged-in
- Scroll-based links removed (no more "how it works", "pricing")

### Homepage
- `bg-[#F9F7FF]` full page
- Centered heading: `"Your PDF toolkit"` + subtitle `"Free, private, browser-based."`
- Category filter pills (All selected by default): `All · Organize PDF · Convert PDF · Edit PDF · PDF Security`
- Tool grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, gap-4
- Each tool card: white bg, rounded-2xl, shadow-sm, p-5, hover:-translate-y-0.5 hover:shadow-md
  - Icon: 48×48 colored square (rounded-xl), emoji centered inside
  - Name: bold, 14px, gray-900
  - Description: 12px, gray-500, 2 lines max
  - Whole card is an `<a>` link

### Tool Card Icon Colors (per tool)
| Tool | Bg |
|------|-----|
| Unlock PDF | `#EDE9FE` |
| Merge PDF | `#FDECEA` |
| Split PDF | `#FDECEA` |
| Compress PDF | `#E8F5E9` |
| Rotate PDF | `#E3F2FD` |
| PDF to JPG | `#FEF9C3` |
| JPG to PDF | `#FEF9C3` |
| Watermark PDF | `#E0F7FA` |
| Organize PDF | `#FFF3E0` |
| Page Numbers | `#E3F2FD` |
| Sign PDF | `#EEF2FF` |
| Delete Pages | `#FEE2E2` |
| PDF to PNG | `#F0FDF4` |
| Repair PDF | `#F3F4F6` |

### Category Filtering
- Client-side filter: clicking a pill filters the grid to matching tools
- `All` shows all 14 tools
- Active pill: `bg-purple-700 text-white`
- Inactive pill: `border border-gray-200 text-gray-600 hover:border-purple-300`

### Tool Categories
- **Organize PDF**: Merge, Split, Rotate, Organize, Delete Pages, Page Numbers
- **Convert PDF**: PDF to JPG, PDF to PNG, JPG to PDF
- **Edit PDF**: Watermark, Sign, Page Numbers
- **PDF Security**: Unlock PDF, Repair PDF

### Footer (new component: `components/Footer.tsx`)
- Dark bg `#1a1a2e`, text white/gray
- 4 columns: **Product** (Home, Tools, Pricing, Blog) · **Tools** (Merge, Split, Compress, Unlock, Rotate) · **Legal** (Privacy, Terms, Cookies) · **Company** (Support, About)
- Bottom row: `© 2026 RizzPDF` + social icons (Twitter/X, GitHub)
- Language/locale: not needed

### ToolShell
- Change bg from `bg-gray-50` to `bg-[#F9F7FF]` to match homepage
- No other changes

## Files Changed

| File | Action |
|------|--------|
| `components/Navbar.tsx` | Rewrite |
| `components/Footer.tsx` | Create new |
| `app/page.tsx` | Rewrite |
| `components/ToolShell.tsx` | Minor: bg color update |

## Files Preserved Unchanged

- All `app/tools/*/page.tsx` — tool logic untouched
- `lib/pdf-tools.ts` — no changes
- `components/PaywallModal.tsx` — kept, just not rendered on homepage
- All API routes — no changes
- `components/UploadZone.tsx`, `FileCard.tsx` — no changes

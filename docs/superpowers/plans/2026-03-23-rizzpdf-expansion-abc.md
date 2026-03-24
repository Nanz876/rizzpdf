# RizzPDF Expansion A/B/C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand RizzPDF into a full iLovePDF-competitive toolkit by redesigning the homepage, replacing all icons with iLovePDF-style document+badge icons, adding Protect PDF, PDF to Word, and Batch Processing tools.

**Architecture:** New shared `ToolCard` + `ToolIcon` components replace all inline SVG tool tiles. Homepage becomes a category hub (no unlock hero). Three new tool pages. lib/pdf-tools.ts gets three new functions.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, pdf-lib (already installed), pdfjs-dist (already installed), docx (new), jszip (new)

**Spec:** `docs/superpowers/specs/2026-03-23-rizzpdf-expansion-abc-design.md`

---

## Task 1: Install new packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install docx and jszip**

```bash
cd C:/Users/kael_/rizzpdf-app
npm install docx jszip
```

- [ ] **Step 2: Verify install**

Run: `npm list docx jszip`
Expected: both packages listed with version numbers, no errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install docx and jszip packages"
```

---

## Task 2: Create ToolIcon component

**Files:**
- Create: `components/ToolIcon.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ToolIcon.tsx
import React from "react";

interface ToolIconProps {
  variant: "single" | "double";
  bgColor: string;
  badgeColor: string;
  badgeLabel: string;
  badgeColor2?: string;
  badgeLabel2?: string;
  innerContent?: React.ReactNode;
  size?: number;
  bare?: boolean;
}

function DocShape({
  badgeColor,
  badgeLabel,
  innerContent,
  zIndex = 1,
}: {
  badgeColor?: string;
  badgeLabel?: string;
  innerContent?: React.ReactNode;
  zIndex?: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: 34,
        height: 42,
        background: "white",
        borderRadius: 4,
        boxShadow: "0 1px 5px rgba(0,0,0,0.20)",
        flexShrink: 0,
        zIndex,
      }}
    >
      {/* fold */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 9,
          height: 9,
          background: "#e0e0e0",
          borderRadius: "0 0 0 4px",
        }}
      />
      {/* inner content or lines */}
      {innerContent ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingTop: 4,
          }}
        >
          {innerContent}
        </div>
      ) : (
        <div style={{ padding: "12px 5px 5px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ height: 2.5, borderRadius: 2, background: "#ddd" }} />
          <div style={{ height: 2.5, borderRadius: 2, background: "#ddd", width: "60%" }} />
          <div style={{ height: 2.5, borderRadius: 2, background: "#ddd" }} />
        </div>
      )}
      {/* badge */}
      {badgeColor && badgeLabel && (
        <div
          style={{
            position: "absolute",
            bottom: -6,
            right: -7,
            padding: "2px 5px",
            borderRadius: 4,
            fontSize: 8,
            fontWeight: 800,
            color: "white",
            background: badgeColor,
            lineHeight: 1.5,
            letterSpacing: 0.2,
          }}
        >
          {badgeLabel}
        </div>
      )}
    </div>
  );
}

export default function ToolIcon({
  variant,
  bgColor,
  badgeColor,
  badgeLabel,
  badgeColor2,
  badgeLabel2,
  innerContent,
  size = 56,
  bare = false,
}: ToolIconProps) {
  const inner =
    variant === "double" ? (
      <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "flex-end" }}>
        {/* back doc */}
        <div style={{ position: "absolute", right: 0, top: 0, zIndex: 0 }}>
          <DocShape badgeColor={badgeColor2} badgeLabel={badgeLabel2} zIndex={0} />
        </div>
        {/* front doc */}
        <div style={{ position: "absolute", left: 0, bottom: 0, zIndex: 1 }}>
          <DocShape badgeColor={badgeColor} badgeLabel={badgeLabel} innerContent={innerContent} zIndex={1} />
        </div>
      </div>
    ) : (
      <DocShape badgeColor={badgeColor} badgeLabel={badgeLabel} innerContent={innerContent} />
    );

  if (bare) return <>{inner}</>;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {inner}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd C:/Users/kael_/rizzpdf-app && npx tsc --noEmit`
Expected: no errors in ToolIcon.tsx

- [ ] **Step 3: Commit**

```bash
git add components/ToolIcon.tsx
git commit -m "feat: add ToolIcon component (iLovePDF document+badge style)"
```

---

## Task 3: Create ToolCard component

**Files:**
- Create: `components/ToolCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ToolCard.tsx
import React from "react";
import Link from "next/link";

interface ToolCardProps {
  name: string;
  description: string;
  route: string;
  icon: React.ReactNode;
  badge?: "NEW" | "HOT" | "PRO";
}

const BADGE_COLORS: Record<string, string> = {
  NEW: "#ef4444",
  HOT: "#f97316",
  PRO: "#8b5cf6",
};

export default function ToolCard({ name, description, route, icon, badge }: ToolCardProps) {
  return (
    <Link
      href={route}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-start justify-between min-h-[160px] transition-all hover:border-red-400 hover:shadow-md hover:-translate-y-px"
    >
      {badge && (
        <span
          className="absolute top-3 right-3 text-white text-[9px] font-bold px-2 py-0.5 rounded"
          style={{ background: BADGE_COLORS[badge] }}
        >
          {badge}
        </span>
      )}
      <div>{icon}</div>
      <div>
        <div className="text-[15px] font-extrabold text-gray-900 leading-tight mb-1.5">{name}</div>
        <div className="text-xs text-gray-500 leading-relaxed">{description}</div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/ToolCard.tsx
git commit -m "feat: add ToolCard component (square tile, icon top-left)"
```

---

## Task 4: Redesign homepage (app/page.tsx)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read the current file first**

Read `app/page.tsx` to understand what needs to be preserved vs replaced.

- [ ] **Step 2: Rewrite app/page.tsx**

Replace the entire file. The new page:
- Has NO unlock hero, NO FileEntry state, NO PaywallModal import, NO UploadZone
- Imports ToolCard and ToolIcon
- Has a TOOLS array (same structure as app/tools/page.tsx but adapted)
- Renders three category sections: "Organize PDF", "Convert PDF", "Edit & Security"
- Has a mobile app placeholder section above Footer

```tsx
// app/page.tsx
"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import ToolIcon from "@/components/ToolIcon";

const ORGANIZE_TOOLS = [
  { name: "Merge PDF", route: "/tools/merge", desc: "Combine multiple PDFs into one file.",
    icon: <ToolIcon variant="double" bgColor="#fff3f3" badgeColor="#ef4444" badgeLabel="PDF" /> },
  { name: "Split PDF", route: "/tools/split", desc: "Extract pages or ranges from a PDF.",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" /> },
  { name: "Organize PDF", route: "/tools/organize", desc: "Drag pages to reorder them.",
    icon: <ToolIcon variant="single" bgColor="#fefce8" badgeColor="#eab308" badgeLabel="PDF" /> },
  { name: "Delete Pages", route: "/tools/delete-pages", desc: "Remove unwanted pages from a PDF.",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" /> },
  { name: "Rotate PDF", route: "/tools/rotate", desc: "Rotate individual or all pages.",
    icon: <ToolIcon variant="single" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" /> },
  { name: "Page Numbers", route: "/tools/page-numbers", desc: "Stamp page numbers onto your PDF.",
    icon: <ToolIcon variant="single" bgColor="#f0fdfa" badgeColor="#14b8a6" badgeLabel="PDF" /> },
];

const CONVERT_TOOLS = [
  { name: "PDF to JPG", route: "/tools/pdf-to-jpg", desc: "Export every page as a JPG image.",
    icon: <ToolIcon variant="double" bgColor="#f0f9ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#3b82f6" badgeLabel2="JPG" /> },
  { name: "JPG to PDF", route: "/tools/jpg-to-pdf", desc: "Turn images into a PDF file.",
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#3b82f6" badgeLabel="JPG" badgeColor2="#ef4444" badgeLabel2="PDF" /> },
  { name: "PDF to Word", route: "/tools/pdf-to-word", desc: "Export as an editable .docx file.", badge: "NEW" as const,
    icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#2563eb" badgeLabel2="DOC" /> },
  { name: "Compress PDF", route: "/tools/compress", desc: "Reduce file size without quality loss.",
    icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#22c55e" badgeLabel="ZIP" /> },
  { name: "PDF to PNG", route: "/tools/pdf-to-png", desc: "Export pages as PNG images.",
    icon: <ToolIcon variant="double" bgColor="#f0fdfa" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#14b8a6" badgeLabel2="PNG" /> },
];

const SECURITY_TOOLS = [
  { name: "Protect PDF", route: "/tools/protect", desc: "Add password protection to any PDF.", badge: "NEW" as const,
    icon: <ToolIcon variant="single" bgColor="#fdf4ff" badgeColor="#a855f7" badgeLabel="PDF" /> },
  { name: "Unlock PDF", route: "/tools/unlock", desc: "Remove PDF password instantly.",
    icon: <ToolIcon variant="single" bgColor="#fef2f2" badgeColor="#ef4444" badgeLabel="PDF" /> },
  { name: "Watermark PDF", route: "/tools/watermark", desc: "Add text or image overlays.",
    icon: <ToolIcon variant="single" bgColor="#fff0f9" badgeColor="#ec4899" badgeLabel="PDF" /> },
  { name: "Sign PDF", route: "/tools/sign", desc: "Draw or upload your signature.",
    icon: <ToolIcon variant="single" bgColor="#fff7ed" badgeColor="#f97316" badgeLabel="PDF" /> },
  { name: "Repair PDF", route: "/tools/repair", desc: "Fix corrupted or damaged PDFs.",
    icon: <ToolIcon variant="single" bgColor="#f5f3ff" badgeColor="#8b5cf6" badgeLabel="PDF" /> },
  { name: "Batch Processing", route: "/tools/batch", desc: "Apply one tool to many PDFs at once.",
    icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#22c55e" badgeLabel="PDF"
      innerContent={<svg width="18" height="16" fill="none" viewBox="0 0 20 18"><rect x="1" y="5" width="18" height="4" rx="2" fill="rgba(34,197,94,0.25)" stroke="#22c55e" strokeWidth="1.3"/><rect x="1" y="11" width="18" height="4" rx="2" fill="rgba(34,197,94,0.4)" stroke="#22c55e" strokeWidth="1.3"/><rect x="1" y="1" width="18" height="3" rx="1.5" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1.3"/></svg>}
    /> },
];

function CategorySection({ title, tools }: { title: string; tools: typeof ORGANIZE_TOOLS }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide whitespace-nowrap">{title}</h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tools.map((t) => (
          <ToolCard key={t.route} name={t.name} description={t.desc} route={t.route} icon={t.icon} badge={(t as any).badge} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white border-b border-gray-100 py-10 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-3">
              Every PDF tool you need
            </h1>
            <p className="text-gray-500 text-base">
              100% private · runs in your browser · free for 3 files
            </p>
          </div>
        </section>

        {/* Tool categories */}
        <section className="max-w-7xl mx-auto px-4 py-10">
          <CategorySection title="Organize PDF" tools={ORGANIZE_TOOLS} />
          <CategorySection title="Convert PDF" tools={CONVERT_TOOLS} />
          <CategorySection title="Edit & Security" tools={SECURITY_TOOLS} />
        </section>

        {/* Mobile app placeholder */}
        <section className="bg-white border-t border-gray-100 py-12 text-center">
          <div className="max-w-xl mx-auto px-4">
            <h2 className="text-xl font-black text-gray-900 mb-2">RizzPDF app — coming soon</h2>
            <p className="text-gray-500 text-sm mb-6">Take PDF tools anywhere. iOS and Android.</p>
            <div className="flex items-center justify-center gap-4 mb-6 opacity-40">
              <div className="bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-not-allowed">
                App Store
              </div>
              <div className="bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-not-allowed">
                Google Play
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <button className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors">
                Notify me
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no TypeScript or build errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(A1): redesign homepage as category tool hub, remove unlock hero"
```

---

## Task 5: Move Unlock PDF to /tools/unlock

**Files:**
- Create: `app/tools/unlock/page.tsx`

- [ ] **Step 1: Note — do not read app/page.tsx**

Task 4 already rewrote `app/page.tsx`. The complete unlock page code is provided in Step 2 below — use it directly. Do not attempt to read the current `app/page.tsx`.

- [ ] **Step 2: Create unlock page**

Create `app/tools/unlock/page.tsx` wrapping the unlock logic in ToolShell:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import FileCard, { FileEntry } from "@/components/FileCard";
import PaywallModal from "@/components/PaywallModal";

const FREE_LIMIT = 3;

export default function UnlockPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    if (until && Date.now() < Number(until)) setIsPro(true);
  }, []);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const currentCount = files.length;
      const allowed = isPro ? Infinity : FREE_LIMIT;
      if (currentCount >= allowed) { setShowPaywall(true); return; }
      const toAdd = newFiles.slice(0, allowed - currentCount);
      const overflow = newFiles.length - toAdd.length;
      const entries: FileEntry[] = toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, status: "idle" }));
      setFiles((prev) => [...prev, ...entries]);
      if (overflow > 0) setTimeout(() => setShowPaywall(true), 300);
    },
    [files.length, isPro]
  );

  const handleRemove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);
  const handleStatusChange = useCallback((id: string, status: FileEntry["status"], error?: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));
  }, []);

  return (
    <ToolShell
      name="Unlock PDF"
      description="Remove PDF password protection instantly. Free for up to 3 files."
      icon="🔓"
      steps={files.length > 0 ? undefined : ["Upload your PDF", "Enter the password", "Download unlocked file"]}
    >
      <UploadZone onFilesAdded={handleFilesAdded} />

      {!isPro && files.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`w-8 h-1.5 rounded-full ${i < files.length ? "bg-red-500" : "bg-gray-200"}`} />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {files.length}/3 free files used
            {files.length >= FREE_LIMIT && (
              <button onClick={() => setShowPaywall(true)} className="ml-2 text-red-600 font-semibold hover:underline">
                Go bulk for $1 →
              </button>
            )}
          </span>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your files ({files.length})</h2>
            <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-red-500">Clear all</button>
          </div>
          <div className="space-y-3">
            {files.map((entry) => (
              <FileCard key={entry.id} entry={entry} onRemove={handleRemove} onStatusChange={handleStatusChange} />
            ))}
          </div>
        </div>
      )}

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} onPay={() => { setIsPro(true); setShowPaywall(false); }} />}
    </ToolShell>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/tools/unlock/page.tsx
git commit -m "feat(A1): move Unlock PDF to /tools/unlock"
```

---

## Task 6: Add Protect PDF tool

**Files:**
- Modify: `lib/pdf-tools.ts`
- Create: `app/tools/protect/page.tsx`

- [ ] **Step 1: Add protectPDF to lib/pdf-tools.ts**

Append to `lib/pdf-tools.ts`:

```ts
export async function protectPDF(
  file: File,
  userPassword: string,
  ownerPassword?: string
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const out = await doc.save({
      userPassword,
      ownerPassword: ownerPassword || userPassword,
    });
    const blob = new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" });
    return {
      success: true,
      blob,
      filename: file.name.replace(/\.pdf$/i, "_protected.pdf"),
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Protection failed." };
  }
}
```

- [ ] **Step 2: Create app/tools/protect/page.tsx**

```tsx
"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { protectPDF, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function ProtectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showOwner, setShowOwner] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleProtect = async () => {
    if (!file || !password.trim()) return;
    setStatus("processing"); setError("");
    const result = await protectPDF(file, password.trim(), ownerPassword.trim() || undefined);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, "_protected.pdf"));
      setStatus("done");
    } else {
      setError(result.error ?? "Protection failed."); setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setPassword(""); setOwnerPassword(""); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="Protect PDF"
      description="Add password protection to any PDF file."
      icon="🔒"
      steps={file ? undefined : ["Upload your PDF", "Set a password", "Download protected file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="Protect PDF"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Protecting…" : status === "done" ? "✓ Downloaded!" : "Protect & Download →"}
            onPrimary={status === "done" ? reset : handleProtect}
            primaryDisabled={status === "processing" || !password.trim()}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <div className="p-6 bg-gray-50 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a strong password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowOwner(!showOwner)}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
            >
              {showOwner ? "▲ Hide" : "▼ Advanced options"}
            </button>
            {showOwner && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Owner password (optional)</label>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Leave blank to use same password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <p className="text-xs text-gray-400 mt-1">Owner password controls editing and printing restrictions.</p>
              </div>
            )}
            {status === "done" && <p className="text-sm text-green-600 font-semibold">✓ PDF protected and downloaded</p>}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/pdf-tools.ts app/tools/protect/page.tsx
git commit -m "feat(A3): add Protect PDF tool with RC4-128 password encryption"
```

---

## Task 7: Update UploadZone display text + ToolShell MORE_TOOLS

**Files:**
- Modify: `components/UploadZone.tsx`
- Modify: `components/ToolShell.tsx`

- [ ] **Step 1: Update UploadZone.tsx line 88**

Find: `"up to 10MB per file (free)"`
Replace with: `"up to 200MB per file"`

- [ ] **Step 2: Fix ToolShell icon prop destructure bug**

In `components/ToolShell.tsx` line 30, the function signature omits `icon` from destructuring. Find:
```ts
export default function ToolShell({ name, description, svgIcon, steps, children }: ToolShellProps) {
```
Replace with:
```ts
export default function ToolShell({ name, description, icon, svgIcon, steps, children }: ToolShellProps) {
```
(The `icon` variable doesn't need to be used yet — this just prevents the TypeScript "unused prop" issue for new tool pages that pass it.)

- [ ] **Step 3: Add new tools to MORE_TOOLS in ToolShell.tsx**

Find the `MORE_TOOLS` array closing bracket (after `{ name: "Repair PDF", href: "/tools/repair" },`) and add three entries:
```ts
  { name: "Protect PDF", href: "/tools/protect" },
  { name: "PDF to Word", href: "/tools/pdf-to-word" },
  { name: "Batch Processing", href: "/tools/batch" },
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/UploadZone.tsx components/ToolShell.tsx
git commit -m "feat(A4/B): update file size text to 200MB, fix ToolShell icon prop, add new tools to footer"
```

---

## Task 8: Update app/tools/page.tsx

**Files:**
- Modify: `app/tools/page.tsx`

- [ ] **Step 1: Read the full file**

Read `app/tools/page.tsx` to understand the full TOOLS array and CATEGORIES.

- [ ] **Step 2: Update TOOLS array**

Make these changes:
1. Import `ToolIcon` at the top
2. Rename `svg` → `icon` on every entry, replace inline SVG value with appropriate `<ToolIcon .../>` (use the icon definitions table from the spec)
3. Recategorize: Compress → "Convert PDF", Watermark/Page Numbers/Sign → "Edit & Security", Repair → "Edit & Security", Page Numbers → "Organize PDF"
4. Add three new entries at the end:
```ts
{ name: "Protect PDF", route: "/tools/protect", category: "Edit & Security",
  desc: "Add password protection to any PDF.", badge: "NEW",
  icon: <ToolIcon variant="single" bgColor="#fdf4ff" badgeColor="#a855f7" badgeLabel="PDF" /> },
{ name: "PDF to Word", route: "/tools/pdf-to-word", category: "Convert PDF",
  desc: "Export as an editable .docx file.", badge: "NEW",
  icon: <ToolIcon variant="double" bgColor="#eff6ff" badgeColor="#ef4444" badgeLabel="PDF" badgeColor2="#2563eb" badgeLabel2="DOC" /> },
{ name: "Batch Processing", route: "/tools/batch", category: "Edit & Security",
  desc: "Apply one tool to many files at once.",
  icon: <ToolIcon variant="single" bgColor="#f0fdf4" badgeColor="#22c55e" badgeLabel="PDF" /> },
```

- [ ] **Step 3: Update CATEGORIES array (line 88)**

Replace: `["All", "Organize PDF", "Convert PDF", "Edit PDF", "PDF Security"]`
With: `["All", "Organize PDF", "Convert PDF", "Edit & Security"]`

- [ ] **Step 4: Update the grid rendering**

The existing grid renders each tool with an `<a>` tag and `tool.svg`. Update it to use `<ToolCard>` component instead:
```tsx
import ToolCard from "@/components/ToolCard";

// In the grid:
{filtered.map(tool => (
  <ToolCard
    key={tool.route}
    name={tool.name}
    description={tool.desc}
    route={tool.route}
    icon={tool.icon}
  />
))}
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors, no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add app/tools/page.tsx
git commit -m "feat(A1/B): update /tools page with new icons, categories, and new tools"
```

---

## Task 9: Add PDF to Word tool

**Files:**
- Modify: `lib/pdf-tools.ts`
- Create: `app/tools/pdf-to-word/page.tsx`

- [ ] **Step 1: Add pdfToWord to lib/pdf-tools.ts**

Append to `lib/pdf-tools.ts`:

```ts
export async function pdfToWord(
  file: File
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    const { Document, Packer, Paragraph, TextRun } = await import("docx");

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const paragraphs: Paragraph[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // Group items into lines by y-position
      const lineMap = new Map<number, string[]>();
      for (const item of content.items) {
        if ("str" in item && item.str.trim()) {
          const y = Math.round((item as any).transform[5]);
          if (!lineMap.has(y)) lineMap.set(y, []);
          lineMap.get(y)!.push(item.str);
        }
      }

      // Sort lines top-to-bottom (descending y in PDF coords)
      const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
      for (const y of sortedYs) {
        const text = lineMap.get(y)!.join(" ").trim();
        if (text) paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
      }

      // Page break between pages
      if (pageNum < pdf.numPages) {
        paragraphs.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      }
    }

    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    return {
      success: true,
      blob,
      filename: file.name.replace(/\.pdf$/i, ".docx"),
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Conversion failed." };
  }
}
```

- [ ] **Step 2: Create app/tools/pdf-to-word/page.tsx**

```tsx
"use client";
import { useState, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import { pdfToWord, downloadBlob } from "@/lib/pdf-tools";

type Status = "idle" | "ready" | "processing" | "done" | "error";

export default function PdfToWordPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleFile = useCallback((files: File[]) => {
    setFile(files[0]); setStatus("ready"); setError("");
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setStatus("processing"); setError("");
    const result = await pdfToWord(file);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? file.name.replace(/\.pdf$/i, ".docx"));
      setStatus("done");
    } else {
      setError(result.error ?? "Conversion failed."); setStatus("error");
    }
  };

  const reset = () => { setFile(null); setStatus("idle"); setError(""); };
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="PDF to Word"
      description="Convert PDF text content to an editable .docx file. Works best with text-based PDFs."
      icon="📝"
      steps={file ? undefined : ["Upload your PDF", "Click convert", "Download .docx file"]}
    >
      {!file && <UploadZone onFilesAdded={handleFile} />}
      {file && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.5"/><path d="M8 8h8M8 12h8M8 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="PDF to Word"
            subtitle={`${file.name} · ${fmt(file.size)}`}
            onReset={reset}
            primaryLabel={status === "processing" ? "Converting…" : status === "done" ? "✓ Downloaded!" : "Convert to Word →"}
            onPrimary={status === "done" ? reset : handleConvert}
            primaryDisabled={status === "processing"}
          />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}
          <div className="p-8 bg-gray-50 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="3" width="16" height="18" rx="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/>
                <path d="M8 8h8M8 12h8M8 16h5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-400">{fmt(file.size)}</p>
            </div>
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Works best with text-based PDFs. Scanned or image-heavy PDFs may produce limited output.
            </p>
            {status === "done" && <p className="text-sm text-green-600 font-semibold">✓ Converted and downloaded as .docx</p>}
            {status === "error" && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/pdf-tools.ts app/tools/pdf-to-word/page.tsx
git commit -m "feat(C1): add PDF to Word converter using pdfjs-dist + docx"
```

---

## Task 10: Add Batch Processing tool

**Files:**
- Modify: `lib/pdf-tools.ts`
- Create: `app/tools/batch/page.tsx`

**Key existing signatures to know before writing code:**
- `compressPDF(file, quality: "low" | "medium" | "high")` — NOT "screen"/"ebook"/"printer"
- `rotatePDF(file, angle: 90|180|270, pageSelection: "all" | number[])` ✓
- `pdfToJpg(file, dpi?)` returns `ToolResult` with `result.blobs: Blob[]` and `result.filenames: string[]`
- `watermarkPDF(file, opts: WatermarkOptions)` — single opts object; `WatermarkOptions.color` is `"gray" | "red" | "blue"` (not a tuple)
- `UploadZone` already accepts multiple files by default (hardcoded `multiple` in the input)

- [ ] **Step 1: Add batchProcess to lib/pdf-tools.ts**

Append to `lib/pdf-tools.ts`:

```ts
export type BatchOptions =
  | { tool: "compress"; quality: "low" | "medium" | "high" }
  | { tool: "rotate"; angle: 90 | 180 | 270 }
  | { tool: "pdf-to-jpg" }
  | { tool: "watermark"; text: string }
  | { tool: "protect"; password: string };

export async function batchProcess(
  files: File[],
  options: BatchOptions,
  onProgress: (fileIndex: number, status: "processing" | "done" | "error", error?: string) => void
): Promise<Array<{ blob: Blob; filename: string } | null>> {
  const CONCURRENCY = 3;
  const results: Array<{ blob: Blob; filename: string } | null> = new Array(files.length).fill(null);
  let activeCount = 0;
  let nextIndex = 0;

  const processFile = async (i: number): Promise<void> => {
    onProgress(i, "processing");
    try {
      const f = files[i];
      let result: ToolResult;

      if (options.tool === "compress") {
        result = await compressPDF(f, options.quality);
      } else if (options.tool === "rotate") {
        result = await rotatePDF(f, options.angle, "all");
      } else if (options.tool === "pdf-to-jpg") {
        // pdfToJpg returns ToolResult with blobs[] + filenames[]
        // For batch ZIP we use the first page blob
        result = await pdfToJpg(f);
        if (result.success && result.blobs && result.blobs.length > 0) {
          results[i] = { blob: result.blobs[0], filename: result.filenames?.[0] ?? f.name.replace(/\.pdf$/i, "_p1.jpg") };
          onProgress(i, "done");
          return;
        }
      } else if (options.tool === "watermark") {
        result = await watermarkPDF(f, { text: options.text, opacity: 0.3, fontSize: 60, color: "gray" });
      } else {
        result = await protectPDF(f, options.password);
      }

      if (result.success && result.blob) {
        results[i] = { blob: result.blob, filename: result.filename ?? f.name };
        onProgress(i, "done");
      } else {
        onProgress(i, "error", result.error);
      }
    } catch (e: unknown) {
      onProgress(i, "error", e instanceof Error ? e.message : "Error");
    }
  };

  await new Promise<void>((resolve) => {
    const next = () => {
      while (activeCount < CONCURRENCY && nextIndex < files.length) {
        const i = nextIndex++;
        activeCount++;
        processFile(i).then(() => {
          activeCount--;
          next();
          if (activeCount === 0 && nextIndex >= files.length) resolve();
        });
      }
      if (nextIndex >= files.length && activeCount === 0) resolve();
    };
    next();
  });

  return results;
}
```

- [ ] **Step 2: Create app/tools/batch/page.tsx**

Note: PaywallModal integration uses the existing `rizzpdf_bulk_until` localStorage key. Each successfully processed file counts as 1 free use.

```tsx
"use client";
import { useState, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import PaywallModal from "@/components/PaywallModal";
import { batchProcess, BatchOptions, downloadBlob } from "@/lib/pdf-tools";

const FREE_LIMIT = 3;

type FileStatus = "idle" | "processing" | "done" | "error";
interface BatchFile { file: File; status: FileStatus; error?: string; }

const TOOLS = [
  { id: "compress", label: "Compress PDF" },
  { id: "rotate", label: "Rotate PDF" },
  { id: "pdf-to-jpg", label: "PDF to JPG" },
  { id: "watermark", label: "Watermark PDF" },
  { id: "protect", label: "Protect PDF" },
] as const;

function getUsedCount(): number {
  try {
    return parseInt(localStorage.getItem("rizzpdf_use_count") ?? "0", 10);
  } catch { return 0; }
}
function incrementUseCount(n: number) {
  try {
    localStorage.setItem("rizzpdf_use_count", String(getUsedCount() + n));
  } catch {}
}
function isPro(): boolean {
  try {
    const until = localStorage.getItem("rizzpdf_bulk_until");
    return !!until && Date.now() < Number(until);
  } catch { return false; }
}

export default function BatchPage() {
  const [selectedTool, setSelectedTool] = useState<BatchOptions["tool"]>("compress");
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [watermarkText, setWatermarkText] = useState("DRAFT");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Array<{ blob: Blob; filename: string } | null>>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [proMode, setProMode] = useState(false);

  useEffect(() => { setProMode(isPro()); }, []);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles.map(f => ({ file: f, status: "idle" as FileStatus }))]);
    setResults([]);
  }, []);

  const handleProcess = async () => {
    if (!files.length) return;

    // Free tier check
    if (!proMode) {
      const used = getUsedCount();
      const remaining = FREE_LIMIT - used;
      if (remaining <= 0 || files.length > remaining) {
        setShowPaywall(true);
        return;
      }
    }

    setRunning(true);
    setResults([]);

    let options: BatchOptions;
    if (selectedTool === "compress") options = { tool: "compress", quality };
    else if (selectedTool === "rotate") options = { tool: "rotate", angle };
    else if (selectedTool === "pdf-to-jpg") options = { tool: "pdf-to-jpg" };
    else if (selectedTool === "watermark") options = { tool: "watermark", text: watermarkText };
    else options = { tool: "protect", password };

    let successCount = 0;
    const r = await batchProcess(
      files.map(f => f.file),
      options,
      (i, status, error) => {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status, error } : f));
        if (status === "done") successCount++;
      }
    );
    incrementUseCount(successCount);
    setResults(r);
    setRunning(false);
  };

  const handleDownloadZip = async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    results.forEach((r) => { if (r) zip.file(r.filename, r.blob); });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "rizzpdf-batch.zip");
  };

  const allDone = files.length > 0 && files.every(f => f.status === "done" || f.status === "error");
  const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <ToolShell
      name="Batch Processing"
      description="Apply one tool to multiple PDF files at once."
      icon="📦"
      steps={files.length > 0 ? undefined : ["Choose a tool", "Upload your PDFs", "Download all as ZIP"]}
    >
      <div className="space-y-5">
        {/* Tool selector */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">Select tool</h3>
            <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">PRO — unlimited files</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setSelectedTool(t.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${selectedTool === t.id ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {selectedTool === "compress" && (
            <div className="flex gap-3">
              {(["low", "medium", "high"] as const).map(q => (
                <label key={q} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="radio" name="quality" checked={quality === q} onChange={() => setQuality(q)} />
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </label>
              ))}
            </div>
          )}
          {selectedTool === "rotate" && (
            <div className="flex gap-3">
              {([90, 180, 270] as const).map(a => (
                <label key={a} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="radio" name="angle" checked={angle === a} onChange={() => setAngle(a)} />
                  {a}°
                </label>
              ))}
            </div>
          )}
          {selectedTool === "watermark" && (
            <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
              placeholder="Watermark text" className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-300" />
          )}
          {selectedTool === "protect" && (
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password for all files" className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-300" />
          )}
        </div>

        {/* Upload — UploadZone already supports multiple files */}
        <UploadZone onFilesAdded={handleFilesAdded} />

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-700">{files.length} file{files.length !== 1 ? "s" : ""}</span>
              <div className="flex gap-2">
                {allDone && (
                  <button onClick={handleDownloadZip} className="bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-xl hover:bg-green-700 transition-colors">
                    Download all as ZIP →
                  </button>
                )}
                <button onClick={handleProcess} disabled={running}
                  className="bg-red-600 text-white text-xs font-bold px-4 py-1.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                  {running ? "Processing…" : "Process All →"}
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 truncate max-w-xs">{f.file.name}</p>
                    <p className="text-xs text-gray-400">{fmt(f.file.size)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    f.status === "done" ? "bg-green-100 text-green-700" :
                    f.status === "error" ? "bg-red-100 text-red-600" :
                    f.status === "processing" ? "bg-yellow-100 text-yellow-700 animate-pulse" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {f.status === "done" ? "✓ Done" : f.status === "error" ? `Error${f.error ? `: ${f.error}` : ""}` : f.status === "processing" ? "Processing…" : "Waiting"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} onPay={() => { setProMode(true); setShowPaywall(false); }} />}
    </ToolShell>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/pdf-tools.ts app/tools/batch/page.tsx
git commit -m "feat(C2): add Batch Processing tool with ZIP download"
```

---

## Task 11: Update sitemap.ts

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Add new routes**

The file uses `MetadataRoute.Sitemap` pattern. Append four entries inside the returned array:

```ts
{
  url: `${base}/tools/unlock`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.9,
},
{
  url: `${base}/tools/protect`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.8,
},
{
  url: `${base}/tools/pdf-to-word`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.8,
},
{
  url: `${base}/tools/batch`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.7,
},
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat: add new tool routes to sitemap"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full build check**

Run: `npm run build 2>&1`
Expected: `✓ Compiled successfully` with no TypeScript errors

- [ ] **Step 2: Spot-check routes exist**

Run:
```bash
ls app/tools/unlock/page.tsx
ls app/tools/protect/page.tsx
ls app/tools/pdf-to-word/page.tsx
ls app/tools/batch/page.tsx
ls components/ToolCard.tsx
ls components/ToolIcon.tsx
```
Expected: all 6 files present

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete RizzPDF expansion sub-projects A, B, C

- Homepage redesigned as category tool hub (no unlock hero)
- Unlock PDF moved to /tools/unlock
- All icons updated to iLovePDF document+badge style
- New tools: Protect PDF, PDF to Word, Batch Processing
- 200MB file size display
- Mobile app placeholder
- New ToolCard + ToolIcon shared components

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

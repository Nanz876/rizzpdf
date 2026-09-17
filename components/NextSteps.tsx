"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLastOutput, handOffLastOutput, subscribeOutput } from "@/lib/handoff";

/** Tools that accept a single PDF, in the order most people chain them. */
const CHAIN_TARGETS = [
  { name: "Compress", href: "/tools/compress" },
  { name: "Protect", href: "/tools/protect" },
  { name: "Sign", href: "/tools/sign" },
  { name: "Fill form", href: "/tools/fill-form" },
  { name: "Redact", href: "/tools/redact" },
  { name: "Crop", href: "/tools/crop" },
  { name: "Flatten", href: "/tools/flatten" },
  { name: "Watermark", href: "/tools/watermark" },
  { name: "Page numbers", href: "/tools/page-numbers" },
  { name: "Merge with others", href: "/tools/merge" },
  { name: "Organize", href: "/tools/organize" },
  { name: "Rotate", href: "/tools/rotate" },
  { name: "Split", href: "/tools/split" },
  { name: "Delete pages", href: "/tools/delete-pages" },
  { name: "PDF to Word", href: "/tools/pdf-to-word" },
  { name: "PDF to JPG", href: "/tools/pdf-to-jpg" },
];

export default function NextSteps() {
  const pathname = usePathname();
  const router = useRouter();
  const output = useSyncExternalStore(subscribeOutput, getLastOutput, () => null);

  if (!output || output.fromPath !== pathname) return null;

  const continueWith = (href: string) => {
    if (handOffLastOutput()) router.push(href);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-sm font-semibold text-gray-900">
        Keep going with <span className="text-red-600">{output.file.name}</span>
      </p>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">Opens in the next tool instantly — no re-upload, still never leaves your browser.</p>
      <div className="flex flex-wrap gap-2">
        {CHAIN_TARGETS.filter((t) => t.href !== pathname).map((t) => (
          <button
            key={t.href}
            type="button"
            onClick={() => continueWith(t.href)}
            className="px-3.5 py-1.5 border border-gray-200 rounded-full text-sm text-gray-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            {t.name} →
          </button>
        ))}
      </div>
    </div>
  );
}

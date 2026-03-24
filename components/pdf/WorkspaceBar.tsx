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

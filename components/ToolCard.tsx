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

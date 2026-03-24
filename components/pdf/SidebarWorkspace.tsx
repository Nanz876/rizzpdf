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

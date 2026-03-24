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

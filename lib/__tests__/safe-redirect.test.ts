import { describe, it, expect } from "vitest";
import { safeRedirect } from "@/lib/safe-redirect";

describe("safeRedirect", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirect("/pricing?checkout=monthly")).toBe("/pricing?checkout=monthly");
  });

  it("drops anything that could leave the site", () => {
    expect(safeRedirect(undefined)).toBeUndefined();
    expect(safeRedirect("https://evil.example")).toBeUndefined();
    expect(safeRedirect("//evil.example")).toBeUndefined();
    expect(safeRedirect("/\\evil.example")).toBeUndefined();
  });
});

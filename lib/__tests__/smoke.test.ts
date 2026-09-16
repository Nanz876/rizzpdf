import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("has a DOM", () => {
    expect(typeof window).toBe("object");
    expect(typeof localStorage.setItem).toBe("function");
  });
});

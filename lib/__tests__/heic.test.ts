// The heic2any transcode itself needs a browser (WASM + DOM) and is covered by
// the in-browser smoke check. Here we pin the pure detection helper, which
// decides whether a file even goes down the HEIC path.
import { describe, it, expect } from "vitest";
import { isHeic, heicToJpeg } from "@/lib/tools/heic";

const file = (name: string, type = "") => new File([new Uint8Array([0])], name, { type });

describe("isHeic", () => {
  it("detects HEIC/HEIF by MIME type", () => {
    expect(isHeic(file("IMG_0001", "image/heic"))).toBe(true);
    expect(isHeic(file("IMG_0001", "image/heif"))).toBe(true);
    expect(isHeic(file("IMG_0001", "image/heic-sequence"))).toBe(true);
  });

  it("detects HEIC/HEIF by extension when the browser gives no type", () => {
    expect(isHeic(file("photo.heic"))).toBe(true);
    expect(isHeic(file("photo.HEIF"))).toBe(true);
  });

  it("leaves ordinary images alone", () => {
    expect(isHeic(file("photo.jpg", "image/jpeg"))).toBe(false);
    expect(isHeic(file("photo.png", "image/png"))).toBe(false);
    expect(isHeic(file("scan.pdf", "application/pdf"))).toBe(false);
  });

  it("passes non-HEIC files through heicToJpeg untouched", async () => {
    const jpg = file("photo.jpg", "image/jpeg");
    expect(await heicToJpeg(jpg)).toBe(jpg);
  });
});

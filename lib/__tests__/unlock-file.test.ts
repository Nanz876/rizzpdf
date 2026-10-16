// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { unlockFileIfNeeded, clearSessionPassword } from "@/lib/pdf-unlock-file";

// The session password cache is module-level; reset it between tests.
beforeEach(() => clearSessionPassword());

const FIX = path.resolve(__dirname, "../../test-fixtures");
async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}
const bytesOf = async (f: File) => new Uint8Array(await f.arrayBuffer());
const opens = async (f: File) => {
  const doc = await PDFDocument.load(await bytesOf(f));
  return !doc.isEncrypted && doc.getPageCount() > 0;
};

describe("unlockFileIfNeeded", () => {
  it("returns a non-encrypted PDF unchanged, without prompting", async () => {
    const f = await fixture("smoke/plain-text.pdf");
    const prompt = vi.fn();
    const out = await unlockFileIfNeeded(f, prompt);
    expect(out).toBe(f);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("silently decrypts a restriction-only file — no password prompt", async () => {
    const prompt = vi.fn();
    const out = await unlockFileIfNeeded(await fixture("audit/owner-restricted.pdf"), prompt);
    expect(prompt).not.toHaveBeenCalled();
    expect(out).not.toBeNull();
    expect(await opens(out!)).toBe(true);
  });

  it("prompts once and decrypts when the password is correct", async () => {
    const prompt = vi.fn(async () => "rizz123");
    const out = await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith("user-password.pdf", false);
    expect(await opens(out!)).toBe(true);
  });

  it("re-prompts on a wrong password (flagging it) then succeeds", async () => {
    const answers = ["nope", "rizz123"];
    const prompt = vi.fn(async () => answers.shift() ?? null);
    const out = await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(prompt).toHaveBeenNthCalledWith(1, "user-password.pdf", false);
    expect(prompt).toHaveBeenNthCalledWith(2, "user-password.pdf", true); // wrong flag set
    expect(await opens(out!)).toBe(true);
  });

  it("returns null when the user cancels the prompt", async () => {
    const prompt = vi.fn(async () => null);
    const out = await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    expect(out).toBeNull();
  });

  it("caches the session password so a second file with the same password doesn't prompt", async () => {
    const prompt = vi.fn(async () => "rizz123");
    const a = await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    const b = await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    expect(prompt).toHaveBeenCalledTimes(1); // only the first file prompted
    expect(await opens(a!)).toBe(true);
    expect(await opens(b!)).toBe(true);
  });

  it("re-prompts after the session password is cleared", async () => {
    const prompt = vi.fn(async () => "rizz123");
    await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    clearSessionPassword();
    await unlockFileIfNeeded(await fixture("audit/user-password.pdf"), prompt);
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it("leaves non-PDF files alone", async () => {
    const img = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
    const prompt = vi.fn();
    expect(await unlockFileIfNeeded(img, prompt)).toBe(img);
    expect(prompt).not.toHaveBeenCalled();
  });
});

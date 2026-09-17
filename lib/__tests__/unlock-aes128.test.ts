// @vitest-environment node
// Covers lossless AES-128 (V4/R4, /CFM /AESV2) unlocking — lib/pdf-decrypt.ts,
// used by unlockPDF for every Standard Security Handler variant. Fixtures are
// generated + independently verified against pdf.js in
// scripts/generate-audit-fixtures.mjs.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { unlockPDF } from "@/lib/pdf-unlock";

const FIX = path.resolve(__dirname, "../../test-fixtures");

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function pageTexts(bytes: Uint8Array, password?: string): Promise<string[]> {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await real.getDocument({ data: bytes.slice(), password, isEvalSupported: false, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

describe("unlock: AES-128 (V4/R4 crypt filters)", () => {
  it("removes owner-only restrictions with no password and keeps text selectable", async () => {
    const r = await unlockPDF(await fixture("audit/aes128-owner-restricted.pdf"), "");
    expect(r.success).toBe(true);
    expect(r.warning).toBeFalsy();
    const bytes = await bytesOf(r.blob!);
    expect((await PDFDocument.load(bytes)).isEncrypted).toBe(false);
    expect((await pageTexts(bytes))[0]).toContain("Quarterly Report");
  });

  it("removes an open password and keeps text selectable", async () => {
    const r = await unlockPDF(await fixture("audit/aes128-user-password.pdf"), "rizz123");
    expect(r.success).toBe(true);
    expect(r.warning).toBeFalsy();
    const bytes = await bytesOf(r.blob!);
    expect((await PDFDocument.load(bytes)).isEncrypted).toBe(false);
    expect((await pageTexts(bytes))[0]).toContain("Quarterly Report");
  });

  it("reports a wrong password clearly", async () => {
    const r = await unlockPDF(await fixture("audit/aes128-user-password.pdf"), "nope");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Wrong password/i);
  });

  it("asks for a password when a file needs one and none was given", async () => {
    const r = await unlockPDF(await fixture("audit/aes128-user-password.pdf"), "");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/needs its open password/i);
  });
});

describe("unlock: existing RC4/AES-256 coverage still passes", () => {
  it("removes restrictions with no password and keeps text selectable (AES-256)", async () => {
    const r = await unlockPDF(await fixture("audit/owner-restricted.pdf"), "");
    expect(r.success).toBe(true);
    expect(r.warning).toBeFalsy();
    const bytes = await bytesOf(r.blob!);
    expect((await PDFDocument.load(bytes)).isEncrypted).toBe(false);
    expect((await pageTexts(bytes))[0]).toContain("Quarterly Report");
  });

  it("removes an open password and keeps text selectable (AES-256)", async () => {
    const r = await unlockPDF(await fixture("audit/user-password.pdf"), "rizz123");
    expect(r.success).toBe(true);
    expect(r.warning).toBeFalsy();
    expect((await pageTexts(await bytesOf(r.blob!)))[0]).toContain("Quarterly Report");
  });

  it("reports a wrong password clearly (AES-256)", async () => {
    const r = await unlockPDF(await fixture("audit/user-password.pdf"), "nope");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password/i);
  });

  it("asks for a password when a file needs one and none was given (AES-256)", async () => {
    const r = await unlockPDF(await fixture("audit/user-password.pdf"), "");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/password/i);
  });
});

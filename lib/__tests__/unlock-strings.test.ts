// @vitest-environment node
// Covers the literal-string escaping fix in lib/pdf-decrypt.ts: decrypted
// bytes written back into a PDFString (literal, parenthesized) must be
// PDF-escaped or a decrypted `(`, `)`, `\` or high-bit byte corrupts the
// file's syntax. Fixtures (strings-{rc4128,aes128,aes256}-*.pdf) carry an
// Info /Title and a form field /V that are literal strings containing an
// unescaped backslash and an unbalanced `)`, generated + independently
// verified against pdf.js in scripts/generate-audit-fixtures.mjs.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, PDFString } from "pdf-lib";

const require = createRequire(import.meta.url);

vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { unlockPDF } from "@/lib/pdf-unlock";
import { escapeLiteralBytes } from "@/lib/pdf-decrypt";

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

const TITLE_TEXT = "Report (Q1) \\ total) draft"; // one backslash, unbalanced ")"
const FIELD_TEXT = "(555) 123\\4567)"; // one backslash, unbalanced ")"

describe("escapeLiteralBytes round-trips through PDFString.asBytes()", () => {
  it("round-trips every single byte value 0-255", () => {
    for (let b = 0; b <= 255; b++) {
      const bytes = new Uint8Array([b]);
      const str = PDFString.of(escapeLiteralBytes(bytes));
      expect(Array.from(str.asBytes())).toEqual(Array.from(bytes));
    }
  });

  it("round-trips backslash, parens, CR and unbalanced-paren strings", () => {
    const cases = [TITLE_TEXT, FIELD_TEXT, "\\", "(", ")", "((()))", ")))(((", "a\\b\\c", "line1\rline2", "\r\r\r"];
    for (const text of cases) {
      const bytes = new TextEncoder().encode(text);
      const str = PDFString.of(escapeLiteralBytes(bytes));
      expect(Array.from(str.asBytes())).toEqual(Array.from(bytes));
    }
  });

  it("round-trips arbitrary binary (all bytes 0-255 in one string, including high-bit)", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const str = PDFString.of(escapeLiteralBytes(bytes));
    expect(Array.from(str.asBytes())).toEqual(Array.from(bytes));
  });
});

const VARIANTS: { tag: string; label: string }[] = [
  { tag: "rc4128", label: "RC4-128 (V2/R3)" },
  { tag: "aes128", label: "AES-128 (V4/R4)" },
  { tag: "aes256", label: "AES-256 (V5/R6)" },
];

for (const { tag, label } of VARIANTS) {
  describe(`unlock: literal-string edge cases — ${label}`, () => {
    it("owner-restricted: unlocks with no password, title and field survive exactly", async () => {
      const r = await unlockPDF(await fixture(`audit/strings-${tag}-owner-restricted.pdf`), "");
      expect(r.success).toBe(true);
      expect(r.warning).toBeFalsy();
      const bytes = await bytesOf(r.blob!);
      const doc = await PDFDocument.load(bytes);
      expect(doc.isEncrypted).toBe(false);
      expect(doc.getTitle()).toBe(TITLE_TEXT);
      expect(doc.getForm().getTextField("edgeCase").getText()).toBe(FIELD_TEXT);
      expect((await pageTexts(bytes))[0]).toContain("Quarterly Report");
    });

    it("user-password: unlocks with the correct password, title and field survive exactly", async () => {
      const r = await unlockPDF(await fixture(`audit/strings-${tag}-user-password.pdf`), "rizz123");
      expect(r.success).toBe(true);
      expect(r.warning).toBeFalsy();
      const bytes = await bytesOf(r.blob!);
      const doc = await PDFDocument.load(bytes);
      expect(doc.isEncrypted).toBe(false);
      expect(doc.getTitle()).toBe(TITLE_TEXT);
      expect(doc.getForm().getTextField("edgeCase").getText()).toBe(FIELD_TEXT);
      expect((await pageTexts(bytes))[0]).toContain("Quarterly Report");
    });

    it("reports a wrong password clearly", async () => {
      const r = await unlockPDF(await fixture(`audit/strings-${tag}-user-password.pdf`), "nope");
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/Wrong password/i);
    });

    it("asks for a password when none was given", async () => {
      const r = await unlockPDF(await fixture(`audit/strings-${tag}-user-password.pdf`), "");
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/needs its open password/i);
    });
  });
}

describe("loadPdf (used by every editing tool) keeps tricky strings intact", () => {
  it("decrypts a restricted file with a backslash and unbalanced parenthesis in its title", async () => {
    const { loadPdf } = await import("@/lib/pdf-load");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    for (const alg of ["rc4128", "aes128", "aes256"]) {
      const bytes = await fs.readFile(path.resolve(__dirname, `../../test-fixtures/audit/strings-${alg}-owner-restricted.pdf`));
      const doc = await loadPdf(new Uint8Array(bytes));
      const reloaded = await (await import("pdf-lib")).PDFDocument.load(await doc.save());
      expect(reloaded.getTitle()).toBe(`Report (Q1) ${String.fromCharCode(92)} total) draft`);
    }
  });
});

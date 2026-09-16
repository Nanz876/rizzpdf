// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const encryptPDF = vi.fn(async (bytes: Uint8Array, _pw: string, _opts: unknown) => { void _pw; void _opts; return bytes; });
vi.mock("@pdfsmaller/pdf-encrypt", () => ({ encryptPDF }));

import { protectPDF } from "@/lib/pdf-tools";

const fixture = async () =>
  new File([await fs.readFile(path.resolve(__dirname, "../../test-fixtures/audit/structured-doc.pdf"))], "doc.pdf", { type: "application/pdf" });

describe("protectPDF owner password", () => {
  it("uses a random owner password when none is given, so the open password can't lift restrictions", async () => {
    await protectPDF(await fixture(), "s3cret");
    const opts = encryptPDF.mock.calls[0][2] as unknown as { ownerPassword: string; algorithm: string };
    expect(opts.algorithm).toBe("AES-256");
    expect(opts.ownerPassword).not.toBe("s3cret");
    expect(opts.ownerPassword.length).toBeGreaterThanOrEqual(32);
  });

  it("uses the owner password when provided", async () => {
    encryptPDF.mockClear();
    await protectPDF(await fixture(), "s3cret", "boss");
    expect((encryptPDF.mock.calls[0][2] as unknown as { ownerPassword: string }).ownerPassword).toBe("boss");
  });
});

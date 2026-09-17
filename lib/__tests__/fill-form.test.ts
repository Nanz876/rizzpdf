// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, degrees, decodePDFRawStream, PDFRawStream } from "pdf-lib";

const require = createRequire(import.meta.url);

// Same pdfjs-dist mock used by lib/__tests__/tools.audit.test.ts: the app sets a
// browser workerSrc URL, which the node test environment can't resolve.
vi.mock("pdfjs-dist", async () => {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  real.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return { ...real, GlobalWorkerOptions: { workerSrc: "" } };
});

import { readFormFields, fillForm } from "@/lib/tools/fill-form";

const FIX = path.resolve(__dirname, "../../test-fixtures");
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

async function fixture(rel: string): Promise<File> {
  const bytes = await fs.readFile(path.join(FIX, rel));
  return new File([bytes], path.basename(rel), { type: "application/pdf" });
}

async function openPdfjs(bytes: Uint8Array) {
  const real = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return real.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await openPdfjs(bytes);
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

// Form field values live in annotation appearance streams, not the page content
// stream, so pdf.js's getTextContent() (used above) never sees them unless the
// form is flattened. To confirm an appearance was actually generated for an
// unflattened field, decode its normal-appearance content stream directly and
// look for the value's hex-encoded PDF string operand.
function toPdfHex(s: string): string {
  return [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function widgetAppearanceText(doc: PDFDocument, fieldName: string): string {
  const widget = doc.getForm().getField(fieldName).acroField.getWidgets()[0];
  const stream = doc.context.lookup(widget.getNormalAppearance()) as PDFRawStream;
  return new TextDecoder().decode(decodePDFRawStream(stream).decode());
}

// ─── Fixture: page 1 has one of every field type, page 2 is rotated 90°. ─────
// Geometry is recorded here (not just baked into the PDF) so the widget-position
// assertions below can be derived independently of the implementation under test.
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter
const FULLNAME_RECT = { x: 50, y: 700, width: 200, height: 20 };
const SIG_DATE_RECT = { x: 50, y: 700, width: 150, height: 20 };

async function buildFormFixture(): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  const page1 = doc.addPage(PAGE_SIZE);

  const fullName = form.createTextField("fullName");
  fullName.addToPage(page1, { ...FULLNAME_RECT, font });

  const notes = form.createTextField("notes");
  notes.enableMultiline();
  notes.addToPage(page1, { x: 50, y: 600, width: 300, height: 60, font });

  const zip = form.createTextField("zip");
  zip.setMaxLength(5);
  zip.addToPage(page1, { x: 50, y: 560, width: 80, height: 20, font });

  const agree = form.createCheckBox("agree");
  agree.addToPage(page1, { x: 50, y: 520, width: 20, height: 20 });

  const plan = form.createRadioGroup("plan");
  plan.addOptionToPage("basic", page1, { x: 50, y: 480, width: 20, height: 20 });
  plan.addOptionToPage("pro", page1, { x: 90, y: 480, width: 20, height: 20 });

  const country = form.createDropdown("country");
  country.addOptions(["US", "JM", "CA"]);
  country.addToPage(page1, { x: 50, y: 440, width: 100, height: 20, font });

  const ref = form.createTextField("ref");
  ref.addToPage(page1, { x: 50, y: 400, width: 100, height: 20, font });
  ref.setText("ABC");
  ref.enableReadOnly();

  const page2 = doc.addPage(PAGE_SIZE);
  page2.setRotation(degrees(90));
  const sigDate = form.createTextField("sig_date");
  sigDate.addToPage(page2, { ...SIG_DATE_RECT, font });

  const bytes = await doc.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], "form.pdf", { type: "application/pdf" });
}

describe("readFormFields", () => {
  it("returns every field with its type, options, readOnly and value", async () => {
    const fields = await readFormFields(await buildFormFixture());
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(Object.keys(byName).sort()).toEqual(
      ["agree", "country", "fullName", "notes", "plan", "ref", "sig_date", "zip"].sort()
    );

    expect(byName.fullName.type).toBe("text");
    expect(byName.fullName.readOnly).toBe(false);
    expect(byName.fullName.multiline).toBe(false);

    expect(byName.notes.type).toBe("text");
    expect(byName.notes.multiline).toBe(true);

    expect(byName.zip.type).toBe("text");
    expect(byName.zip.maxLength).toBe(5);

    expect(byName.agree.type).toBe("checkbox");
    expect(byName.agree.value).toBe(false);

    expect(byName.plan.type).toBe("radio");
    expect(byName.plan.options?.sort()).toEqual(["basic", "pro"]);

    expect(byName.country.type).toBe("dropdown");
    expect(byName.country.options).toEqual(["US", "JM", "CA"]);

    expect(byName.ref.readOnly).toBe(true);
    expect(byName.ref.value).toBe("ABC");

    expect(byName.sig_date.type).toBe("text");
  });

  it("maps the fullName widget rect to displayed-page fractions (unrotated page)", async () => {
    const file = await buildFormFixture();
    const fields = await readFormFields(file);
    const w = fields.find((f) => f.name === "fullName")!.widgets[0];
    const [pw, ph] = PAGE_SIZE;

    // pdf-lib pads the requested rect by its default border width when placing the
    // widget, so read back the *actual* on-disk rectangle as the source of truth
    // rather than the nominal FULLNAME_RECT passed to addToPage.
    const raw = await PDFDocument.load(await file.arrayBuffer());
    const rect = raw.getForm().getTextField("fullName").acroField.getWidgets()[0].getRectangle();

    expect(w.page).toBe(1);
    expect(w.x).toBeCloseTo(rect.x / pw, 3);
    expect(w.w).toBeCloseTo(rect.width / pw, 3);
    expect(w.y).toBeCloseTo(1 - (rect.y + rect.height) / ph, 3);
    expect(w.h).toBeCloseTo(rect.height / ph, 3);
  });

  it("maps the sig_date widget rect on the 90°-rotated page to the displayed orientation", async () => {
    const file = await buildFormFixture();
    const fields = await readFormFields(file);
    const w = fields.find((f) => f.name === "sig_date")!.widgets[0];
    const [pw, ph] = PAGE_SIZE; // original (unrotated) page is 612x792

    const raw = await PDFDocument.load(await file.arrayBuffer());
    const rect = raw.getForm().getTextField("sig_date").acroField.getWidgets()[0].getRectangle();

    // Displayed page is landscape (792x612) since the page is rotated 90°.
    // Derive expected fractions independently via the inverse of the toUser mapping
    // used elsewhere in the app (lib/pdf-load.ts displayedPage): for rotation 90,
    // dx = uy, dy = pw - ux (crop origin is (0,0) here).
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.width, rect.y],
      [rect.x, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height],
    ].map(([ux, uy]) => ({ dx: uy, dy: pw - ux }));
    const dxs = corners.map((c) => c.dx);
    const dys = corners.map((c) => c.dy);
    const dispW = ph; // crop.height
    const dispH = pw; // crop.width
    const expected = {
      x: Math.min(...dxs) / dispW,
      y: 1 - Math.max(...dys) / dispH,
      w: (Math.max(...dxs) - Math.min(...dxs)) / dispW,
      h: (Math.max(...dys) - Math.min(...dys)) / dispH,
    };

    expect(w.page).toBe(2);
    expect(w.x).toBeCloseTo(expected.x, 3);
    expect(w.y).toBeCloseTo(expected.y, 3);
    expect(w.w).toBeCloseTo(expected.w, 3);
    expect(w.h).toBeCloseTo(expected.h, 3);
  });

  it("reads the existing form-metadata fixture fine", async () => {
    const fields = await readFormFields(await fixture("audit/form-metadata.pdf"));
    expect(fields.map((f) => f.name)).toContain("fullName");
  });
});

describe("fillForm", () => {
  const values = {
    fullName: "Jane Doe",
    notes: "Line one\nLine two",
    zip: "12345",
    agree: true,
    plan: "pro",
    country: "JM",
    ref: "should-not-apply",
    sig_date: "2026-09-16",
  };

  it("sets every field type and generates appearances", async () => {
    const r = await fillForm(await buildFormFixture(), values);
    expect(r.success).toBe(true);
    const bytes = await bytesOf(r.blob!);

    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    expect(form.getTextField("fullName").getText()).toBe("Jane Doe");
    expect(form.getTextField("notes").getText()).toBe("Line one\nLine two");
    expect(form.getTextField("zip").getText()).toBe("12345");
    expect(form.getCheckBox("agree").isChecked()).toBe(true);
    expect(form.getRadioGroup("plan").getSelected()).toBe("pro");
    expect(form.getDropdown("country").getSelected()).toContain("JM");
    expect(form.getTextField("sig_date").getText()).toBe("2026-09-16");
    // Read-only field is left untouched.
    expect(form.getTextField("ref").getText()).toBe("ABC");

    // Appearance streams were (re)generated with the new value — this is what makes
    // the typed name actually visible in a viewer (form field values live in
    // annotation appearance streams, not the page content stream pdf.js's
    // getTextContent() reads, so that's checked separately below for the flattened case).
    expect(widgetAppearanceText(doc, "fullName")).toContain(toPdfHex("Jane Doe"));
  });

  it("flatten removes all fields but keeps the text visible", async () => {
    const r = await fillForm(await buildFormFixture(), values, { flatten: true });
    expect(r.success).toBe(true);
    const bytes = await bytesOf(r.blob!);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getForm().getFields()).toHaveLength(0);
    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain("Jane Doe");
  });

  it("errors naming the field when text exceeds maxLength", async () => {
    const r = await fillForm(await buildFormFixture(), { zip: "123456" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/zip/);
  });

  it("errors naming the field for non-Latin text", async () => {
    const r = await fillForm(await buildFormFixture(), { fullName: "こんにちは" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/fullName/);
    expect(r.error).toMatch(/Latin letters/i);
  });

  it("errors on an unknown dropdown option", async () => {
    const r = await fillForm(await buildFormFixture(), { country: "ZZ" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/country/);
  });

  it("leaves a read-only field's value unchanged", async () => {
    const r = await fillForm(await buildFormFixture(), { ref: "changed" });
    expect(r.success).toBe(true);
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    expect(doc.getForm().getTextField("ref").getText()).toBe("ABC");
  });

  it("fills the existing form-metadata fixture fine", async () => {
    const r = await fillForm(await fixture("audit/form-metadata.pdf"), { fullName: "Test User" });
    expect(r.success).toBe(true);
    const doc = await PDFDocument.load(await bytesOf(r.blob!));
    expect(doc.getForm().getTextField("fullName").getText()).toBe("Test User");
  });

  it("gives a clear no-fields error for a plain PDF", async () => {
    const r = await fillForm(await fixture("smoke/plain-text.pdf"), {});
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no fillable form fields/i);
  });
});

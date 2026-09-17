// lib/tools/fill-form.ts
// Fill PDF Forms: read AcroForm field metadata (with widget positions mapped to the
// displayed page) and fill values into text/checkbox/radio/dropdown/optionList fields.
import {
  PDFDocument,
  PDFPage,
  PDFField,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  PDFSignature,
  PDFButton,
  PDFWidgetAnnotation,
  PDFRef,
  PDFFont,
  StandardFonts,
} from "pdf-lib";
import { loadPdf, saveToBlob, toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

export interface FormFieldInfo {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "optionList" | "signature" | "button" | "unknown";
  value: string | boolean | string[];
  options?: string[];
  readOnly: boolean;
  required: boolean;
  multiline?: boolean;
  maxLength?: number;
  /** Where this field's widget(s) sit on the page, as fractions of the DISPLAYED page (top-left origin). */
  widgets: { page: number; x: number; y: number; w: number; h: number }[];
}

const NO_FIELDS_ERROR =
  "This PDF has no fillable form fields. To add text anywhere on a PDF, use the Sign tool's Add text.";
const XFA_ERROR =
  "This PDF uses XFA form fields (often from Adobe LiveCycle), which aren't supported. Try the Sign tool's Add text instead.";

const latinTextError = (name: string) => `"${name}" can use Latin letters, numbers and common symbols only.`;
const unknownOptionError = (name: string, option: string) => `"${name}" doesn't have an option called "${option}".`;
const maxLengthError = (name: string, max: number) => `"${name}" allows at most ${max} character${max === 1 ? "" : "s"}.`;

function baseName(file: File): string {
  return file.name.replace(/\.pdf$/i, "");
}

function normalizedRotation(page: PDFPage): 0 | 90 | 180 | 270 {
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  return ((Math.round(r / 90) * 90) % 360) as 0 | 90 | 180 | 270;
}

/**
 * Map a widget rectangle (in the page's own, unrotated user space — same space as
 * `getRectangle()` and the crop box) to a fraction-of-displayed-page rect with a
 * top-left origin. This is the inverse of `displayedPage(page).toUser` in
 * lib/pdf-load.ts, worked out for each of the four axis-aligned /Rotate values.
 */
function widgetToDisplayedFraction(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number }
): { x: number; y: number; w: number; h: number } {
  const crop = page.getCropBox();
  const rotation = normalizedRotation(page);
  const x0 = crop.x;
  const y0 = crop.y;
  const x1 = crop.x + crop.width;
  const y1 = crop.y + crop.height;
  const sideways = rotation === 90 || rotation === 270;
  const dispW = sideways ? crop.height : crop.width;
  const dispH = sideways ? crop.width : crop.height;

  // (dx, dy) is the y-up, bottom-left-origin coordinate on the DISPLAYED page —
  // the same space `displayedPage().toUser(dx, dy)` maps back into user space.
  function fromUser(ux: number, uy: number): { dx: number; dy: number } {
    switch (rotation) {
      case 90:
        return { dx: uy - y0, dy: x1 - ux };
      case 180:
        return { dx: x1 - ux, dy: y1 - uy };
      case 270:
        return { dx: y1 - uy, dy: ux - x0 };
      default:
        return { dx: ux - x0, dy: uy - y0 };
    }
  }

  const corners = [
    fromUser(rect.x, rect.y),
    fromUser(rect.x + rect.width, rect.y),
    fromUser(rect.x, rect.y + rect.height),
    fromUser(rect.x + rect.width, rect.y + rect.height),
  ];
  const dxs = corners.map((c) => c.dx);
  const dys = corners.map((c) => c.dy);
  const dxMin = Math.min(...dxs);
  const dxMax = Math.max(...dxs);
  const dyMin = Math.min(...dys);
  const dyMax = Math.max(...dys);

  return {
    x: dispW ? dxMin / dispW : 0,
    y: dispH ? 1 - dyMax / dispH : 0,
    w: dispW ? (dxMax - dxMin) / dispW : 0,
    h: dispH ? (dyMax - dyMin) / dispH : 0,
  };
}

/** Find which page a widget lives on, via its /P entry or (failing that) each page's /Annots. */
function findWidgetPageIndex(doc: PDFDocument, pages: PDFPage[], widget: PDFWidgetAnnotation): number {
  const pRef = widget.P();
  if (pRef) {
    const idx = pages.findIndex((p) => p.ref === pRef);
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < pages.length; i++) {
    const annots = pages[i].node.Annots();
    if (!annots) continue;
    for (let j = 0; j < annots.size(); j++) {
      const ref = annots.get(j);
      if (ref instanceof PDFRef && doc.context.lookup(ref) === widget.dict) return i;
    }
  }
  return 0;
}

function fieldType(field: PDFField): FormFieldInfo["type"] {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "optionList";
  if (field instanceof PDFSignature) return "signature";
  if (field instanceof PDFButton) return "button";
  return "unknown";
}

function fieldValue(field: PDFField): string | boolean | string[] {
  if (field instanceof PDFTextField) return field.getText() ?? "";
  if (field instanceof PDFCheckBox) return field.isChecked();
  if (field instanceof PDFRadioGroup) return field.getSelected() ?? "";
  if (field instanceof PDFDropdown) return field.getSelected();
  if (field instanceof PDFOptionList) return field.getSelected();
  return "";
}

function fieldOptions(field: PDFField): string[] | undefined {
  if (field instanceof PDFRadioGroup) return field.getOptions();
  if (field instanceof PDFDropdown) return field.getOptions();
  if (field instanceof PDFOptionList) return field.getOptions();
  return undefined;
}

/** Read every AcroForm field's metadata, value and on-page widget position(s). */
export async function readFormFields(file: File): Promise<FormFieldInfo[]> {
  let doc: PDFDocument;
  try {
    doc = await loadPdf(file);
  } catch (e) {
    throw new Error(toolErrorMessage(e, "This file couldn't be opened. Make sure it's a valid PDF."));
  }

  const form = doc.getForm();
  const pages = doc.getPages();

  return form.getFields().map((field) => {
    const type = fieldType(field);
    const widgets = field.acroField.getWidgets().map((widget) => {
      const pageIndex = findWidgetPageIndex(doc, pages, widget);
      const frac = widgetToDisplayedFraction(pages[pageIndex], widget.getRectangle());
      return { page: pageIndex + 1, ...frac };
    });

    const info: FormFieldInfo = {
      name: field.getName(),
      type,
      value: fieldValue(field),
      options: fieldOptions(field),
      readOnly: field.isReadOnly(),
      required: field.isRequired(),
      widgets,
    };
    if (field instanceof PDFTextField) {
      info.multiline = field.isMultiline();
      info.maxLength = field.getMaxLength();
    }
    return info;
  });
}

/**
 * Whether the Helvetica standard font can encode `text`. Checked line-by-line
 * (splitting on the newlines multiline text fields allow) since WinAnsiEncoding,
 * which standard fonts use, has no glyph for the newline control character itself.
 */
function isEncodable(font: PDFFont, text: string): boolean {
  try {
    for (const line of text.split(/\r\n|\r|\n/)) if (line) font.encodeText(line);
    return true;
  } catch {
    return false;
  }
}

/** Fill values into a PDF's form fields (and optionally flatten it afterwards). */
export async function fillForm(
  file: File,
  values: Record<string, string | boolean | string[]>,
  opts?: { flatten?: boolean }
): Promise<ToolResult> {
  try {
    const doc = await loadPdf(file);
    const form = doc.getForm();
    const fields = form.getFields();

    if (fields.length === 0) {
      if (form.hasXFA()) return { success: false, error: XFA_ERROR };
      return { success: false, error: NO_FIELDS_ERROR };
    }

    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (const field of fields) {
      const name = field.getName();
      if (!(name in values)) continue;
      if (field.isReadOnly()) continue;
      const value = values[name];

      if (field instanceof PDFTextField) {
        const text = value == null ? "" : String(value);
        const maxLen = field.getMaxLength();
        if (maxLen !== undefined && text.length > maxLen) {
          return { success: false, error: maxLengthError(name, maxLen) };
        }
        if (!isEncodable(font, text)) {
          return { success: false, error: latinTextError(name) };
        }
        field.setText(text);
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        const option = value == null ? "" : String(value);
        if (!option) continue;
        if (!field.getOptions().includes(option)) {
          return { success: false, error: unknownOptionError(name, option) };
        }
        if (!isEncodable(font, option)) {
          return { success: false, error: latinTextError(name) };
        }
        field.select(option);
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const selected = (Array.isArray(value) ? value : value ? [String(value)] : []).filter(Boolean);
        if (!selected.length) continue;
        const editable = field instanceof PDFDropdown && field.isEditable();
        if (!editable) {
          const options = field.getOptions();
          const bad = selected.find((v) => !options.includes(v));
          if (bad !== undefined) return { success: false, error: unknownOptionError(name, bad) };
        }
        const badChars = selected.find((v) => !isEncodable(font, v));
        if (badChars !== undefined) return { success: false, error: latinTextError(name) };
        field.select(selected);
      }
      // Signature, push button and unknown field types have nothing fillable — skip.
    }

    form.updateFieldAppearances(font);
    if (opts?.flatten) form.flatten();

    return { success: true, blob: await saveToBlob(doc), filename: `${baseName(file)}_filled.pdf` };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to fill PDF form.") };
  }
}

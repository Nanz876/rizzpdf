import {
  PDFDocument,
  PDFField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFWidgetAnnotation,
  PDFDict,
  PDFArray,
  PDFName,
  PDFRef,
  PDFRawStream,
  PDFNumber,
  StandardFonts,
  pushGraphicsState,
  popGraphicsState,
  translate,
  drawObject,
  concatTransformationMatrix,
} from "pdf-lib";
import { loadPdf, saveToBlob, toolErrorMessage } from "@/lib/pdf-load";
import type { ToolResult } from "@/lib/pdf-tools";

function baseName(file: File) {
  return file.name.replace(/\.pdf$/i, "");
}

export interface FlattenOptions {
  /** Bake filled-in form field values into the page content; removes the form. */
  forms: boolean;
  /** Bake comment/markup annotations (that have an appearance) into the page content. */
  annotations: boolean;
}

const NOTHING_TO_FLATTEN_WARNING =
  "Nothing to flatten — this PDF has no form fields or annotations.";

// ─── Forms ──────────────────────────────────────────────────────────────────

/**
 * Find the page a widget annotation is drawn on. Reimplements pdf-lib's internal
 * PDFForm helper (which is private) using only the public API, so we can catch
 * failures per-field instead of letting one bad field abort the whole flatten.
 */
function findWidgetPage(doc: PDFDocument, widget: PDFWidgetAnnotation) {
  const pageRef = widget.P();
  let page = pageRef ? doc.getPages().find((p) => p.ref === pageRef) : undefined;
  if (!page) {
    const widgetRef = doc.context.getObjectRef(widget.dict);
    if (widgetRef) page = doc.findPageForAnnotationRef(widgetRef);
  }
  if (!page) throw new Error("Could not find the page for this field's widget.");
  return page;
}

/** Mirrors pdf-lib's private PDFForm#findWidgetAppearanceRef using only public API. */
function findWidgetAppearanceRef(field: PDFField, widget: PDFWidgetAnnotation): PDFRef {
  let refOrDict = widget.getNormalAppearance();
  if (refOrDict instanceof PDFDict && (field instanceof PDFCheckBox || field instanceof PDFRadioGroup)) {
    const value = field.acroField.getValue();
    const ref = refOrDict.get(value) ?? refOrDict.get(PDFName.of("Off"));
    if (ref instanceof PDFRef) refOrDict = ref;
  }
  if (!(refOrDict instanceof PDFRef)) {
    throw new Error(`Failed to extract appearance ref for: ${field.getName()}`);
  }
  return refOrDict;
}

/**
 * Flatten every form field, catching failures per field: a field whose appearance
 * can't be generated (e.g. an unsupported field type) is left untouched rather
 * than aborting the whole operation. Returns the names of any skipped fields.
 */
async function flattenFormFields(doc: PDFDocument): Promise<{ fieldCount: number; skipped: string[] }> {
  const form = doc.getForm();
  const fields = form.getFields();
  if (!fields.length) return { fieldCount: 0, skipped: [] };

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const skipped: string[] = [];

  for (const field of fields) {
    try {
      if (field.needsAppearancesUpdate()) field.defaultUpdateAppearances(font);
      const widgets = field.acroField.getWidgets();
      for (const widget of widgets) {
        const page = findWidgetPage(doc, widget);
        const widgetRef = findWidgetAppearanceRef(field, widget);
        const xObjectKey = page.node.newXObject("FlatWidget", widgetRef);
        const rect = widget.getRectangle();
        page.pushOperators(
          pushGraphicsState(),
          translate(rect.x, rect.y),
          drawObject(xObjectKey),
          popGraphicsState()
        );
      }
      form.removeField(field);
    } catch {
      skipped.push(field.getName());
    }
  }

  return { fieldCount: fields.length, skipped };
}

// ─── Annotations ────────────────────────────────────────────────────────────

const KEPT_SUBTYPES = new Set(["/Link", "/Popup"]);

function numbersOf(arr: PDFArray): number[] {
  return arr.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : 0));
}

/**
 * Bake each flattenable annotation's appearance stream into its page's content,
 * then remove the annotation. Implements the PDF spec's appearance-stream
 * algorithm (ISO 32000-1 §12.5.5): the appearance's BBox is transformed by its
 * own Matrix to get a transformed box, which is then fit to the annotation's
 * Rect via a scale+translate matrix A. Concatenating `A` onto the CTM right
 * before drawing the XObject is enough — the XObject's own Matrix is applied
 * automatically by the `Do` operator, so the effective transform ends up being
 * Matrix × A exactly as the spec's algorithm requires (no manual double-apply).
 * Link and Popup annotations are left alone.
 */
function flattenAnnotations(doc: PDFDocument): number {
  const context = doc.context;
  let flattened = 0;

  for (const page of doc.getPages()) {
    const annotsArr = page.node.Annots();
    if (!annotsArr) continue;
    const refs = annotsArr.asArray().filter((v): v is PDFRef => v instanceof PDFRef);

    for (const ref of refs) {
      const annotDict = context.lookup(ref);
      if (!(annotDict instanceof PDFDict)) continue;

      const subtype = annotDict.get(PDFName.of("Subtype"));
      const subtypeName = subtype instanceof PDFName ? subtype.asString() : undefined;
      if (subtypeName && KEPT_SUBTYPES.has(subtypeName)) continue;

      const apVal = annotDict.get(PDFName.of("AP"));
      const apDict = apVal instanceof PDFRef ? context.lookup(apVal) : apVal;
      if (!(apDict instanceof PDFDict)) continue;

      const nEntry = apDict.get(PDFName.of("N"));
      let nRef: PDFRef | undefined;
      let nStream: unknown;
      if (nEntry instanceof PDFRef) {
        nRef = nEntry;
        nStream = context.lookup(nEntry);
      } else if (nEntry instanceof PDFDict) {
        nStream = nEntry;
        nRef = context.getObjectRef(nEntry) ?? context.register(nEntry);
      }
      if (!nRef || !(nStream instanceof PDFRawStream)) continue; // no single usable appearance (e.g. a state dict)

      const bboxVal = nStream.dict.get(PDFName.of("BBox"));
      const matrixVal = nStream.dict.get(PDFName.of("Matrix"));
      const bbox = bboxVal instanceof PDFArray ? numbersOf(bboxVal) : [0, 0, 1, 1];
      const [ma, mb, mc, md, me, mf] = matrixVal instanceof PDFArray ? numbersOf(matrixVal) : [1, 0, 0, 1, 0, 0];

      const rectVal = annotDict.get(PDFName.of("Rect"));
      if (!(rectVal instanceof PDFArray)) continue;
      const [rx0raw, ry0raw, rx1raw, ry1raw] = numbersOf(rectVal);
      const rx0 = Math.min(rx0raw, rx1raw);
      const rx1 = Math.max(rx0raw, rx1raw);
      const ry0 = Math.min(ry0raw, ry1raw);
      const ry1 = Math.max(ry0raw, ry1raw);

      // Transform all 4 BBox corners by Matrix, then take the smallest upright
      // rectangle that encloses them (spec step 1–2).
      const [bx0, by0, bx1, by1] = bbox;
      const corners = [
        [bx0, by0],
        [bx1, by0],
        [bx0, by1],
        [bx1, by1],
      ].map(([x, y]) => [ma * x + mc * y + me, mb * x + md * y + mf]);
      const txs = corners.map((c) => c[0]);
      const tys = corners.map((c) => c[1]);
      const tx0 = Math.min(...txs);
      const tx1 = Math.max(...txs);
      const ty0 = Math.min(...tys);
      const ty1 = Math.max(...tys);

      // Matrix A that fits the transformed box to Rect (spec step 3).
      const sx = tx1 > tx0 ? (rx1 - rx0) / (tx1 - tx0) : 1;
      const sy = ty1 > ty0 ? (ry1 - ry0) / (ty1 - ty0) : 1;
      const ex = rx0 - tx0 * sx;
      const ey = ry0 - ty0 * sy;

      const xObjectKey = page.node.newXObject("FlatAnnot", nRef);
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(sx, 0, 0, sy, ex, ey),
        drawObject(xObjectKey),
        popGraphicsState()
      );
      page.node.removeAnnot(ref);
      flattened++;
    }
  }

  return flattened;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function flattenPDF(file: File, opts: FlattenOptions): Promise<ToolResult> {
  try {
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const doc = await loadPdf(originalBytes);

    let fieldCount = 0;
    let skippedFields: string[] = [];
    let annotationsFlattened = 0;

    if (opts.forms) {
      const result = await flattenFormFields(doc);
      fieldCount = result.fieldCount;
      skippedFields = result.skipped;
    }
    if (opts.annotations) {
      annotationsFlattened = flattenAnnotations(doc);
    }

    const didAnything = (opts.forms && fieldCount > skippedFields.length) || annotationsFlattened > 0;
    if (!didAnything && skippedFields.length === 0) {
      return {
        success: true,
        blob: new Blob([originalBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
        filename: `${baseName(file)}_flattened.pdf`,
        warning: NOTHING_TO_FLATTEN_WARNING,
      };
    }

    const warning = skippedFields.length
      ? `Couldn't flatten ${skippedFields.length === 1 ? "field" : "fields"}: ${skippedFields.join(", ")}. ${skippedFields.length === 1 ? "It was" : "They were"} left as-is.`
      : undefined;

    return {
      success: true,
      blob: await saveToBlob(doc),
      filename: `${baseName(file)}_flattened.pdf`,
      warning,
    };
  } catch (e) {
    return { success: false, error: toolErrorMessage(e, "Failed to flatten PDF.") };
  }
}

/** Counts used by the UI before flattening: total form fields, and non-widget annotations. */
export async function countFlattenable(file: File): Promise<{ fields: number; annotations: number }> {
  const doc = await loadPdf(file);
  const fields = doc.getForm().getFields().length;
  let annotations = 0;
  for (const page of doc.getPages()) {
    const annotsArr = page.node.Annots();
    if (!annotsArr) continue;
    for (const obj of annotsArr.asArray()) {
      const dict = obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
      if (!(dict instanceof PDFDict)) continue;
      const subtype = dict.get(PDFName.of("Subtype"));
      // Widgets are counted via fields; links and pop-ups are never flattened.
      if (subtype instanceof PDFName && ["/Widget", "/Link", "/Popup"].includes(subtype.asString())) continue;
      annotations++;
    }
  }
  return { fields, annotations };
}

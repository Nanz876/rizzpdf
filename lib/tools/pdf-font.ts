// Shared Unicode-text support for the tools that draw text with pdf-lib.
//
// pdf-lib's built-in fonts (Helvetica/Times/Courier) are WinAnsi-only, so any
// character outside that set — Cyrillic, Greek, Vietnamese, Turkish, accented
// Latin beyond Latin-1, many symbols — can't be drawn and comes out as "?" (or
// throws). This helper detects that case and embeds DejaVu Sans (regular/bold),
// a permissively-licensed Unicode font served from our own origin, subsetted
// into the output so the file stays small. Everything runs in the browser; the
// font ships from /fonts and nothing is uploaded.
//
// Not covered yet: CJK, Arabic, Hebrew, Thai and other scripts that need very
// large fonts and/or complex text shaping — those are a separate effort.
import type { PDFDocument, PDFFont } from "pdf-lib";

/** True if `font` can encode every character in `text` (i.e. no "?" fallback needed). */
export function canEncode(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

type FontLoader = (bold: boolean) => Promise<Uint8Array>;

// How the DejaVu bytes are fetched. Default is a same-origin fetch; tests
// override this to read the .ttf from disk (no network / no /public).
let loadBytes: FontLoader = async (bold: boolean) => {
  const res = await fetch(bold ? "/fonts/DejaVuSans-Bold.ttf" : "/fonts/DejaVuSans.ttf");
  if (!res.ok) throw new Error(`Couldn't load the Unicode font (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
};

/** Replace the font-bytes loader (used by tests to read from the filesystem). */
export function setUnicodeFontLoader(fn: FontLoader): void {
  loadBytes = fn;
}

export interface UnicodeFont {
  font: PDFFont;
  /** True if the font actually has a glyph for this character (not a .notdef box). */
  covers: (ch: string) => boolean;
}

/**
 * Embed the DejaVu Sans Unicode fallback (regular or bold) into `doc`, subsetted,
 * and return a real glyph-coverage predicate. Registers fontkit on the document
 * (idempotent). Throws if the font can't load.
 *
 * `covers` matters because an embedded font does NOT throw on a missing glyph —
 * it silently substitutes .notdef. So a coverage check (via fontkit) is the only
 * reliable way to know a character like a CJK ideograph won't render as tofu.
 */
export async function embedUnicodeFont(doc: PDFDocument, bold = false): Promise<UnicodeFont> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontkit = (await import("@pdf-lib/fontkit")).default as any;
  // registerFontkit is per-document; calling it again is harmless.
  doc.registerFontkit(fontkit);
  const bytes = await loadBytes(bold);
  const font = await doc.embedFont(bytes, { subset: true });
  const fk = fontkit.create(bytes);
  const covers = (ch: string): boolean => {
    const cp = ch.codePointAt(0);
    return cp != null && fk.hasGlyphForCodePoint(cp);
  };
  return { font, covers };
}

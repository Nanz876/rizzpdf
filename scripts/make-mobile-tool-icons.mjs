// Draws the tool icons the mobile app is missing, in the style of the ones it
// already has: a 120x120 transparent PNG, thick ink strokes, red accents, and
// two variants so the same icon reads on a light or a dark tile.
//
// Run from the website repo (it has sharp); it writes into the mobile repo.
//   node scripts/make-mobile-tool-icons.mjs
//
// The existing set uses two layouts and these follow them rather than inventing
// a third: a single page with something happening inside it, or two pages with
// a red arrow between them for the conversions.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "C:/Users/kael_/rizzpdf-mobile/assets/icons";
const RED = "#E8232A";
const SIZE = 120;

/**
 * Page outline with the top-right corner cut off, as a path.
 *
 * Written out segment by segment rather than as a clever one-liner: the corner
 * radius has to come off both ends of every straight run, and getting one of
 * them wrong puts a nub on a corner or runs the outline past the bottom edge.
 */
const page = (x, y, w, h, f = 16, r = 4) =>
  [
    `M${x + r} ${y}`,
    `h${w - f - r}`,
    `l${f} ${f}`,
    `v${h - f - r}`,
    `a${r} ${r} 0 0 1 ${-r} ${r}`,
    `h${-(w - 2 * r)}`,
    `a${r} ${r} 0 0 1 ${-r} ${-r}`,
    `v${-(h - 2 * r)}`,
    `a${r} ${r} 0 0 1 ${r} ${-r}`,
    "z",
  ].join(" ");

/** The turned-down corner, drawn on top of the outline. */
const fold = (x, y, w, f = 16) => `M${x + w - f} ${y} v${f} h${f}`;

const svg = (ink, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<g fill="none" stroke="${ink}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">${body(ink)}</g>
</svg>`;

/** A single page, centred, with whatever the tool does drawn inside it. */
const onePage = (inner) => (ink) => `
  <path d="${page(20, 14, 80, 92)}"/>
  <path d="${fold(20, 14, 80)}"/>
  ${inner(ink)}`;

/**
 * Two pages with an arrow between them: the source format on the left, PDF on
 * the right. Matches the existing word-to-pdf icon.
 */
const conversion = (letter) => (ink) => `
  <path d="${page(8, 24, 44, 72, 12)}"/>
  <path d="${fold(8, 24, 44, 12)}"/>
  <path d="${page(68, 24, 44, 72, 12)}"/>
  <path d="${fold(68, 24, 44, 12)}"/>
  <path d="M53 60 h8" stroke="${RED}" stroke-width="6"/>
  <path d="M60 53 l8 7 l-8 7 z" fill="${RED}" stroke="${RED}" stroke-width="2"/>
  <text x="30" y="74" font-family="Helvetica,Arial,sans-serif" font-size="32" font-weight="bold"
        text-anchor="middle" fill="${RED}" stroke="none">${letter}</text>
  <text x="90" y="70" font-family="Helvetica,Arial,sans-serif" font-size="16" font-weight="bold"
        text-anchor="middle" fill="${RED}" stroke="none">PDF</text>`;

const ICONS = {
  // A page with a signature across the ruled line. The squiggle is the whole
  // point of the icon, so it takes the red.
  sign: onePage(
    () => `
    <path d="M34 82 h52" stroke-width="5"/>
    <path d="M36 74 c6 -18 12 -20 15 -10 c3 10 -4 18 -1 20 c4 3 10 -12 16 -14 c5 -2 6 6 12 4"
          stroke="${RED}" stroke-width="6"/>`
  ),

  // A page of text with a red reading frame over it: what OCR does is find the
  // letters that are only a picture.
  ocr: onePage(
    () => `
    <path d="M36 44 h30 M36 58 h38 M36 72 h22" stroke-width="5"/>
    <rect x="58" y="62" width="40" height="32" rx="4" stroke="${RED}" stroke-width="6"/>
    <path d="M66 86 l6 -16 l6 16 M68 80 h8" stroke="${RED}" stroke-width="4"/>`
  ),

  "excel-to-pdf": conversion("X"),
  "powerpoint-to-pdf": conversion("P"),
};

const INK = { light: "#15161A", dark: "#FFFFFF" };

for (const [name, body] of Object.entries(ICONS)) {
  for (const [scheme, ink] of Object.entries(INK)) {
    const dir = path.join(OUT, scheme);
    await mkdir(dir, { recursive: true });
    const png = await sharp(Buffer.from(svg(ink, body))).png().toBuffer();
    await writeFile(path.join(dir, `${name}.png`), png);
    console.log(`${scheme}/${name}.png`);
  }
}

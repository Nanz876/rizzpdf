/**
 * Rebuild the site's social preview card from the app icon, in the same style
 * as the Play feature graphic, so a shared rizzpdf.com link and the Play
 * listing look like the same product.
 *
 * The old card was written when the site was a password remover in beta and
 * claimed "Free for 3 files" — no longer true: every single-file tool is free
 * and unlimited, and only batch is metered.
 */
const sharp = require("C:/Users/kael_/rizzpdf-app/node_modules/sharp");

const SRC = "C:/Users/kael_/rizzpdf-mobile/assets/icon.png";
const OUT = "C:/Users/kael_/rizzpdf-app/public/og-image.png";

const W = 1200, H = 630;
const chips = [
  ["No upload", 470],
  ["No ads", 664],
  ["No sign-up", 826],
];

const chipSvg = chips
  .map(([label, x], i) => {
    const w = [180, 148, 190][i];
    return `<g><rect x="${x}" y="470" width="${w}" height="62" rx="31" fill="#ffffff10" stroke="#ffffff30"/>
    <text x="${x + w / 2}" y="510" font-family="Segoe UI, Arial, sans-serif" font-size="27"
      fill="#e8e8ee" text-anchor="middle">${label}</text></g>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g" cx="18%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#3a1216"/>
      <stop offset="100%" stop-color="#0d0d12"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="470" y="270" font-family="Segoe UI, Arial, sans-serif" font-size="108"
    font-weight="bold" fill="#ffffff">RizzPDF</text>
  <text x="470" y="345" font-family="Segoe UI, Arial, sans-serif" font-size="40"
    fill="#c9c9d4">Free PDF tools that run in your browser</text>
  <text x="470" y="405" font-family="Segoe UI, Arial, sans-serif" font-size="30"
    fill="#8f8f9e">Your files never leave your device</text>
  ${chipSvg}
  <rect y="${H - 10}" width="${W}" height="10" fill="#d32027"/>
</svg>`;

const S = 280, R = 62;
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${R}" fill="#fff"/></svg>`
);

(async () => {
  const tile = await sharp(SRC).resize(S, S)
    .composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  await sharp(Buffer.from(svg))
    .composite([{ input: tile, left: 130, top: 175 }])
    .png().toFile(OUT);
  const m = await sharp(OUT).metadata();
  console.log(`${OUT}  ${m.width}x${m.height} ${m.format}`);
})();

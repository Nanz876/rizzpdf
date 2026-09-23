/**
 * Rebuild the website's icons from the mobile app's launcher icon, so the
 * browser tab, the phone home screen and the Play listing are one image.
 *
 * Source of truth: rizzpdf-mobile/assets/icon.png (1024x1024, opaque).
 */
const sharp = require("C:/Users/kael_/rizzpdf-app/node_modules/sharp");
const fs = require("fs");
const path = require("path");

const SRC = "C:/Users/kael_/rizzpdf-mobile/assets/icon.png";
const APP = "C:/Users/kael_/rizzpdf-app/app";

/**
 * Pack PNGs into an .ico. Modern browsers read PNG-in-ICO fine, and it keeps
 * the file a fraction of the size of the old BMP-based one.
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;

  pngs.forEach(({ size, data }, i) => {
    const e = 16 * i;
    dir.writeUInt8(size >= 256 ? 0 : size, e + 0); // width (0 == 256)
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette count
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // colour planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

(async () => {
  const png = (size) => sharp(SRC).resize(size, size).png().toBuffer();

  // Next.js App Router picks these up by filename and emits the link tags.
  await sharp(SRC).resize(512, 512).png().toFile(path.join(APP, "icon.png"));
  // Apple touch icons are composited onto a background, so flatten the alpha.
  await sharp(SRC)
    .resize(180, 180)
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(path.join(APP, "apple-icon.png"));

  const sizes = [16, 32, 48];
  const pngs = [];
  for (const size of sizes) pngs.push({ size, data: await png(size) });
  fs.writeFileSync(path.join(APP, "favicon.ico"), buildIco(pngs));

  for (const f of ["icon.png", "apple-icon.png", "favicon.ico"]) {
    const p = path.join(APP, f);
    console.log(f, fs.statSync(p).size, "bytes");
  }
})();

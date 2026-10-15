// HEIC/HEIF image support. iPhones shoot HEIC by default, and the browser's
// native image decoders (createImageBitmap, <img>) can't read it, so these
// files have to be transcoded to JPEG before anything else can use them. We use
// heic2any (MIT) — a WebAssembly build of libde265/libheif — which runs entirely
// in the browser, keeping the "files never leave your device" promise.
//
// heic2any touches the DOM/WASM, so it's dynamically imported and only ever runs
// on the main thread (never the pdf-lib worker), like the other canvas paths.

/** True when a file is HEIC/HEIF, by MIME type or extension (type is often blank on these). */
export function isHeic(file: File): boolean {
  if (/^image\/hei[cf]/i.test(file.type)) return true;
  // Some browsers report an empty or generic type for HEIC; fall back to the name.
  return /\.(heic|heif)$/i.test(file.name);
}

/**
 * Transcode a HEIC/HEIF file to a JPEG File (same base name, .jpg extension).
 * Non-HEIC files are returned unchanged. A HEIC that can't be decoded throws a
 * clear, user-facing message.
 */
export async function heicToJpeg(file: File, quality = 0.92): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality });
    // heic2any returns a Blob, or an array of Blobs for multi-image HEIC (we take the first).
    const blob = Array.isArray(out) ? out[0] : out;
    const name = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    throw new Error(`"${file.name}" couldn't be read as a HEIC image. Try exporting it as JPG from your Photos app first.`);
  }
}

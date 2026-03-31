import { NextRequest, NextResponse } from "next/server";

const QUALITY_MAP: Record<string, number> = {
  high: 90,
  medium: 75,
  low: 55,
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const quality = (formData.get("quality") as string) ?? "medium";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const jpegQ = QUALITY_MAP[quality] ?? 75;
    const bytes = await file.arrayBuffer();

    // Dynamic import — mupdf is ESM-only with top-level await; serverExternalPackages
    // in next.config.ts ensures Node.js loads it directly (no webpack bundling).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mupdf = (await import("mupdf" as any)).default;

    const doc = new mupdf.PDFDocument(new Uint8Array(bytes));
    const n = doc.countObjects();

    for (let i = 1; i < n; i++) {
      try {
        const ref = doc.newIndirect(i);
        const obj = ref.resolve();

        if (!obj.isStream() || !obj.isDictionary()) continue;

        const subtype = obj.get("Subtype");
        if (!subtype.isName() || subtype.asName() !== "Image") continue;

        // Skip 1-bit image masks
        const imageMask = obj.get("ImageMask");
        if (imageMask.isBoolean() && imageMask.asBoolean()) continue;

        // Skip tiny images (thumbnails, icons)
        const wObj = obj.get("Width");
        const hObj = obj.get("Height");
        if (!wObj.isNumber() || !hObj.isNumber()) continue;
        if (wObj.asNumber() < 32 || hObj.asNumber() < 32) continue;

        const img = doc.loadImage(ref);
        let pixmap = img.toPixmap();

        // JPEG has no alpha channel — skip images with transparency
        if (pixmap.getAlpha()) {
          pixmap.destroy();
          img.destroy();
          continue;
        }

        // Re-encode as JPEG — convert CMYK/Indexed/Lab to RGB first
        const cs = pixmap.getColorSpace();
        if (cs && !cs.isRGB() && !cs.isGray()) {
          const converted = pixmap.convertToColorSpace(mupdf.ColorSpace.DeviceRGB);
          pixmap.destroy();
          pixmap = converted;
        }

        const jpegBytes = pixmap.asJPEG(jpegQ);
        const finalCs = pixmap.getColorSpace();

        // Update the image XObject dict to reflect the new encoding
        obj.put("Filter", doc.newName("DCTDecode"));
        obj.delete("DecodeParms");
        obj.put("BitsPerComponent", doc.newInteger(8));
        obj.put("Width", doc.newInteger(pixmap.getWidth()));
        obj.put("Height", doc.newInteger(pixmap.getHeight()));
        if (finalCs && finalCs.isGray()) {
          obj.put("ColorSpace", doc.newName("DeviceGray"));
        } else {
          obj.put("ColorSpace", doc.newName("DeviceRGB"));
        }

        // Replace stream bytes with the new JPEG data in-place
        obj.writeStream(jpegBytes);

        pixmap.destroy();
        img.destroy();
      } catch {
        // Skip objects that can't be recompressed (e.g. already-optimised streams)
      }
    }

    // garbage=compact removes old unreferenced stream data; compress=yes deflates objects
    const saved = doc.saveToBuffer("garbage=compact,compress=yes");
    doc.destroy();

    const resultBytes = saved.asUint8Array();
    saved.destroy();

    const baseName = file.name.replace(/\.pdf$/i, "");
    return new NextResponse(resultBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}_compressed.pdf"`,
      },
    });
  } catch (err) {
    console.error("compress-pdf error:", err);
    return NextResponse.json({ error: "Failed to compress PDF." }, { status: 500 });
  }
}

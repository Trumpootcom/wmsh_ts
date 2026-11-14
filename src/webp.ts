import decode, { init } from "@jsquash/webp/decode.js";
import decoder from "@jsquash/webp/codec/dec/webp_dec.wasm";

let initialized: Promise<void> | undefined;

export async function decodeStaticWebp(buffer: ArrayBuffer, maxPixels: number) {
  const view = new DataView(buffer);
  const end = view.getUint32(4, true) + 8;
  if (end > view.byteLength) throw new Error("The WebP file is truncated.");
  let width = 0;
  let height = 0;
  for (let offset = 12; offset + 8 <= end;) {
    const tag = view.getUint32(offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    offset = start + size + (size % 2);
    if (offset > end) throw new Error("The WebP chunk is truncated.");
    if (tag === 0x414e494d || tag === 0x414e4d46 ||
        (tag === 0x56503858 && size >= 10 && (view.getUint8(start) & 2))) {
      throw new Error("Upload a static WebP image.");
    }
    if (tag === 0x56503820 && size >= 10) {
      width = view.getUint16(start + 6, true) & 0x3fff;
      height = view.getUint16(start + 8, true) & 0x3fff;
    } else if (tag === 0x5650384c && size >= 5) {
      const dimensions = view.getUint32(start + 1, true);
      width = (dimensions & 0x3fff) + 1;
      height = ((dimensions >>> 14) & 0x3fff) + 1;
    } else {
      continue;
    }
    if (!width || !height || width * height > maxPixels) {
      throw new Error("WebP images must have valid dimensions and be at most 12 megapixels.");
    }
  }
  if (!width || !height) throw new Error("The WebP file has no readable image.");
  // The runtime accepts a compiled WASM module. The package types only expose the options overload.
  initialized ??= (init as (module: WebAssembly.Module, options: object) => Promise<void>)(decoder, {});
  await initialized;
  return decode(buffer);
}

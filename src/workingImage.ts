import UPNG from "@pdf-lib/upng";
import { decode, encode } from "jpeg-js";
import { decodeStaticWebp } from "./webp";

const maxInputPixels = 12_000_000;
const maxWorkingEdge = 2400;
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const imageCompressionQuality = 50;

export async function workingJpeg(buffer: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 255 && bytes[1] === 216) {
    let image;
    try {
      image = decode(buffer, { useTArray: true, maxResolutionInMP: 12, maxMemoryUsageInMB: 80 });
    } catch {
      throw new Error("JPEG images must be decodable within the 12-megapixel and decoder memory limits.");
    }
    if (!image.width || !image.height || image.width * image.height > maxInputPixels) {
      throw new Error("JPEG images must have valid dimensions and be at most 12 megapixels.");
    }
    return resizeToJpeg(image.data, image.width, image.height);
  }
  const header = new DataView(buffer);
  if (bytes.length >= 12 && header.getUint32(0) === 0x52494646 && header.getUint32(8) === 0x57454250) {
    const image = await decodeStaticWebp(buffer, maxInputPixels);
    return resizeToJpeg(image.data, image.width, image.height);
  }
  if (!pngSignature.every((byte, index) => bytes[index] === byte)) {
    throw new Error("Upload a JPEG, PNG, or WebP image.");
  }
  if (bytes.length < 33 || header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452) {
    throw new Error("The PNG header is invalid.");
  }
  const sourceWidth = header.getUint32(16);
  const sourceHeight = header.getUint32(20);
  if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > maxInputPixels) {
    throw new Error("PNG images must have valid dimensions and be at most 12 megapixels.");
  }

  const png = UPNG.decode(buffer);
  if (png.tabs.acTL) throw new Error("Upload a static PNG image.");
  const source = new Uint8Array(UPNG.toRGBA8(png)[0]);
  // The decoder treats a grayscale transparency key of zero as absent.
  const transparency = (png.tabs as { tRNS?: unknown }).tRNS;
  if (png.ctype === 0 && transparency === 0 && png.depth < 16) {
    for (let i = 0; i < source.length; i += 4) {
      if (source[i] === 0) source[i + 3] = 0;
    }
  }
  if (source.length !== sourceWidth * sourceHeight * 4) throw new Error("The PNG pixels are invalid.");
  return resizeToJpeg(source, sourceWidth, sourceHeight);
}

function resizeToJpeg(source: Uint8Array | Uint8ClampedArray, sourceWidth: number, sourceHeight: number) {
  const scale = Math.min(1, maxWorkingEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const data = new Uint8Array(width * height * 4);

  // Average each source area and composite transparent pixels onto white.
  for (let y = 0; y < height; y++) {
    const top = Math.floor(y * sourceHeight / height);
    const bottom = Math.floor((y + 1) * sourceHeight / height);
    for (let x = 0; x < width; x++) {
      const left = Math.floor(x * sourceWidth / width);
      const right = Math.floor((x + 1) * sourceWidth / width);
      const samples = (bottom - top) * (right - left);
      let red = 0, green = 0, blue = 0;
      for (let sy = top; sy < bottom; sy++) {
        for (let sx = left; sx < right; sx++) {
          const i = (sy * sourceWidth + sx) * 4;
          const alpha = source[i + 3] / 255;
          const white = 255 * (1 - alpha);
          red += source[i] * alpha + white;
          green += source[i + 1] * alpha + white;
          blue += source[i + 2] * alpha + white;
        }
      }
      const i = (y * width + x) * 4;
      data[i] = Math.round(red / samples);
      data[i + 1] = Math.round(green / samples);
      data[i + 2] = Math.round(blue / samples);
      data[i + 3] = 255;
    }
  }
  return Uint8Array.from(encode({ width, height, data }, imageCompressionQuality).data);
}

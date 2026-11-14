import { drawObject, popGraphicsState, pushGraphicsState, scale as scaleImage, translate, type PDFDocument, type PDFPage } from "pdf-lib";
import { drawGrid } from "./grid";

type Raster = { width: number; height: number; data: Uint8Array };
type Rect = { left: number; top: number; width: number; height: number };

export function drawContrastGrid(
  pdf: PDFDocument,
  page: PDFPage,
  settings: Parameters<typeof drawGrid>[1],
  center: Parameters<typeof drawGrid>[2],
  rect: Rect,
  map: Rect,
  source: Raster,
) {
  const opacity = settings.lineStyle.opacity;
  if (opacity === 0) return;
  // Sample a shared 144 dpi lattice so adjacent sheets agree in the overlap.
  const scale = 2;
  const x0 = Math.floor(rect.left * scale);
  const y0 = Math.floor(rect.top * scale);
  const width = Math.ceil((rect.left + rect.width) * scale) - x0;
  const height = Math.ceil((rect.top + rect.height) * scale) - y0;
  const coverage = new Uint8Array(width * height);
  drawGrid({
    drawLine({ start, end, thickness = 1, dashArray = [], dashPhase = 0 }) {
      const ax = start.x * scale - x0;
      const ay = -start.y * scale - y0;
      const dx = (end.x - start.x) * scale;
      const dy = (start.y - end.y) * scale;
      const length = Math.hypot(dx, dy);
      const ux = dx / length;
      const uy = dy / length;
      const radius = thickness * scale / 2;
      const reach = radius + 0.5;
      const period = dashArray.reduce((sum, part) => sum + part, 0);
      const firstRow = Math.max(0, Math.floor(Math.min(ay, ay + dy) - reach));
      const lastRow = Math.min(height - 1, Math.ceil(Math.max(ay, ay + dy) + reach));
      const firstColumn = Math.max(0, Math.floor(Math.min(ax, ax + dx) - reach));
      const lastColumn = Math.min(width - 1, Math.ceil(Math.max(ax, ax + dx) + reach));
      for (let y = firstRow; y <= lastRow; y++) {
        const py = y + 0.5 - ay;
        let left = firstColumn;
        let right = lastColumn;
        if (uy !== 0) {
          const centerX = ax + py * ux / uy;
          const span = reach / Math.abs(uy);
          left = Math.max(left, Math.floor(centerX - span));
          right = Math.min(right, Math.ceil(centerX + span));
        }
        for (let x = left; x <= right; x++) {
          const px = x + 0.5 - ax;
          const along = px * ux + py * uy;
          if (along < 0 || along > length) continue;
          const alpha = Math.min(1, reach - Math.abs(px * uy - py * ux));
          if (alpha <= 0) continue;
          if (period > 0) {
            let distance = (along / scale + dashPhase) % period;
            let segment = 0;
            while (segment < dashArray.length - 1 && distance >= dashArray[segment]) {
              distance -= dashArray[segment++];
            }
            if (segment % 2) continue;
          }
          const index = y * width + x;
          coverage[index] = Math.max(coverage[index], Math.round(255 * opacity * alpha));
        }
      }
    },
  }, settings, { x: center.x, y: -center.y }, { left: rect.left, top: -rect.top, width: rect.width, height: rect.height });

  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor(((y0 + y + 0.5) / scale - map.top) * source.height / map.height);
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!coverage[index]) continue;
      const sx = Math.floor(((x0 + x + 0.5) / scale - map.left) * source.width / map.width);
      if (sy < 0 || sy >= source.height || sx < 0 || sx >= source.width) continue;
      const sourceIndex = (sy * source.width + sx) * 3;
      const red = source.data[sourceIndex];
      const green = source.data[sourceIndex + 1];
      const blue = source.data[sourceIndex + 2];
      const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const inverted = 255 - brightness;
      const target = brightness < 127.5 ? 255 : 0;
      const distance = Math.abs(inverted - brightness);
      const mix = distance >= 64 ? 0 : (64 - distance) / Math.abs(target - inverted);
      rgb[index * 3] = Math.round((255 - red) * (1 - mix) + target * mix);
      rgb[index * 3 + 1] = Math.round((255 - green) * (1 - mix) + target * mix);
      rgb[index * 3 + 2] = Math.round((255 - blue) * (1 - mix) + target * mix);
    }
  }
  const mask = pdf.context.register(pdf.context.flateStream(coverage, {
    Type: "XObject", Subtype: "Image", Width: width, Height: height,
    ColorSpace: "DeviceGray", BitsPerComponent: 8,
  }));
  const ref = pdf.context.register(pdf.context.flateStream(rgb, {
    Type: "XObject", Subtype: "Image", Width: width, Height: height,
    ColorSpace: "DeviceRGB", BitsPerComponent: 8, SMask: mask,
  }));
  const image = page.node.newXObject("ContrastGrid", ref);
  page.pushOperators(
    pushGraphicsState(),
    translate(
      (page.getWidth() - rect.width) / 2 + x0 / scale - rect.left,
      (page.getHeight() + rect.height) / 2 + rect.top - (y0 + height) / scale,
    ),
    scaleImage(width / scale, height / scale),
    drawObject(image),
    popGraphicsState(),
  );
}

import { BlendMode, LineCapStyle, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts,
  type PDFDocument, type PDFImage, type PDFFont } from "pdf-lib";
import { drawGrid } from "./grid";
import type { HexView } from "./hexGrid";
import { drawContrastGrid } from "./contrast";
import type { readTemplate } from "./template";
import { drawSheetBadge } from "./sheetBadge";

type Layout = {
  canvasWidth: number; canvasHeight: number;
  mapWidth: number; mapHeight: number; mapLeft: number; mapTop: number;
  stepX: number; stepY: number; printableWidth: number; printableHeight: number;
};

export async function addOverview(
  pdf: PDFDocument, image: PDFImage, bold: PDFFont,
  template: ReturnType<typeof readTemplate>, layout: Layout,
  source?: Parameters<typeof drawContrastGrid>[6],
  hexEdges?: HexView["edges"],
) {
  const pageWidth = Math.max(template.pageWidth, template.pageHeight);
  const pageHeight = Math.min(template.pageWidth, template.pageHeight);
  const page = pdf.addPage([pageWidth, pageHeight]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const white = rgb(1, 1, 1);
  const parchment = rgb(0.96, 0.92, 0.83);
  const ink = rgb(0.10, 0.14, 0.18);
  const black = rgb(0, 0, 0);
  const edge = 24;
  const legendHeight = 66;
  const margin = template.margin;
  const factor = Math.min(
    (pageWidth - 2 * margin) / layout.canvasWidth,
    (pageHeight - 2 * margin) / layout.canvasHeight,
  );
  const width = layout.canvasWidth * factor;
  const height = layout.canvasHeight * factor;
  const left = (pageWidth - width) / 2;
  const mapY = (pageHeight + height) / 2;
  const map = {
    left: layout.mapLeft * factor, top: layout.mapTop * factor,
    width: layout.mapWidth * factor, height: layout.mapHeight * factor,
  };
  const grid = { ...template, spacing: template.spacing * factor,
    lineStyle: { ...template.lineStyle, thickness: template.lineStyle.thickness * factor } };
  page.pushOperators(pushGraphicsState(), rectangle(left, mapY - height, width, height), clip(), endPath());
  if (grid.lineStyle.blendMode === BlendMode.Difference) {
    page.drawRectangle({ x: left, y: mapY - height, width, height, color: white });
  }
  page.drawImage(image, { x: left + map.left, y: mapY - map.top - map.height, width: map.width, height: map.height });
  if (source) {
    drawContrastGrid(pdf, page, grid, { x: width / 2, y: height / 2 },
      { left: 0, top: 0, width, height }, map, source, { left, top: mapY },
      hexEdges && { edges: hexEdges, scale: factor, x: 0, y: 0 });
  } else if (!template.adaptiveContrast && template.lineStyle.opacity > 0) {
    drawGrid(page, grid, { x: left + width / 2, y: mapY - height / 2 }, { left, top: mapY, width, height },
      hexEdges && { edges: hexEdges, scale: factor, x: left, y: mapY });
  }
  page.pushOperators(popGraphicsState());

  const cuts = [];
  for (let col = 1; col < template.columns; col++) {
    for (const offset of new Set([col * layout.stepX, (col - 1) * layout.stepX + layout.printableWidth])) {
      const x = left + offset * factor;
      cuts.push({ start: { x, y: mapY - height }, end: { x, y: mapY } });
    }
  }
  for (let row = 1; row < template.rows; row++) {
    for (const offset of new Set([row * layout.stepY, (row - 1) * layout.stepY + layout.printableHeight])) {
      const y = mapY - offset * factor;
      cuts.push({ start: { x: left, y }, end: { x: left + width, y } });
    }
  }
  page.drawRectangle({ x: left, y: mapY - height, width, height, borderColor: ink, borderWidth: 0.5 });
  for (const line of cuts) page.drawLine({ ...line, thickness: 5, color: white });
  for (const line of cuts) page.drawLine({ ...line, thickness: 1, color: black, dashArray: [0.1, 3], lineCap: LineCapStyle.Round });

  for (let row = 0; row < template.rows; row++) {
    for (let col = 0; col < template.columns; col++) {
      drawSheetBadge(page, bold, row, col, {
        left: left + col * layout.stepX * factor,
        bottom: mapY - (row * layout.stepY + layout.printableHeight) * factor,
        width: layout.printableWidth * factor,
        height: layout.printableHeight * factor,
      }, Math.min(1, factor));
    }
  }

  const text = (label: string, x: number, y: number, size = 10, font = normal) =>
    page.drawText(label, { x, y, size, font, color: ink });
  const panel = (x: number, y: number, panelWidth: number, panelHeight: number) =>
    page.drawRectangle({ x, y, width: panelWidth, height: panelHeight, color: parchment, opacity: 0.88, borderColor: ink, borderWidth: 0.5 });
  const titleWidth = pageWidth * 0.9;
  const titleHeight = 46 * 0.8;
  const titleX = (pageWidth - titleWidth) / 2;
  const overlayInset = 1.5 * margin;
  const titleTop = pageHeight - overlayInset;
  panel(titleX, titleTop - titleHeight, titleWidth, titleHeight);
  const title = Array.from(template.title, (character) => {
    try { bold.encodeText(character); return /[\r\n\t]/.test(character) ? " " : character; } catch { return "?"; }
  }).join("");
  let titleEnd = title.length;
  const titleTextLimit = titleWidth - 24;
  while (titleEnd > 0 && bold.widthOfTextAtSize(title.slice(0, titleEnd) + (titleEnd < title.length ? "..." : ""), 17) > titleTextLimit) titleEnd--;
  const heading = titleEnd < title.length ? title.slice(0, titleEnd) + "..." : title;
  const titleBaseline = titleTop - (titleHeight + bold.heightAtSize(17, { descender: false })) / 2;
  text(heading, (pageWidth - bold.widthOfTextAtSize(heading, 17)) / 2, titleBaseline, 17, bold);

  const footerY = overlayInset;
  const format = (value: number) => Number(value.toFixed(3)).toString();
  const dims = (w: number, h: number, unit: number) => `${(w / unit).toFixed(1)} x ${(h / unit).toFixed(1)}`;
  const feetUnit = template.spacing / 5;
  const paperLines = [
    `${template.size.toUpperCase()} ${template.orientation} | ${template.rows} rows x ${template.columns} columns`,
    `Paper: ${dims(layout.canvasWidth, layout.canvasHeight, 72)} in | ${dims(layout.canvasWidth, layout.canvasHeight, feetUnit)} ft`,
    `Image: ${dims(layout.mapWidth, layout.mapHeight, 72)} in | ${dims(layout.mapWidth, layout.mapHeight, feetUnit)} ft`,
  ];
  const gridLines = [
    `Grid: ${template.style}, ${template.color}, ${template.lineStyle.pattern} | ${format(template.lineStyle.thickness)} pt | opacity ${format(template.lineStyle.opacity)}${template.iso ? ` | ISO ${format(template.isoAngle)} deg` : ""}`,
    `Rotation: ${format(template.rotation)} deg | Offsets: ${format(template.offsetX)}, ${format(template.offsetY)} cells`,
  ];
  const scaleWidth = 164;
  const panelWidth = Math.min(6 * 72, pageWidth - 2 * edge - template.margin - scaleWidth);
  const legendX = (pageWidth - panelWidth - template.margin - scaleWidth) / 2;
  const scaleX = legendX + panelWidth + template.margin;
  const columnWidth = (panelWidth - 32) / 2;
  const drawColumn = (lines: string[], x: number) => {
    lines.forEach((line, i) => {
      const size = 9 * Math.min(1, columnWidth / normal.widthOfTextAtSize(line, 9));
      text(line, x, footerY + legendHeight - 31 - i * 11, size);
    });
  };
  panel(legendX, footerY, panelWidth, legendHeight);
  text("MAP AND SHEET LEGEND", legendX + 10, footerY + legendHeight - 17, 10, bold);
  drawColumn(paperLines, legendX + 10);
  drawColumn(gridLines, legendX + 22 + columnWidth);

  const scaleHeight = 49;
  const inches = (template.spacing / 72).toFixed(1);
  const scaleLabel = `1 grid = ${inches} in = 5 feet`;
  const scaleFontSize = 18 * Math.min(1, (scaleWidth - 20) / bold.widthOfTextAtSize(scaleLabel, 18));
  const labelWidth = bold.widthOfTextAtSize(scaleLabel, scaleFontSize);
  panel(scaleX, footerY, scaleWidth, scaleHeight);
  const scaleHeading = "SCALE";
  const headingSize = 10;
  const headingWidth = bold.widthOfTextAtSize(scaleHeading, headingSize);
  text(scaleHeading, scaleX + (scaleWidth - headingWidth) / 2, footerY + 34, headingSize, bold);
  text(scaleLabel, scaleX + (scaleWidth - labelWidth) / 2, footerY + 10, scaleFontSize, bold);
}

import { BlendMode, LineCapStyle, clip, degrees, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts,
  type PDFDocument, type PDFImage, type PDFFont } from "pdf-lib";
import { drawGrid } from "./grid";
import type { HexView } from "./hexGrid";
import { drawContrastGrid } from "./contrast";
import type { readTemplate } from "./template";
import { drawSheetBadge } from "./sheetBadge";
import { drawCoordinateBorder } from "./coordinateBorder";

const showPageCuts = false;
const leftBarWidth = 2 * 72;
const overviewCellHeadingFontSize = 14;
const overviewLegendRowFontSize = 12;
const overviewScalingRow1FontSize = 18;
const overviewScalingRow2FontSize = 22;
const overviewReferenceHeight = 10.5 * 72;

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
  const margin = template.margin;
  const tableScale = (pageHeight - 2 * margin) / overviewReferenceHeight;
  const scaledLeftBarWidth = leftBarWidth * tableScale;
  const currentFactor = Math.min(
    (pageWidth - 2 * margin) / layout.canvasWidth,
    (pageHeight - 2 * margin) / layout.canvasHeight,
  );
  const currentWidth = layout.canvasWidth * currentFactor;
  const currentHeight = layout.canvasHeight * currentFactor;
  const width = pageWidth - 3 * margin - scaledLeftBarWidth;
  const shrinkRatio = width / currentWidth;
  const factor = currentFactor * shrinkRatio;
  const height = currentHeight * shrinkRatio;
  const left = 2 * margin + scaledLeftBarWidth;
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
  if (showPageCuts) {
    for (const line of cuts) page.drawLine({ ...line, thickness: 5, color: white });
    for (const line of cuts) page.drawLine({ ...line, thickness: 1, color: black, dashArray: [0.1, 3], lineCap: LineCapStyle.Round });
  }

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

  if (template.coordinates && template.style === "rect" && !template.iso && template.rotation === 0) {
    drawCoordinateBorder(page, bold, {
      pageWidth: layout.canvasWidth, pageHeight: layout.canvasHeight, margin: 0,
      spacing: template.spacing, offsetX: template.offsetX, offsetY: template.offsetY,
      sheetLeft: 0, sheetTop: 0, stepX: layout.stepX, stepY: layout.stepY,
      canvasWidth: layout.canvasWidth, canvasHeight: layout.canvasHeight,
      mapLeft: layout.mapLeft, mapTop: layout.mapTop, mapWidth: layout.mapWidth, mapHeight: layout.mapHeight,
      row: 0, column: 0, scale: factor, pageOriginX: left, pageTop: mapY,
    });
  }

  const text = (label: string, x: number, y: number, size = 10, font = normal) =>
    page.drawText(label, { x, y, size, font, color: ink });
  const panel = (x: number, y: number, panelWidth: number, panelHeight: number) =>
    page.drawRectangle({ x, y, width: panelWidth, height: panelHeight, color: parchment, opacity: 0.88, borderColor: ink, borderWidth: 0.5 * tableScale });
  const titlePanelX = margin;
  const titlePanelWidth = scaledLeftBarWidth;
  const titlePanelY = margin;
  const titlePanelHeight = pageHeight - 2 * margin;
  panel(titlePanelX, titlePanelY, titlePanelWidth, titlePanelHeight);
  const title = Array.from(template.title, (character) => {
    try { bold.encodeText(character); return /[\r\n\t]/.test(character) ? " " : character; } catch { return "?"; }
  }).join("");
  let titleEnd = title.length;
  const titleColumnWidth = 30 * tableScale;
  const titleTextLimit = titlePanelHeight - 16 * tableScale;
  const titleBaseSize = 17 * tableScale;
  while (titleEnd > 0 && bold.widthOfTextAtSize(title.slice(0, titleEnd) + (titleEnd < title.length ? "..." : ""), titleBaseSize) > titleTextLimit) titleEnd--;
  const heading = titleEnd < title.length ? title.slice(0, titleEnd) + "..." : title;
  const titleSize = titleBaseSize * Math.min(1, titleTextLimit / Math.max(1, bold.widthOfTextAtSize(heading, titleBaseSize)));
  const titleWidth = bold.widthOfTextAtSize(heading, titleSize);
  const titleFontHeight = bold.heightAtSize(titleSize);
  page.drawText(heading, {
    x: titlePanelX + (titleColumnWidth + titleFontHeight) / 2,
    y: titlePanelY + (titlePanelHeight - titleWidth) / 2,
    size: titleSize, font: bold, color: ink, rotate: degrees(90),
  });

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
  const contentX = titlePanelX + titleColumnWidth;
  const sectionHeight = titlePanelHeight / 3;
  const dividerOpacity = 0.33;
  page.drawLine({
    start: { x: contentX, y: titlePanelY },
    end: { x: contentX, y: titlePanelY + titlePanelHeight },
    thickness: 0.5 * tableScale, color: ink, opacity: dividerOpacity,
  });
  for (let section = 1; section < 3; section++) {
    const y = titlePanelY + section * sectionHeight;
    page.drawLine({
      start: { x: contentX, y },
      end: { x: titlePanelX + titlePanelWidth, y },
      thickness: 0.5 * tableScale, color: ink, opacity: dividerOpacity,
    });
  }
  const legendHeading = "MAP AND SHEET LEGEND";
  const legendHeadingSize = overviewCellHeadingFontSize * tableScale;
  const legendHeadingWidth = bold.widthOfTextAtSize(legendHeading, legendHeadingSize);
  const firstSectionTop = titlePanelY + titlePanelHeight;
  const firstSectionBottom = firstSectionTop - sectionHeight;
  page.drawText(legendHeading, {
    x: contentX + bold.heightAtSize(legendHeadingSize) + 3 * tableScale,
    y: firstSectionBottom + (sectionHeight - legendHeadingWidth) / 2,
    size: legendHeadingSize, font: bold, color: ink, rotate: degrees(90),
  });
  const legendRows = [...paperLines, ...gridLines];
  let dataX = contentX + bold.heightAtSize(legendHeadingSize) * 2;
  legendRows.forEach((line) => {
    const size = overviewLegendRowFontSize * tableScale;
    const fontHeight = normal.heightAtSize(size);
    const x = dataX + fontHeight;
    const y = firstSectionBottom + 5 * tableScale;
    page.drawText(line, { x, y, size, font: normal, color: ink, rotate: degrees(90) });
    dataX += fontHeight * 1.5;
  });

  const scalingHeading = "SCALING";
  const scalingHeadingSize = overviewCellHeadingFontSize * tableScale;
  const scalingHeadingWidth = bold.widthOfTextAtSize(scalingHeading, scalingHeadingSize);
  page.drawText(scalingHeading, {
    x: contentX + bold.heightAtSize(scalingHeadingSize) + 3 * tableScale,
    y: titlePanelY + (sectionHeight - scalingHeadingWidth) / 2,
    size: scalingHeadingSize, font: bold, color: ink, rotate: degrees(90),
  });
  const scalingRows = [
    `5 feet = ${(template.spacing / 72).toFixed(1)} inches`,
    `${(layout.mapWidth / feetUnit).toFixed(1)} feet x ${(layout.mapHeight / feetUnit).toFixed(1)} feet`,
  ];
  const scalingRowFontSizes = [overviewScalingRow1FontSize, overviewScalingRow2FontSize].map((size) => size * tableScale);
  let scalingDataX = contentX + bold.heightAtSize(scalingHeadingSize) * 2.5;
  scalingRows.forEach((line, index) => {
    const size = scalingRowFontSizes[index];
    const fontHeight = normal.heightAtSize(size);
    const lineWidth = normal.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: scalingDataX + fontHeight,
      y: titlePanelY + (sectionHeight - lineWidth) / 2,
      size, font: normal, color: ink, rotate: degrees(90),
    });
    scalingDataX += fontHeight * 2;
  });
}

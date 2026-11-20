import { concatTransformationMatrix, degrees, popGraphicsState, pushGraphicsState, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";

function hsl(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const intermediate = chroma * (1 - Math.abs(segment % 2 - 1));
  const [red, green, blue] = segment < 1 ? [chroma, intermediate, 0]
    : segment < 2 ? [intermediate, chroma, 0]
      : segment < 3 ? [0, chroma, intermediate]
        : segment < 4 ? [0, intermediate, chroma]
          : segment < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate];
  const offset = lightness - chroma / 2;
  return rgb(red + offset, green + offset, blue + offset);
}

export const coordinateBarStyle = {
  font: StandardFonts.HelveticaBold,
  backgroundColor: hsl(45, 0.40, 0.90),
  backgroundAltColor: hsl(45, 0.20, 0.66),
  altBorderFreq: 6,
  borderColor: hsl(38.82, 0.321, 0.265),
  coordinateColor: hsl(36, 0.385, 0.13),
  distanceColor: hsl(36.67, 0.31, 0.29),
  barThicknessRatio: 0.50,
  coordinateFontRatio: 0.95,
  distanceFontRatio: 0.85,
  coordinateHorizontalScaleRatio: .60,
  distanceHorizontalScaleRatio: 0.5,
} as const;

type BorderOptions = {
  pageWidth: number; pageHeight: number; margin: number; spacing: number;
  offsetX: number; offsetY: number;
  sheetLeft: number; sheetTop: number; stepX: number; stepY: number;
  canvasWidth: number; canvasHeight: number; mapLeft: number; mapTop: number;
  mapWidth: number; mapHeight: number; row: number; column: number;
  scale?: number; pageOriginX?: number; pageTop?: number;
};

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value--;
    name = String.fromCharCode(65 + value % 26) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function drawScaledText(page: PDFPage, text: string, options: Parameters<PDFPage["drawText"]>[1], scale: number, vertical = false) {
  if (scale === 1) {
    page.drawText(text, options);
    return;
  }
  const x = options?.x ?? 0;
  const y = options?.y ?? 0;
  page.pushOperators(
    pushGraphicsState(),
    vertical
      ? concatTransformationMatrix(1, 0, 0, scale, 0, y * (1 - scale))
      : concatTransformationMatrix(scale, 0, 0, 1, x * (1 - scale), 0),
  );
  page.drawText(text, options);
  page.pushOperators(popGraphicsState());
}

function centeredBaseline(font: PDFFont, size: number, y: number, height: number) {
  const ascent = font.heightAtSize(size);
  const fullHeight = font.heightAtSize(size, { descender: true });
  const descender = fullHeight - ascent;
  return y + (height - fullHeight) / 2 + descender + height*0.07;
}

export function drawCoordinateBorder(page: PDFPage, font: PDFFont, options: BorderOptions) {
  const { pageWidth, pageHeight, margin, spacing, sheetLeft, sheetTop, stepX, stepY,
    canvasWidth, canvasHeight, mapLeft, mapTop, mapWidth, mapHeight, row, column } = options;
  const { backgroundColor, backgroundAltColor, altBorderFreq, borderColor, coordinateColor, distanceColor,
    barThicknessRatio, coordinateFontRatio, distanceFontRatio } = coordinateBarStyle;
  const scale = options.scale ?? 1;
  const pageOriginX = options.pageOriginX ?? 0;
  const bar = spacing * barThicknessRatio * scale;
  const coordinateSize = spacing * coordinateFontRatio * barThicknessRatio * scale;
  const distanceSize = spacing * distanceFontRatio * barThicknessRatio * scale;
  const { coordinateHorizontalScaleRatio, distanceHorizontalScaleRatio } = coordinateBarStyle;
  const printableWidth = pageWidth - 2 * margin;
  const printableHeight = pageHeight - 2 * margin;
  // drawGrid's orthogonal lattice origin is the image center shifted by
  // offsetX/offsetY. Keep the labels on that same lattice, and retain cells
  // only when both grid lines fall inside the image (no partial cells).
  const gridOriginX = mapLeft + mapWidth / 2 + options.offsetX * spacing;
  const gridOriginY = mapTop + mapHeight / 2 + options.offsetY * spacing;
  const firstCellX = Math.ceil((mapLeft - gridOriginX) / spacing - 1e-9);
  const lastCellX = Math.floor((mapLeft + mapWidth - gridOriginX) / spacing - 1 + 1e-9);
  const firstCellY = Math.ceil((mapTop - gridOriginY) / spacing - 1e-9);
  const lastCellY = Math.floor((mapTop + mapHeight - gridOriginY) / spacing - 1 + 1e-9);
  const firstColumn = Math.max(firstCellX, Math.ceil((sheetLeft - gridOriginX) / spacing - 0.5));
  const lastColumn = Math.min(lastCellX, Math.floor((sheetLeft + printableWidth - gridOriginX) / spacing - 0.5));
  const firstRow = Math.max(firstCellY, Math.ceil((sheetTop - gridOriginY) / spacing - 0.5));
  const lastRow = Math.min(lastCellY, Math.floor((sheetTop + printableHeight - gridOriginY) / spacing - 0.5));
  const top = options.pageTop ?? pageHeight - margin;
  for (let index = firstColumn; index <= lastColumn; index++) {
    const cellLeft = pageOriginX + (margin + gridOriginX + index * spacing - sheetLeft) * scale;
    const drawSpacing = spacing * scale;
    const center = cellLeft + drawSpacing / 2;
    const contentCenter = margin + gridOriginX + index * spacing - sheetLeft + spacing / 2;
    if (contentCenter < margin || contentCenter > pageWidth - margin) continue;
    const imageTopY = top - (mapTop - sheetTop) * scale;
    const imageBottomY = imageTopY - mapHeight * scale;
    const topY = imageTopY;
    const bottomY = imageBottomY - bar;
    const coordinate = columnName(index - firstCellX);
    const columnNumber = index - firstCellX + 1;
    const cellBackground = altBorderFreq > 0 && columnNumber % altBorderFreq === 0 ? backgroundAltColor : backgroundColor;
    page.drawRectangle({ x: cellLeft, y: topY, width: drawSpacing, height: bar, color: cellBackground, borderColor, borderWidth: 0.5 * scale });
    page.drawRectangle({ x: cellLeft, y: bottomY, width: drawSpacing, height: bar, color: cellBackground, borderColor, borderWidth: 0.5 * scale });
    const distance = `${(index - firstCellX+1) * 5}`;
    const distanceWidth = font.widthOfTextAtSize(distance, distanceSize) * distanceHorizontalScaleRatio;
    const coordinateX = cellLeft + bar * 0.18;
    const distanceX = cellLeft + drawSpacing - bar * 0.18 - distanceWidth;
    for (const y of [topY, bottomY]) {
      const coordinateBaseline = centeredBaseline(font, coordinateSize, y, bar);
      const distanceBaseline = centeredBaseline(font, distanceSize, y, bar);
      drawScaledText(page, coordinate, { x: coordinateX, y: coordinateBaseline, size: coordinateSize, font, color: coordinateColor }, coordinateHorizontalScaleRatio);
      drawScaledText(page, distance, { x: distanceX, y: distanceBaseline, size: distanceSize, font, color: distanceColor }, distanceHorizontalScaleRatio);
    }
  }

  for (let index = firstRow; index <= lastRow; index++) {
    const cellTop = gridOriginY + index * spacing;
    const drawSpacing = spacing * scale;
    const centerY = top - (cellTop + spacing / 2 - sheetTop) * scale;
    const contentCenterY = cellTop + spacing / 2 - sheetTop;
    if (contentCenterY < 0 || contentCenterY > pageHeight) continue;
    const imageLeftContent = margin + mapLeft - sheetLeft;
    const imageRightContent = imageLeftContent + mapWidth;
    const imageLeft = pageOriginX + imageLeftContent * scale;
    const imageRight = pageOriginX + imageRightContent * scale;
    const sideStrips = [
      { x: imageLeft - bar, visible: imageLeftContent >= margin && imageLeftContent <= pageWidth - margin },
      { x: imageRight, visible: imageRightContent >= margin && imageRightContent <= pageWidth - margin },
    ];
    for (const { x, visible } of sideStrips) {
      if (!visible) continue;
      const rowNum = String(index - firstCellY + 1);
      const rowNumber = index - firstCellY + 1;
      const cellBackground = altBorderFreq > 0 && rowNumber % altBorderFreq === 0 ? backgroundAltColor : backgroundColor;
      page.drawRectangle({ x, y: centerY - drawSpacing / 2, width: bar, height: drawSpacing, color: cellBackground, borderColor, borderWidth: 0.5 * scale });
      const distance = `${(index - firstCellY+1) * 5}`;
      const stripCenterX = x + bar * 1.3;
      const rowBottom = centerY - drawSpacing / 2;
      const distanceLength = font.widthOfTextAtSize(distance, distanceSize) * distanceHorizontalScaleRatio;
      drawScaledText(page, rowNum, { x: stripCenterX - coordinateSize / 2, y: rowBottom + drawSpacing * 0.1, size: coordinateSize, font, color: coordinateColor, rotate: degrees(90) }, coordinateHorizontalScaleRatio, true);
      drawScaledText(page, distance, { x: stripCenterX - coordinateSize / 2, y: rowBottom + drawSpacing - distanceLength - drawSpacing * 0.1, size: distanceSize, font, color: distanceColor, rotate: degrees(90) }, distanceHorizontalScaleRatio, true);
    }
  }
}

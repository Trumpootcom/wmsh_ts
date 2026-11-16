import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

export function sheetLabel(row: number, column: number): string {
  let columnLabel = "";
  for (let index = column + 1; index > 0; index = Math.floor((index - 1) / 26)) {
    columnLabel = String.fromCharCode(65 + (index - 1) % 26) + columnLabel;
  }
  return `${columnLabel}${row + 1}`;
}

export function drawSheetBadge(
  page: PDFPage, font: PDFFont, row: number, column: number,
  bounds: { left: number; bottom: number; width: number; height: number },
  scale = 1,
) {
  const label = sheetLabel(row, column);
  const size = 18 * scale;
  const height = 24 * scale;
  const inset = scale;
  const radius = 6 * scale;
  const textWidth = font.widthOfTextAtSize(label, size);
  const width = Math.max(36 * scale, textWidth + 20 * scale);
  const x = bounds.left + (column === 0 ? inset : bounds.width - inset - width);
  const y = bounds.bottom + (row === 0 ? bounds.height - inset - height : inset);
  const black = rgb(0, 0, 0);
  page.drawSvgPath(
    `M ${radius} 0 H ${width - radius} Q ${width} 0 ${width} ${radius}
     V ${height - radius} Q ${width} ${height} ${width - radius} ${height}
     H ${radius} Q 0 ${height} 0 ${height - radius} V ${radius} Q 0 0 ${radius} 0 Z`,
    { x, y: y + height, color: rgb(1, 1, 1), borderColor: black, borderWidth: 1.625 * scale },
  );
  page.drawText(label, { x: x + (width - textWidth) / 2, y: y + 5.6 * scale, size, font, color: black });
}

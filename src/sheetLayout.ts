export function sheetLayout(
  { pageWidth, pageHeight, margin, overlap, rows, columns }: {
    pageWidth: number; pageHeight: number; margin: number; overlap: number; rows: number; columns: number;
  },
) {
  const sheetWidth = pageWidth - 2 * margin;
  const sheetHeight = pageHeight - 2 * margin;
  const stepX = sheetWidth - overlap;
  const stepY = sheetHeight - overlap;
  return {
    sheetWidth, sheetHeight, stepX, stepY,
    canvasWidth: sheetWidth + (columns - 1) * stepX,
    canvasHeight: sheetHeight + (rows - 1) * stepY,
  };
}

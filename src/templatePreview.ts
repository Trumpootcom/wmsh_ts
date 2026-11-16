import { drawGrid } from "./grid";
import { buildHexEdges } from "./hexGrid";
import { sheetLabel } from "./sheetBadge";
import { readTemplate } from "./template";
import { sheetLayout } from "./sheetLayout";

const previewWidth = 640;
const previewHeight = 480;

export function templatePreview(value: unknown): string {
  const grid = readTemplate(value);
  const { rows, columns } = grid;
  const { sheetWidth, sheetHeight, stepX, stepY, canvasWidth, canvasHeight } = sheetLayout(grid);
  const scale = Math.min((previewWidth - 40) / canvasWidth, (previewHeight - 40) / canvasHeight);
  const width = canvasWidth * scale;
  const height = canvasHeight * scale;
  const left = (previewWidth - width) / 2;
  const top = (previewHeight - height) / 2;
  const segments: string[] = [];
  const f = (n: number) => n.toFixed(3);

  if (grid.lineStyle.pattern !== "none" && grid.lineStyle.opacity > 0) {
    const edges = grid.style === "hex" ? buildHexEdges(grid, canvasWidth, canvasHeight) : undefined;
    // Difference and Contrast both draw black against white paper.
    const color = grid.color === "white" ? "white" : grid.color === "gray" ? "#808080" : "black";
    drawGrid({
      drawLine({ start, end, dashArray, dashPhase = 0 }) {
        const dash = dashArray?.length
          ? ` stroke-dasharray="${dashArray.map(f).join(" ")}" stroke-dashoffset="${f(-dashPhase)}"`
          : "";
        segments.push(`<path d="M ${f(start.x)} ${f(-start.y)} L ${f(end.x)} ${f(-end.y)}"${dash}/>`);
      },
    }, grid, { x: canvasWidth / 2, y: -canvasHeight / 2 },
    { left: 0, top: 0, width: canvasWidth, height: canvasHeight },
    edges && { edges, scale: 1, x: 0, y: 0 });
    const weight = Math.max(grid.lineStyle.thickness, 0.5 / scale);
    segments.unshift(`<g transform="translate(${f(left)} ${f(top)}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${weight}" opacity="${grid.lineStyle.opacity}">`);
    segments.push("</g>");
  }

  const cuts: string[] = [];
  for (let col = 1; col < columns; col++) {
    for (const edge of new Set([col * stepX, (col - 1) * stepX + sheetWidth])) {
      cuts.push(`M ${f(left + edge * scale)} ${f(top)} v ${f(height)}`);
    }
  }
  for (let row = 1; row < rows; row++) {
    for (const edge of new Set([row * stepY, (row - 1) * stepY + sheetHeight])) {
      cuts.push(`M ${f(left)} ${f(top + edge * scale)} h ${f(width)}`);
    }
  }
  const labels: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const label = sheetLabel(row, col);
      const font = Math.min(13, sheetWidth * scale / (label.length + 2), sheetHeight * scale / 2);
      const w = font * (label.length * 0.7 + 1);
      const h = font * 1.4;
      const inset = scale;
      const x = left + col * stepX * scale + (col === 0 ? inset : sheetWidth * scale - w - inset);
      const y = top + row * stepY * scale + (row === 0 ? inset : sheetHeight * scale - h - inset);
      labels.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(font / 4)}" fill="white" stroke="black"/><text x="${f(x + w / 2)}" y="${f(y + h * 0.75)}" font-size="${f(font)}">${label}</text>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${previewWidth}" height="${previewHeight}" viewBox="0 0 ${previewWidth} ${previewHeight}">
<rect width="100%" height="100%" fill="#E8E1D1"/>
<defs><clipPath id="paper"><rect x="${f(left)}" y="${f(top)}" width="${f(width)}" height="${f(height)}"/></clipPath></defs>
<rect x="${f(left)}" y="${f(top)}" width="${f(width)}" height="${f(height)}" fill="white"/>
<g clip-path="url(#paper)">${segments.join("")}</g>
<rect x="${f(left)}" y="${f(top)}" width="${f(width)}" height="${f(height)}" fill="none" stroke="hsl(42, 12%, 33%)"/>
<path d="${cuts.join(" ")}" fill="none" stroke="white" stroke-width="5"/>
<path d="${cuts.join(" ")}" fill="none" stroke="black" stroke-width="1" stroke-linecap="round" stroke-dasharray=".1 3"/>
<g font-family="sans-serif" font-weight="bold" text-anchor="middle">${labels.join("")}</g>
</svg>`;
}

import type { PDFPage, RGB } from "pdf-lib";

// Alternating stroke and gap lengths along one edge, in 64ths of that edge.
const patterns = {
  "dash-1": [16, 32, 16],
  "dash-2": [8, 16, 16, 16, 8],
  "dash-3": [5, 11, 10, 12, 10, 11, 5],
  "dash-4": [4, 8, 8, 8, 8, 8, 8, 8, 4],
  "dash-5": [3, 6, 6, 7, 6, 8, 6, 7, 6, 6, 3],
  "dash-6": [3, 5, 5, 6, 5, 6, 5, 6, 5, 6, 5, 5, 2],
  "dash-8": [2, ...Array<number>(15).fill(4), 2],
  "dash-10": [2, 3, 3, 3, 3, 3, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3, 3, 3, 3, 3, 1],
  "dash-16": [1, ...Array<number>(31).fill(2), 1],
  corners: [8, 48, 8],
};
const legacyPatterns = { dash1: [2, 2], dash3: [8, 4] };
const styleAliases = {
  line: "solid",
  dash32: "dash-1",
  dash16: "dash-2",
  dash12: "dash-3",
  dash8: "dash-4",
  dash: "dash-4",
  dash4: "dash-8",
  dash2: "dash-16",
  corner: "corners",
} as const;
type LineStyle = "solid" | "none" | keyof typeof patterns | keyof typeof legacyPatterns;
export const gridLineStyles = ["solid", "none", ...Object.keys(patterns), ...Object.keys(legacyPatterns), ...Object.keys(styleAliases)];

export function normalizeGridLineStyle(style: string): LineStyle {
  return Object.hasOwn(styleAliases, style)
    ? styleAliases[style as keyof typeof styleAliases]
    : style as LineStyle;
}
type Point = { x: number; y: number };
type Settings = {
  spacing: number;
  rotation: number;
  isoAngle: number;
  offsetX: number;
  offsetY: number;
  lineStyle: {
    pattern: LineStyle;
    thickness: number;
    color: RGB;
    opacity: number;
  };
};

function dashOptions(style: LineStyle, edgeLength: number, startIndex: number) {
  if (style === "solid" || style === "none") return {};
  if (style === "dash1" || style === "dash3") {
    const dashArray = legacyPatterns[style];
    const period = dashArray[0] + dashArray[1];
    return { dashArray, dashPhase: ((startIndex * edgeLength % period) + period) % period };
  }
  const pattern = patterns[style];
  const unit = edgeLength / 64;
  // Join adjacent end strokes and skip the portion before the intersection.
  const first = pattern[0];
  const last = pattern[pattern.length - 1];
  return {
    dashArray: [first + last, ...pattern.slice(1, -1)].map((part) => part * unit),
    dashPhase: last * unit,
  };
}

export function drawGrid(
  page: PDFPage,
  settings: Settings,
  imageCenter: Point,
  rect: { left: number; top: number; width: number; height: number },
) {
  const { spacing, rotation, isoAngle, offsetX, offsetY, lineStyle } = settings;
  const { pattern, ...stroke } = lineStyle;
  if (pattern === "none") return;

  // Port of vtt_slicer's lattice basis in PDF coordinates (positive Y is up).
  const angle = isoAngle * Math.PI / 180;
  const turn = (rotation % 360) * Math.PI / 180;
  const length = spacing / Math.sin(angle);
  const u = { x: length * Math.cos(turn), y: length * Math.sin(turn) };
  const v = { x: length * Math.cos(turn + angle), y: length * Math.sin(turn + angle) };
  const origin = {
    x: imageCenter.x + (offsetX % 1) * u.x - (offsetY % 1) * v.x,
    y: imageCenter.y + (offsetX % 1) * u.y - (offsetY % 1) * v.y,
  };
  const determinant = u.x * v.y - u.y * v.x;
  const corners = [
    { x: rect.left, y: rect.top },
    { x: rect.left + rect.width, y: rect.top },
    { x: rect.left, y: rect.top - rect.height },
    { x: rect.left + rect.width, y: rect.top - rect.height },
  ].map(({ x, y }) => {
    const dx = x - origin.x;
    const dy = y - origin.y;
    return {
      i: (dx * v.y - dy * v.x) / determinant,
      j: (u.x * dy - u.y * dx) / determinant,
    };
  });
  const i = corners.map((corner) => corner.i);
  const j = corners.map((corner) => corner.j);

  // Start and stop on lattice points outside the clip. Each sheet therefore
  // starts at the same point in the per-cell pattern, including at seams.
  for (const { along, across, distances, indices } of [
    { along: u, across: v, distances: i, indices: j },
    { along: v, across: u, distances: j, indices: i },
  ]) {
    const startIndex = Math.floor(Math.min(...distances)) - 1;
    const endIndex = Math.ceil(Math.max(...distances)) + 1;
    const dashes = dashOptions(pattern, length, startIndex);
    for (let index = Math.floor(Math.min(...indices));
      index <= Math.ceil(Math.max(...indices)); index++) {
      const x = origin.x + index * across.x;
      const y = origin.y + index * across.y;
      page.drawLine({
        start: { x: x + startIndex * along.x, y: y + startIndex * along.y },
        end: { x: x + endIndex * along.x, y: y + endIndex * along.y },
        ...stroke,
        ...dashes,
      });
    }
  }
}

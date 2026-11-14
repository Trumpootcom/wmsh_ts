import type { PDFPage, RGB } from "pdf-lib";

// Alternating stroke and gap lengths along one edge, in 64ths of that edge.
const patterns = {
  dash32: [16, 32, 16],
  dash16: [8, 16, 16, 16, 8],
  dash12: [6, 9, 12, 10, 12, 9, 6],
  dash8: [4, 8, 8, 8, 8, 8, 8, 8, 4],
  dash4: [2, ...Array<number>(15).fill(4), 2],
  corners: [8, 48, 8],
};
const legacyPatterns = { dash1: [2, 2], dash2: [4, 2], dash3: [8, 4] };
export const gridLineStyles = [
  "solid", "line", "dash32", "dash16", "dash12", "dash8", "dash", "dash4",
  "corners", "corner", "none", "dash1", "dash2", "dash3",
] as const;
type LineStyle = typeof gridLineStyles[number];
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
  if (style === "solid" || style === "line" || style === "none") return {};
  if (style === "dash1" || style === "dash2" || style === "dash3") {
    const dashArray = legacyPatterns[style];
    const period = dashArray[0] + dashArray[1];
    return { dashArray, dashPhase: ((startIndex * edgeLength % period) + period) % period };
  }
  const pattern = patterns[style === "dash" ? "dash8" : style === "corner" ? "corners" : style];
  const unit = edgeLength / 64;
  // Join the two end strokes at each intersection and start midway through it.
  const end = pattern[0] * unit;
  return { dashArray: [2 * end, ...pattern.slice(1, -1).map((part) => part * unit)], dashPhase: end };
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

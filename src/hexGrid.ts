type Point = { x: number; y: number };
type Edge = { start: Point; end: Point };
export type HexView = { edges: Edge[]; scale: number; x: number; y: number };

const corners = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];

export function buildHexEdges(
  grid: { spacing: number; isoAngle: number; rotation: number; offsetX: number; offsetY: number },
  width: number,
  height: number,
): Edge[] {
  // Flat-top hexes use integer vertex IDs. A tilt followed by uniform
  // enlargement preserves the minimum flat-to-flat clearance.
  const tilt = Math.sin(grid.isoAngle * Math.PI / 180);
  const unitX = grid.spacing / (2 * Math.sqrt(3) * tilt);
  const unitY = grid.spacing / 2;
  const angle = (grid.rotation % 360) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const offsetX = (grid.offsetX % 1) * 3 * unitX;
  const offsetY = ((grid.offsetX % 1) - 2 * (grid.offsetY % 1)) * unitY;
  const originX = width / 2 + offsetX * cos - offsetY * sin;
  const originY = -height / 2 + offsetX * sin + offsetY * cos;
  const bounds = [[0, 0], [width, 0], [0, -height], [width, -height]].map(([x, y]) => {
    const dx = x - originX;
    const dy = y - originY;
    const column = (dx * cos + dy * sin) / (3 * unitX);
    const row = ((-dx * sin + dy * cos) / unitY - column) / 2;
    return { column, row };
  });
  const minCol = Math.floor(Math.min(...bounds.map(({ column }) => column))) - 2;
  const maxCol = Math.ceil(Math.max(...bounds.map(({ column }) => column))) + 2;
  const minRow = Math.floor(Math.min(...bounds.map(({ row }) => row))) - 2;
  const maxRow = Math.ceil(Math.max(...bounds.map(({ row }) => row))) + 2;
  if ((maxCol - minCol + 1) * (maxRow - minRow + 1) > 50_000) {
    throw new Error("This hex grid is too dense for the selected canvas. Increase grid spacing or use fewer sheets.");
  }

  const vertices = new Map<string, Point>();
  const vertex = (x: number, y: number) => {
    const key = `${x},${y}`;
    const existing = vertices.get(key);
    if (existing) return existing;
    const point = {
      x: originX + x * unitX * cos - y * unitY * sin,
      y: originY + x * unitX * sin + y * unitY * cos,
    };
    vertices.set(key, point);
    return point;
  };
  const edges: Edge[] = [];
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      const x = 3 * col;
      const y = 2 * row + col;
      // Opposite sides belong to adjacent cells. Emit only one direction
      // per pair so each shared edge has a consistent dash direction.
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = corners[i];
        const [bx, by] = corners[i + 1];
        edges.push({ start: vertex(x + ax, y + ay), end: vertex(x + bx, y + by) });
      }
    }
  }
  return edges;
}

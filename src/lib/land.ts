/**
 * The land map.
 *
 * Geometry comes from assets/land-zones.json, which scripts/process-land-image.py
 * builds from the surveyor's plan. Coordinates in that file are normalised to
 * the map image; everything here works in image pixels, so the map's SVG can
 * use the image size as its viewBox and stay aligned at any screen size.
 *
 * A zone's status is data. Change "locked" to "active" in the JSON and its
 * spots appear on the map and pass checkout validation, with no code change.
 *
 * Spot ids come from the grid: "A-R41-C55" is zone A, row 41, column 55. They
 * stay stable only while the image crop, cellSizeMeters and zone codes stay
 * the same, so none of those may change once spots have been adopted.
 */

import data from "../../assets/land-zones.json";

export type Point = [number, number];

export type ZoneStatus = "active" | "locked";

export type LandZone = {
  id: string;
  /** Prefix for spot ids. */
  code: string;
  /** The block's name, shown on the map and certificates, e.g. "La Nave". */
  name: string;
  /** Shown on the map, e.g. "Coming soon". */
  label: string;
  status: ZoneStatus;
  polygon: Point[];
  /** Buildings inside the zone. No spot is offered under or against them. */
  exclusions: Point[][];
};

export type LandCell = {
  id: string;
  zoneId: string;
  row: number;
  col: number;
  /** Centre of the spot, in image pixels. */
  x: number;
  y: number;
};

const { width, height } = data.image;

const toPixels = (points: number[][]): Point[] =>
  points.map(([x, y]) => [x * width, y * height]);

export const land = {
  width,
  height,
  cellSizeMeters: data.cellSizeMeters,
  /** Spot size in image pixels. */
  cellSize: data.cellSizeMeters / data.metersPerPixel,
  boundary: toPixels(data.boundary),
  zones: data.zones.map(
    (zone): LandZone => ({
      ...zone,
      // Anything other than "active" is treated as locked, so a typo in the
      // JSON closes a zone rather than opening it.
      status: zone.status === "active" ? "active" : "locked",
      polygon: toPixels(zone.polygon),
      exclusions: zone.exclusions.map(toPixels),
    }),
  ),
};

/** Ray casting. Points exactly on an edge may fall either way. */
export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToEdges(x: number, y: number, polygon: Point[]): number {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

export function bounds(polygons: Point[][]) {
  const points = polygons.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

function spotId(zone: LandZone, row: number, col: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${zone.code}-R${pad(row)}-C${pad(col)}`;
}

/**
 * A spot is offered when its centre is inside the zone and no building
 * overlaps the circle inscribed in it. The preview in
 * scripts/process-land-image.py counts spots with the same rule.
 */
function spotAt(zone: LandZone, row: number, col: number): LandCell | null {
  const size = land.cellSize;
  const x = (col + 0.5) * size;
  const y = (row + 0.5) * size;
  if (!pointInPolygon(x, y, zone.polygon)) return null;
  for (const building of zone.exclusions) {
    if (
      pointInPolygon(x, y, building) ||
      distanceToEdges(x, y, building) < size / 2
    ) {
      return null;
    }
  }
  return { id: spotId(zone, row, col), zoneId: zone.id, row, col, x, y };
}

function zoneCells(zone: LandZone): LandCell[] {
  const size = land.cellSize;
  const box = bounds([zone.polygon]);
  const cells: LandCell[] = [];
  for (
    let row = Math.floor(box.y / size);
    row < Math.ceil((box.y + box.height) / size);
    row++
  ) {
    for (
      let col = Math.floor(box.x / size);
      col < Math.ceil((box.x + box.width) / size);
      col++
    ) {
      const cell = spotAt(zone, row, col);
      if (cell) cells.push(cell);
    }
  }
  return cells;
}

/** Names of the blocks open for adoption now, e.g. ["La Nave"]. */
export const openZoneNames = land.zones
  .filter((z) => z.status === "active")
  .map((z) => z.name);

/** Every spot that can be adopted, across all active zones. */
export const openCells: LandCell[] = land.zones
  .filter((z) => z.status === "active")
  .flatMap(zoneCells);

const SPOT_ID = /^([A-Z]+)-R(\d+)-C(\d+)$/;

/**
 * Any spot on the map, whatever its zone's status. Checkout must also check
 * `zone.status`; certificates only need the zone name.
 */
export function getCell(id: string): (LandCell & { zone: LandZone }) | undefined {
  const match = SPOT_ID.exec(id);
  if (!match) return undefined;
  const zone = land.zones.find((z) => z.code === match[1]);
  if (!zone) return undefined;
  const cell = spotAt(zone, Number(match[2]), Number(match[3]));
  // Only the canonical spelling counts, so "A-R041-C55" cannot slip past a
  // taken check made against "A-R41-C55".
  return cell && cell.id === id ? { ...cell, zone } : undefined;
}

/** Roughly the point furthest inside a polygon, for placing a label. */
export function labelPoint(polygon: Point[]): Point {
  const box = bounds([polygon]);
  const step = Math.max(box.width, box.height) / 60;
  let best: Point = [box.x + box.width / 2, box.y + box.height / 2];
  let bestDistance = -1;
  for (let y = box.y; y <= box.y + box.height; y += step) {
    for (let x = box.x; x <= box.x + box.width; x += step) {
      if (!pointInPolygon(x, y, polygon)) continue;
      const d = distanceToEdges(x, y, polygon);
      if (d > bestDistance) {
        bestDistance = d;
        best = [x, y];
      }
    }
  }
  return best;
}

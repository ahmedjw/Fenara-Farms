/**
 * The farm, plot by plot.
 *
 * Geometry comes from assets/farm-data.json: the four plots traced from the
 * estate's aerial photograph, the ridge above them, the pond in Lago, and a
 * position for every tree. The file carries layout only. A tree's variety and
 * whether it is adopted come from here and from the adoption store, never from
 * that file.
 *
 * Adoptions keep storing the spot ids of the older survey map, so each
 * adoptable tree is paired with one of those spots. Customers see the tree id
 * ("LN-012"); the store keeps the spot id ("A-R46-C51"). `treeForSpot` and
 * `spotForTree` translate between them.
 *
 * That pairing is written into farm-data.json, one `spot` per tree, and must
 * stay written. It used to be derived: the open plots' trees were sorted and
 * handed the open cells of the land map in order. Deleting the six trees the
 * barn was built over shifted every tree after them onto the next tree's
 * spot, so ids already sold pointed at the wrong tree and one live spot was
 * blocked by a record belonging to a tree that no longer exists.
 *
 * To open another plot, give each of its trees a `spot` in the data. A tree
 * without one is not offered, which is the safe way to fail.
 */

import data from "../../assets/farm-data.json";

export type Point = [number, number];

export type FarmPlot = {
  id: string;
  /** Prefix of its tree ids, e.g. "LN". */
  code: string;
  name: string;
  /** The plot's colour on the map. */
  color: string;
  description: string;
  polygon: Point[];
  labelAt: Point;
  /** Whether its trees can be adopted this season. */
  open: boolean;
};

/** Something built on the land. No tree stands here any more. */
export type FarmBuilding = {
  id: string;
  plotId: string;
  name: string;
  polygon: Point[];
};

export type FarmTree = {
  id: string;
  plotId: string;
  x: number;
  y: number;
  row: number;
  pos: number;
  /** The stored id of this tree's adoption, when it is open for adoption. */
  spotId?: string;
};

/** Plots whose trees can be adopted this season. Add an id to open another. */
const OPEN_PLOTS = new Set(["nave"]);

const [vx, vy, vw, vh] = data.viewBox.split(" ").map(Number);

export const viewBox = { x: vx, y: vy, width: vw, height: vh };

export const plots: FarmPlot[] = data.plots.map((plot) => ({
  ...plot,
  polygon: plot.polygon as Point[],
  labelAt: plot.labelAt as Point,
  open: OPEN_PLOTS.has(plot.id),
}));

export const ridge = data.ridge as Point[];
export const pond = data.pond;

/**
 * Buildings standing in the plots. They are drawn on the map and no tree is
 * listed under them: the barn in La Nave went up over six trees, and those
 * trees are gone from the data rather than marked unavailable.
 */
export const buildings: FarmBuilding[] = data.buildings.map((b) => ({
  id: b.id,
  plotId: b.plot,
  name: b.name,
  polygon: b.polygon as Point[],
}));

const plotById = new Map(plots.map((p) => [p.id, p]));

/** The stored spot a tree is sold as, straight from the data. */
const spotOf = (tree: { spot?: string }): string | undefined => tree.spot;

export const trees: FarmTree[] = data.trees.map((tree) => ({
  id: tree.id,
  plotId: tree.plot,
  x: tree.x,
  y: tree.y,
  row: tree.row,
  pos: tree.pos,
  // A spot only counts while its plot is open, so closing a plot takes its
  // trees off the market without touching the pairing it will come back with.
  spotId: plotById.get(tree.plot)?.open ? spotOf(tree) : undefined,
}));

export const treeById = new Map(trees.map((tree) => [tree.id, tree]));

const treeBySpot = new Map(
  trees.filter((t) => t.spotId).map((tree) => [tree.spotId!, tree]),
);

/** The tree a stored adoption refers to, if it is one of ours. */
export function treeForSpot(spotId: string): FarmTree | undefined {
  return treeBySpot.get(spotId);
}

/** What to store when someone adopts this tree. */
export function spotForTree(treeId: string): string | undefined {
  return treeById.get(treeId)?.spotId;
}

export function plotOf(tree: FarmTree): FarmPlot {
  return plotById.get(tree.plotId)!;
}

export function getPlot(id: string): FarmPlot | undefined {
  return plotById.get(id);
}

/** Trees that can be adopted at all, whether or not they already are. */
export const adoptableTrees = trees.filter((tree) => tree.spotId);

/** The plots open this season, for the copy that names them. */
export const openPlots = plots.filter((plot) => plot.open);

/** e.g. "La Nave", or "La Nave and El Lago" once a second one opens. */
export const openPlotNames = openPlots
  .map((p) => p.name)
  .reduce((text, name, i, all) =>
    i === 0 ? name : i === all.length - 1 ? `${text} and ${name}` : `${text}, ${name}`,
  "");

export function bounds(polygon: Point[]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

export function polygonPath(polygon: Point[]): string {
  return `M${polygon.map((p) => p.join(",")).join("L")}Z`;
}

/** The transform that zooms the map to a plot, from the handoff's maths. */
export function zoomToPlot(plot: FarmPlot) {
  const box = bounds(plot.polygon);
  const pad = 40;
  const scale =
    Math.min(
      viewBox.width / (box.x1 - box.x0 + pad * 2),
      viewBox.height / (box.y1 - box.y0 + pad * 2),
    ) * 0.96;
  return {
    scale,
    x: viewBox.x + viewBox.width / 2 - (scale * (box.x0 + box.x1)) / 2,
    y: viewBox.y + viewBox.height / 2 - (scale * (box.y0 + box.y1)) / 2,
  };
}

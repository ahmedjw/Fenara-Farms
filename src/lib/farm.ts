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
 */

import data from "../../assets/farm-data.json";
import { openCells } from "./land";

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

const plotById = new Map(plots.map((p) => [p.id, p]));

/**
 * Trees in open plots, in planting order, take the spots of the old map in
 * their own order. The pairing only has to be stable, which it is as long as
 * neither the plots nor the spots change.
 */
export const trees: FarmTree[] = (() => {
  const all: FarmTree[] = data.trees.map((tree) => ({
    id: tree.id,
    plotId: tree.plot,
    x: tree.x,
    y: tree.y,
    row: tree.row,
    pos: tree.pos,
  }));

  const adoptable = all
    .filter((tree) => plotById.get(tree.plotId)?.open)
    .sort(
      (a, b) =>
        a.plotId.localeCompare(b.plotId) || a.row - b.row || a.pos - b.pos,
    );
  adoptable.forEach((tree, i) => {
    // More trees than spots would leave the last of them unadoptable, so open
    // another zone in assets/land-zones.json when opening another plot here.
    tree.spotId = openCells[i]?.id;
  });

  return all;
})();

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

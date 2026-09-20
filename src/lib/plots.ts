/**
 * What to show for an adopted id.
 *
 * Adoptions hold the spot ids of the survey map ("A-R41-C55"). On screen those
 * are the trees of the farm map ("LN-012"), so `label` is what to print and the
 * stored id stays out of sight. Ids from before either map ("NAV-014") still
 * resolve, so older adoptions keep displaying.
 */

import { plotOf, treeForSpot } from "./farm";
import { getCell, land } from "./land";
import { groveFacts } from "./site";
import { blocks, getTree } from "./trees";

export type PlotDescription = {
  /** What to call this adoption on screen, e.g. "LN-012". */
  label: string;
  /** One line for the certificate, e.g. "La Nave". */
  place: string;
  facts: { label: string; value: string }[];
};

export function describePlot(id: string): PlotDescription {
  const tree = treeForSpot(id);
  if (tree) {
    const plot = plotOf(tree);
    return {
      label: tree.id,
      place: plot.name,
      facts: [
        { label: "Plot", value: plot.name },
        { label: "Variety", value: "Picual" },
        { label: "Age", value: groveFacts.treeAge },
        { label: "Row · Position", value: `${tree.row} · ${tree.pos}` },
      ],
    };
  }

  // A spot with no tree paired to it: still a real adoption, just off the map.
  const cell = getCell(id);
  if (cell) {
    const metres = Math.round(land.cellSizeMeters);
    return {
      label: id,
      place: cell.zone.name,
      facts: [
        { label: "Block", value: cell.zone.name },
        { label: "Variety", value: "Picual" },
        { label: "Age", value: groveFacts.treeAge },
        { label: "Spot", value: `${metres} × ${metres} m` },
      ],
    };
  }

  const older = getTree(id);
  const block = older && blocks.find((b) => b.id === older.block);
  if (older && block) {
    return {
      label: id,
      place: block.name,
      facts: [
        { label: "Block", value: block.name },
        { label: "Age", value: groveFacts.treeAge },
      ],
    };
  }

  return { label: id, place: "", facts: [] };
}

/**
 * What to show for an adopted id.
 *
 * Adoptions made through the land map hold spot ids ("A-R41-C55"). Older ones
 * hold tree ids from the grove plan ("NAV-014"). Certificates and the account
 * page read both through here, so neither needs to know which kind it has.
 */

import { getCell, land } from "./land";
import { blocks, getTree } from "./trees";

export type PlotDescription = {
  /** One line for the certificate, e.g. "East parcel". */
  place: string;
  facts: { label: string; value: string }[];
};

export function describePlot(id: string): PlotDescription {
  const cell = getCell(id);
  if (cell) {
    const metres = Math.round(land.cellSizeMeters);
    return {
      place: cell.zone.name,
      facts: [
        { label: "Parcel", value: cell.zone.name },
        { label: "Spot", value: `${metres} × ${metres} m` },
        { label: "Variety", value: "Picual" },
      ],
    };
  }

  const tree = getTree(id);
  const block = tree && blocks.find((b) => b.id === tree.block);
  if (tree && block) {
    return {
      place: `${block.name}, ${tree.age} years old`,
      facts: [
        { label: "Block", value: block.name },
        { label: "Age", value: `${tree.age} years` },
        { label: "Last season", value: `${tree.lastYield} L` },
      ],
    };
  }

  return { place: "", facts: [] };
}

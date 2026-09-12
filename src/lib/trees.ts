/**
 * The grove.
 *
 * Tree positions are generated deterministically from a seeded PRNG so that
 * the server and the client always agree on the layout, and so the map stays
 * identical between page loads. Real groves are planted in rows but never
 * perfectly, hence the jitter.
 *
 * To swap in a survey of the real estate later, replace `buildGrove()` with a
 * loader that reads your own coordinates. Nothing else needs to change.
 */

export type TreeStatus = "available" | "adopted" | "reserved";

export type Tree = {
  id: string;
  block: BlockId;
  /** Position as a percentage of the map viewport. */
  x: number;
  y: number;
  age: number;
  status: TreeStatus;
  /** Litres of oil this tree produced last season. */
  lastYield: number;
};

export type BlockId = "solana" | "cerro" | "umbria" | "fuente";

export const blocks: {
  id: BlockId;
  name: string;
  prefix: string;
  note: string;
  rows: number;
  cols: number;
  /** Bounding box on the map, in percent. */
  box: { x: number; y: number; w: number; h: number };
}[] = [
  {
    id: "solana",
    name: "La Solana",
    prefix: "SOL",
    note: "South facing, the warmest block. First to ripen every year.",
    rows: 5,
    cols: 9,
    box: { x: 7, y: 9, w: 36, h: 20 },
  },
  {
    id: "cerro",
    name: "El Cerro",
    prefix: "CER",
    note: "The high ground. Oldest trees on the estate, some over 200 years.",
    rows: 4,
    cols: 8,
    box: { x: 56, y: 9, w: 36, h: 20 },
  },
  {
    id: "umbria",
    name: "La Umbría",
    prefix: "UMB",
    note: "Shaded slope. Slower ripening gives a greener, more peppery oil.",
    rows: 4,
    cols: 9,
    box: { x: 7, y: 44, w: 36, h: 20 },
  },
  {
    id: "fuente",
    name: "La Fuente",
    prefix: "FUE",
    note: "Beside the old spring. The cover crop took hold here first.",
    rows: 4,
    cols: 8,
    box: { x: 56, y: 44, w: 36, h: 20 },
  },
];

/** Small deterministic PRNG (mulberry32). Same seed, same grove, always. */
function seeded(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGrove(): Tree[] {
  const rand = seeded(20260908);
  const trees: Tree[] = [];

  for (const block of blocks) {
    let n = 0;
    for (let row = 0; row < block.rows; row++) {
      for (let col = 0; col < block.cols; col++) {
        n++;
        const stepX = block.box.w / Math.max(1, block.cols - 1);
        const stepY = block.box.h / Math.max(1, block.rows - 1);

        // Jitter so the planting reads as hand-set rather than a spreadsheet.
        const jx = (rand() - 0.5) * stepX * 0.42;
        const jy = (rand() - 0.5) * stepY * 0.42;

        const roll = rand();
        const status: TreeStatus =
          roll > 0.82 ? "adopted" : roll > 0.76 ? "reserved" : "available";

        trees.push({
          id: `${block.prefix}-${String(n).padStart(3, "0")}`,
          block: block.id,
          x: +(block.box.x + col * stepX + jx).toFixed(2),
          y: +(block.box.y + row * stepY + jy).toFixed(2),
          age:
            block.id === "cerro"
              ? Math.round(120 + rand() * 95)
              : Math.round(28 + rand() * 62),
          status,
          lastYield: +(1.4 + rand() * 2.3).toFixed(1),
        });
      }
    }
  }

  return trees;
}

export const grove: Tree[] = buildGrove();

export function getTree(id: string): Tree | undefined {
  return grove.find((t) => t.id === id.toUpperCase());
}

export function getBlock(id: BlockId) {
  return blocks.find((b) => b.id === id);
}

export const groveStats = {
  total: grove.length,
  available: grove.filter((t) => t.status === "available").length,
  oldest: grove.reduce((a, b) => (a.age > b.age ? a : b)).age,
};

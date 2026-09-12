"use client";

import { useMemo, useState } from "react";
import { blocks, grove, type BlockId, type Tree } from "@/lib/trees";

/**
 * The grove map.
 *
 * Two modes. In "browse" it is a read-only plan of the estate. In "select" it
 * is the tree picker used inside the adoption flow, capped at `limit` trees.
 *
 * Drawn as a survey plan rather than a satellite view: it is honest about what
 * we actually know of the estate, and far more legible at small sizes than a
 * photographic map would be.
 */

type Props = {
  mode?: "browse" | "select";
  limit?: number;
  taken?: string[];
  selected?: string[];
  onSelect?: (ids: string[]) => void;
};

const statusColor: Record<string, string> = {
  available: "var(--color-olive-mid)",
  reserved: "var(--color-stone-light)",
  adopted: "var(--color-stone-light)",
};

export function GroveMap({
  mode = "browse",
  limit = 1,
  taken = [],
  selected = [],
  onSelect,
}: Props) {
  const [filter, setFilter] = useState<BlockId | "all">("all");
  const [active, setActive] = useState<Tree | null>(null);

  const takenSet = useMemo(() => new Set(taken), [taken]);

  const trees = useMemo(
    () => (filter === "all" ? grove : grove.filter((t) => t.block === filter)),
    [filter],
  );

  function isAvailable(tree: Tree) {
    return tree.status === "available" && !takenSet.has(tree.id);
  }

  function toggle(tree: Tree) {
    if (mode !== "select" || !onSelect) {
      setActive(tree);
      return;
    }
    if (!isAvailable(tree)) return;

    if (selected.includes(tree.id)) {
      onSelect(selected.filter((id) => id !== tree.id));
      return;
    }
    // At the cap, drop the earliest pick so a click always does something.
    onSelect(
      selected.length >= limit
        ? [...selected.slice(1), tree.id]
        : [...selected, tree.id],
    );
  }

  const activeBlock = active ? blocks.find((b) => b.id === active.block) : null;

  // Filtering zooms the plan to that block. On a phone the whole-estate view
  // puts the trees about three pixels apart, which is not a tappable target.
  const viewBox = (() => {
    if (filter === "all") return "0 0 100 74";
    const b = blocks.find((x) => x.id === filter)!;
    return `${b.box.x - 6} ${b.box.y - 7} ${b.box.w + 12} ${b.box.h + 13}`;
  })();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-[2px] border px-3 py-1.5 text-[12px] transition-colors ${
            filter === "all"
              ? "border-olive bg-olive text-paper"
              : "border-line-strong text-stone hover:border-ink hover:text-ink"
          }`}
        >
          Whole estate
        </button>
        {blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setFilter(b.id)}
            className={`rounded-[2px] border px-3 py-1.5 text-[12px] transition-colors ${
              filter === b.id
                ? "border-olive bg-olive text-paper"
                : "border-line-strong text-stone hover:border-ink hover:text-ink"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
        <div className="relative overflow-hidden rounded-[2px] border border-line bg-paper-raised">
          <svg
            viewBox={viewBox}
            className="block h-auto w-full"
            role="img"
            aria-label="Plan of the Fenara Farms olive grove showing every tree"
          >
            <defs>
              <pattern
                id="grove-hatch"
                width="3"
                height="3"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M0 3 L3 0"
                  stroke="var(--color-line)"
                  strokeWidth="0.25"
                />
              </pattern>
            </defs>

            <rect
              x="2"
              y="2"
              width="96"
              height="70"
              fill="url(#grove-hatch)"
              stroke="var(--color-line-strong)"
              strokeWidth="0.3"
            />

            {/* The old spring line running across the estate. */}
            <path
              d="M2 37 C 26 34, 44 41, 62 36 S 92 33, 98 36"
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth="0.45"
              strokeDasharray="1.6 1.2"
            />

            {blocks.map((b) => {
              const dim = filter !== "all" && filter !== b.id;
              return (
                <g key={b.id} opacity={dim ? 0.25 : 1}>
                  <rect
                    x={b.box.x - 2.5}
                    y={b.box.y - 2.5}
                    width={b.box.w + 5}
                    height={b.box.h + 5}
                    fill="none"
                    stroke="var(--color-line-strong)"
                    strokeWidth="0.25"
                  />
                  <text
                    x={b.box.x - 2.5}
                    y={b.box.y - 3.6}
                    fill="var(--color-stone)"
                    fontSize="2.1"
                    fontFamily="var(--font-geist-mono), ui-monospace, monospace"
                    letterSpacing="0.18"
                  >
                    {b.name.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {trees.map((tree) => {
              const picked = selected.includes(tree.id);
              const free = isAvailable(tree);
              const reachable = mode === "browse" || free;

              return (
                <g key={tree.id}>
                  {picked && (
                    <circle
                      cx={tree.x}
                      cy={tree.y}
                      r="2.1"
                      fill="none"
                      stroke="var(--color-brick)"
                      strokeWidth="0.4"
                    />
                  )}
                  <circle
                    cx={tree.x}
                    cy={tree.y}
                    r={picked ? 1.15 : 0.95}
                    fill={picked ? "var(--color-brick)" : statusColor[tree.status]}
                    opacity={free ? 1 : 0.42}
                    pointerEvents="none"
                  />
                  <circle
                    cx={tree.x}
                    cy={tree.y}
                    r="2.4"
                    fill="transparent"
                    className={
                      mode === "select" && !free
                        ? "cursor-not-allowed"
                        : "cursor-pointer"
                    }
                    onMouseEnter={() => setActive(tree)}
                    onFocus={() => setActive(tree)}
                    onClick={() => toggle(tree)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(tree);
                      }
                    }}
                    tabIndex={reachable ? 0 : -1}
                    role={mode === "select" ? "checkbox" : "button"}
                    aria-checked={mode === "select" ? picked : undefined}
                    aria-label={`Tree ${tree.id}, ${tree.age} years old, ${
                      free ? "available" : "already adopted"
                    }`}
                  />
                </g>
              );
            })}
          </svg>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-[12px] text-stone">
            <Key color="var(--color-olive-mid)" label="Available" />
            <Key color="var(--color-stone-light)" label="Adopted" dim />
            {mode === "select" && (
              <Key color="var(--color-brick)" label="Your pick" />
            )}
          </div>
        </div>

        <aside className="rounded-[2px] border border-line bg-paper-raised p-5">
          {active && activeBlock ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                Tree
              </p>
              <p className="display mt-1 text-[30px] leading-none text-olive">
                {active.id}
              </p>
              <dl className="mt-5 space-y-2.5 text-[13px]">
                <Row label="Block" value={activeBlock.name} />
                <Row label="Variety" value="Picual" />
                <Row label="Age" value={`${active.age} years`} />
                <Row label="Last season" value={`${active.lastYield} L of oil`} />
                <Row
                  label="Status"
                  value={isAvailable(active) ? "Available" : "Already adopted"}
                />
              </dl>
              <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-stone">
                {activeBlock.note}
              </p>
              {mode === "select" && isAvailable(active) && (
                <button
                  type="button"
                  onClick={() => toggle(active)}
                  className="mt-5 w-full rounded-[2px] border border-olive bg-olive px-4 py-2.5 text-[13px] text-paper transition-colors hover:bg-olive-mid"
                >
                  {selected.includes(active.id)
                    ? "Remove this tree"
                    : "Choose this tree"}
                </button>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col justify-center">
              <p className="text-[14px] leading-relaxed text-stone">
                {mode === "select"
                  ? `Pick ${limit} ${
                      limit === 1 ? "tree" : "trees"
                    } from the plan. Hover any dot to see its age, block and last yield.`
                  : "Hover or tap any tree on the plan to see its age, block and how much oil it gave last season."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Key({
  color,
  label,
  dim,
}: {
  color: string;
  label: string;
  dim?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color, opacity: dim ? 0.42 : 1 }}
      />
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

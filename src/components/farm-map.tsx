"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MagnifyingGlass, Tree, X } from "@phosphor-icons/react";
import {
  adoptableTrees,
  getPlot,
  plotOf,
  plots,
  polygonPath,
  pond,
  ridge,
  treeById,
  trees,
  viewBox,
  zoomToPlot,
  type FarmPlot,
  type FarmTree,
} from "@/lib/farm";

/**
 * The farm map.
 *
 * Four plots traced from the estate's aerial photograph, every tree a dot on
 * its plot. Picking a plot zooms to it; picking a tree opens its details. Only
 * trees in open plots can be adopted, and only when the map is given onSelect;
 * everywhere else the map is for browsing.
 *
 * Selections are reported as the stored spot id, so the rest of the site keeps
 * working in the ids it already uses.
 */

export type TreeSelection = {
  plotId: string;
  treeId: string;
  spotId: string;
};

type Props = {
  /** Stored spot ids of the trees currently picked. */
  selectedSpotIds?: string[];
  /** Stored spot ids already adopted. */
  takenSpotIds?: string[];
  /** How many trees can be held at once. At the cap, a new pick replaces the earliest. */
  limit?: number;
  onSelect?: (selection: TreeSelection, selectedSpotIds: string[]) => void;
};

type Status = "available" | "adopted" | "closed";
type Filter = "all" | "available" | "adopted";

const DOT = 4.2;

export function FarmMap({
  selectedSpotIds = [],
  takenSpotIds = [],
  limit = 1,
  onSelect,
}: Props) {
  const [plotId, setPlotId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [missed, setMissed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const treeRefs = useRef(new Map<string, SVGCircleElement>());

  const taken = useMemo(() => new Set(takenSpotIds), [takenSpotIds]);
  const selected = useMemo(() => new Set(selectedSpotIds), [selectedSpotIds]);

  const statusOf = (tree: FarmTree): Status =>
    !tree.spotId
      ? "closed"
      : taken.has(tree.spotId)
        ? "adopted"
        : "available";

  const plot = plotId ? getPlot(plotId) : undefined;
  const tree = treeId ? treeById.get(treeId) : undefined;
  const view = plot ? zoomToPlot(plot) : { scale: 1, x: 0, y: 0 };

  /** Where a point sits on the card, as a percentage, with the zoom applied. */
  const at = (x: number, y: number) => ({
    left: `${((x * view.scale + view.x - viewBox.x) / viewBox.width) * 100}%`,
    top: `${((y * view.scale + view.y - viewBox.y) / viewBox.height) * 100}%`,
  });

  const counts = useMemo(() => {
    const byPlot = new Map(
      plots.map((p) => [p.id, { total: 0, available: 0, adopted: 0 }]),
    );
    for (const t of trees) {
      const row = byPlot.get(t.plotId)!;
      row.total += 1;
      const status = statusOf(t);
      if (status === "available") row.available += 1;
      if (status === "adopted") row.adopted += 1;
    }
    return byPlot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken]);

  const shown = (t: FarmTree) =>
    filter === "all" ? true : statusOf(t) === filter;

  function choose(target: FarmTree) {
    setTreeId(target.id);
    setPlotId(target.plotId);
    setMissed(false);
    if (!onSelect || !target.spotId || taken.has(target.spotId)) return;

    const spotId = target.spotId;
    const picked = selected.has(spotId);
    const next = picked
      ? selectedSpotIds.filter((id) => id !== spotId)
      : selectedSpotIds.length >= limit
        ? // At the cap, drop the earliest pick so a click always does something.
          [...selectedSpotIds.slice(1), spotId]
        : [...selectedSpotIds, spotId];

    setAnnouncement(
      `${picked ? "Removed" : "Chose"} tree ${target.id}. ${next.length} of ${limit} chosen.`,
    );
    onSelect({ plotId: target.plotId, treeId: target.id, spotId }, next);
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    const found = trees.find(
      (t) => t.id.toLowerCase() === query.trim().toLowerCase(),
    );
    if (!found) {
      setMissed(true);
      return;
    }
    setMissed(false);
    setTreeId(found.id);
    setPlotId(found.plotId);
  }

  /** Arrow keys walk the planting: along a row, then across rows. */
  function onKey(e: KeyboardEvent<SVGCircleElement>, current: FarmTree) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(current);
      return;
    }
    const step = (
      {
        ArrowRight: [0, 1],
        ArrowLeft: [0, -1],
        ArrowDown: [1, 0],
        ArrowUp: [-1, 0],
      } as Record<string, [number, number]>
    )[e.key];
    if (!step) return;
    e.preventDefault();
    const family = adoptableTrees.filter((t) => t.plotId === current.plotId);
    const next = family.find(
      (t) => t.row === current.row + step[0] && t.pos === current.pos + step[1],
    );
    const fallback = step[0]
      ? family.find((t) => t.row === current.row + step[0])
      : undefined;
    const target = next ?? fallback;
    if (target) {
      setTreeId(target.id);
      treeRefs.current.get(target.id)?.focus();
    }
  }

  const tabStop =
    (tree?.spotId && tree.id) ??
    adoptableTrees.find((t) => !taken.has(t.spotId!))?.id ??
    adoptableTrees[0]?.id;

  const hovered = hoverId ? treeById.get(hoverId) : undefined;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!plotId} onClick={() => { setPlotId(null); setTreeId(null); }}>
            All plots
          </Chip>
          {plots.map((p) => (
            <Chip
              key={p.id}
              active={plotId === p.id}
              onClick={() => { setPlotId(p.id); setTreeId(null); }}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </Chip>
          ))}
        </div>

        <div
          className="flex items-center gap-1 rounded-full border border-line bg-paper-raised p-1"
          role="group"
          aria-label="Filter trees"
        >
          {(
            [
              ["all", "All"],
              ["available", "Available"],
              ["adopted", "Adopted"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                filter === id
                  ? "bg-olive text-paper"
                  : "text-stone hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Map */}
        <div className="relative min-w-0 overflow-hidden rounded-[2px] border border-line bg-paper-sunk">
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="block max-h-[82vh] w-full touch-manipulation select-none"
            role="group"
            aria-label="Map of the farm. Four plots, every tree on the estate."
            onClick={() => setTreeId(null)}
          >
            <g
              className="motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[cubic-bezier(.4,0,.2,1)]"
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: "0 0",
              }}
            >
              {/* The hill above the plots. Nothing is planted on it. */}
              <polygon
                points={ridge.map((p) => p.join(",")).join(" ")}
                fill="var(--color-stone-light)"
                opacity="0.5"
              />
              <text
                x={760}
                y={470}
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontStyle="italic"
                fontSize="15"
                fill="var(--color-stone)"
              >
                ridge · not planted
              </text>

              {plots.map((p) => {
                const active = !plotId || plotId === p.id;
                return (
                  <path
                    key={p.id}
                    d={polygonPath(p.polygon)}
                    fill={`${p.color}${active ? "55" : "22"}`}
                    stroke={p.color}
                    strokeWidth={plotId === p.id ? 3 / view.scale : 2}
                    opacity={active ? 1 : 0.45}
                    className="cursor-pointer motion-safe:transition-[fill,opacity] motion-safe:duration-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlotId(p.id);
                      setTreeId(null);
                    }}
                  >
                    <title>{p.name}</title>
                  </path>
                );
              })}

              <ellipse
                cx={pond.cx}
                cy={pond.cy}
                rx={pond.rx}
                ry={pond.ry}
                transform={`rotate(${pond.rotate} ${pond.cx} ${pond.cy})`}
                fill="#4f86b3"
                opacity="0.9"
              />

              {trees.filter(shown).map((t) => {
                const status = statusOf(t);
                const isPicked = Boolean(t.spotId && selected.has(t.spotId));
                const isOpen = treeId === t.id;
                const r =
                  (DOT * (isOpen ? 2 : hoverId === t.id ? 1.5 : 1)) / view.scale;
                const fill = isPicked
                  ? "var(--color-brick)"
                  : status === "adopted"
                    ? "var(--color-paper)"
                    : status === "closed"
                      ? "var(--color-stone-light)"
                      : "var(--color-olive)";
                return (
                  <circle
                    key={t.id}
                    ref={(el) => {
                      if (el) treeRefs.current.set(t.id, el);
                      else treeRefs.current.delete(t.id);
                    }}
                    cx={t.x}
                    cy={t.y}
                    r={r}
                    fill={fill}
                    stroke={
                      isPicked || status === "adopted"
                        ? isPicked
                          ? "var(--color-paper)"
                          : "var(--color-olive)"
                        : undefined
                    }
                    strokeWidth={(isPicked ? 2 : 1.4) / view.scale}
                    opacity={plotId && plotId !== t.plotId ? 0.3 : 1}
                    tabIndex={t.id === tabStop ? 0 : -1}
                    role={onSelect && status === "available" ? "checkbox" : "button"}
                    aria-checked={onSelect && status === "available" ? isPicked : undefined}
                    aria-label={`Tree ${t.id}, ${plotOf(t).name}, ${
                      status === "adopted"
                        ? "already adopted"
                        : status === "closed"
                          ? "not open this season"
                          : isPicked
                            ? "your pick"
                            : "available"
                    }`}
                    className="cursor-pointer outline-none focus-visible:stroke-brick motion-safe:transition-[r]"
                    onClick={(e) => {
                      e.stopPropagation();
                      choose(t);
                    }}
                    onKeyDown={(e) => onKey(e, t)}
                    onMouseEnter={() => setHoverId(t.id)}
                    onMouseLeave={() => setHoverId((id) => (id === t.id ? null : id))}
                    onFocus={() => setTreeId(t.id)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Plot names, in HTML so they stay readable at any zoom. */}
          {plots.map((p) => {
            const count = counts.get(p.id)!;
            return (
              <span
                key={p.id}
                aria-hidden
                style={{ ...at(p.labelAt[0], p.labelAt[1]), opacity: plotId ? 0 : 1 }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-center transition-opacity duration-300 [text-shadow:0_0_6px_var(--color-paper),0_0_12px_var(--color-paper)]"
              >
                <span className="display block text-[clamp(14px,2.4vw,26px)] font-bold text-ink">
                  {p.name}
                </span>
                <span className="block font-mono text-[clamp(10px,1.2vw,13px)] tracking-[0.06em] text-stone">
                  {p.open
                    ? `${count.available} of ${count.total} available`
                    : `${count.total} trees`}
                </span>
              </span>
            );
          })}

          {hovered && (
            <span
              aria-hidden
              style={at(hovered.x, hovered.y)}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-[115%] rounded-[2px] bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-paper"
            >
              {hovered.id} · {plotOf(hovered).name} ·{" "}
              {statusOf(hovered) === "adopted"
                ? "adopted"
                : statusOf(hovered) === "closed"
                  ? "opens later"
                  : "available"}
            </span>
          )}

          <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[2px] bg-paper/85 px-3 py-2 text-[12px] text-stone">
            <Key className="bg-olive" label="Available" />
            <Key className="border border-olive bg-paper" label="Adopted" />
            {onSelect && <Key className="bg-brick" label="Your pick" />}
            <Key className="bg-stone-light" label="Opens later" />
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          {tree ? (
            <TreeCard
              tree={tree}
              status={statusOf(tree)}
              picked={Boolean(tree.spotId && selected.has(tree.spotId))}
              onClose={() => setTreeId(null)}
              onChoose={onSelect ? () => choose(tree) : undefined}
            />
          ) : plot ? (
            <PlotCard plot={plot} count={counts.get(plot.id)!} />
          ) : (
            <ul className="flex flex-col gap-3">
              {plots.map((p) => {
                const count = counts.get(p.id)!;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPlotId(p.id)}
                      className="grid w-full grid-cols-[14px_1fr_auto] items-center gap-4 rounded-[2px] border border-line bg-paper-raised p-4 text-left transition-colors hover:border-ink"
                    >
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-[2px]"
                        style={{ background: p.color }}
                      />
                      <span>
                        <span className="display block text-[19px] leading-tight text-ink">
                          {p.name}
                        </span>
                        <span className="block text-[13px] leading-snug text-stone">
                          {p.description}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="display block text-[22px] leading-none text-olive">
                          {p.open ? count.available : "—"}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-stone">
                          {p.open ? `of ${count.total} free` : "opens later"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={search} className="flex gap-2">
            <label htmlFor="tree-search" className="sr-only">
              Find a tree by its number
            </label>
            <input
              id="tree-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMissed(false);
              }}
              placeholder="Find a tree by number, e.g. LN-012"
              className="min-w-0 flex-1 rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[14px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-[2px] bg-olive px-4 py-3 text-[13px] font-medium text-paper transition-colors hover:bg-olive-mid"
            >
              <MagnifyingGlass size={15} weight="bold" />
              Go
            </button>
          </form>
          {missed && (
            <p className="text-[13px] text-brick">No tree with that number.</p>
          )}
        </div>
      </div>

      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function PlotCard({ plot, count }: { plot: FarmPlot; count: { total: number; available: number; adopted: number } }) {
  const adoptedShare = count.total ? Math.round((count.adopted / count.total) * 100) : 0;
  return (
    <div
      className="rounded-[2px] border border-line bg-paper-raised p-6"
      style={{ borderTop: `5px solid ${plot.color}` }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
        Plot
      </p>
      <h3 className="display mt-1 text-[32px] leading-none text-olive">
        {plot.name}
      </h3>
      <p className="mt-3 text-[14px] leading-relaxed text-stone">
        {plot.description}
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <Tile label="Trees" value={String(count.total)} />
        <Tile label="Available" value={plot.open ? String(count.available) : "—"} />
        <Tile label="Adopted" value={String(count.adopted)} />
      </dl>

      {plot.open ? (
        <>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-paper-sunk">
            <div
              className="h-full rounded-full"
              style={{ width: `${adoptedShare}%`, background: plot.color }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-stone">
            {adoptedShare}% adopted
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-stone">
            Click any tree on the map to see its details.
          </p>
        </>
      ) : (
        <p className="mt-5 text-[13px] leading-relaxed text-stone">
          This plot is not open for adoption yet. Its trees are on the map so you
          can see the whole estate.
        </p>
      )}
    </div>
  );
}

function TreeCard({
  tree,
  status,
  picked,
  onClose,
  onChoose,
}: {
  tree: FarmTree;
  status: Status;
  picked: boolean;
  onClose: () => void;
  onChoose?: () => void;
}) {
  const plot = plotOf(tree);
  return (
    <div
      className="rounded-[2px] border border-line bg-paper-raised p-6 shadow-[0_12px_30px_-18px_rgba(20,24,26,0.35)]"
      style={{ borderTop: `5px solid ${plot.color}` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
            {plot.name}
          </p>
          <h3 className="display mt-1 text-[34px] leading-none text-olive">
            {tree.id}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tree details"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-ink transition-colors hover:bg-line"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      <div
        className="mt-5 flex h-[120px] items-center justify-center rounded-[2px]"
        style={{ background: `${plot.color}22` }}
        aria-hidden
      >
        <Tree size={38} weight="light" style={{ color: plot.color }} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <Fact label="Variety" value="Picual" />
        <Fact label="Plot" value={plot.name} />
        <Fact
          label="Status"
          value={
            status === "adopted"
              ? "Adopted"
              : status === "closed"
                ? "Opens later"
                : picked
                  ? "Your pick"
                  : "Available"
          }
          strong={status === "available"}
        />
        <Fact label="Row · Position" value={`${tree.row} · ${tree.pos}`} />
      </dl>

      {status === "available" &&
        (onChoose ? (
          <button
            type="button"
            onClick={onChoose}
            className="mt-6 w-full rounded-[2px] bg-olive px-4 py-3.5 text-[15px] font-medium text-paper transition-colors hover:bg-olive-mid"
          >
            {picked ? `Remove ${tree.id}` : `Choose ${tree.id}`}
          </button>
        ) : (
          <Link
            href="/adopt"
            className="mt-6 flex w-full items-center justify-center rounded-[2px] bg-olive px-4 py-3.5 text-[15px] font-medium text-paper transition-colors hover:bg-olive-mid"
          >
            Adopt {tree.id}
          </Link>
        ))}

      {status === "adopted" && (
        <p className="mt-6 rounded-[2px] bg-paper-sunk p-4 text-[13px] leading-relaxed text-stone">
          This tree is adopted for the season. Its oil goes to whoever looks
          after it.
        </p>
      )}
      {status === "closed" && (
        <p className="mt-6 rounded-[2px] bg-paper-sunk p-4 text-[13px] leading-relaxed text-stone">
          {plot.name} opens for adoption in a later season.
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] transition-colors ${
        active
          ? "border-olive bg-olive text-paper"
          : "border-line-strong bg-paper-raised text-stone hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] bg-paper-sunk p-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-stone">
        {label}
      </dt>
      <dd className="display mt-1 text-[24px] leading-none text-ink">{value}</dd>
    </div>
  );
}

function Fact({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone">
        {label}
      </dt>
      <dd className={`mt-1 text-[15px] ${strong ? "font-medium text-olive" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

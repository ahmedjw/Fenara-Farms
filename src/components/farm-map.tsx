"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  Tree,
  X,
} from "@phosphor-icons/react";
import { pointInPolygon } from "@/lib/land";
import type { TreeHolds } from "@/lib/store";
import {
  adoptableTrees,
  buildings,
  getPlot,
  openPlots,
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
  /** Stored spot ids someone has paid for. */
  adoptedSpotIds?: string[];
  /** Stored spot ids held by a checkout in progress. These can come back. */
  reservedSpotIds?: string[];
  /** How many trees can be held at once. At the cap, a new pick replaces the earliest. */
  limit?: number;
  onSelect?: (selection: TreeSelection, selectedSpotIds: string[]) => void;
  /** Keep asking the server what is still free. For the picker, not the tours. */
  live?: boolean;
  /** Called when the live answer changes, so a picker can drop a lost tree. */
  onHoldsChange?: (holds: TreeHolds) => void;
};

type Status = "available" | "reserved" | "adopted" | "closed";
type Filter = "all" | "available" | "taken";

/** Radius of the drawn dot, in map units before the zoom is applied. */
const DOT = 4.2;

/**
 * Radius of the focus ring drawn around a tree reached by keyboard.
 *
 * Pointer input does not use this. Giving each tree its own hit circle was the
 * obvious approach and it does not work: the trees are 15 map units apart, so
 * a circle big enough to be comfortable overlaps its neighbours, and one small
 * enough not to comes out at 13 CSS pixels across — half of WCAG 2.5.8's 24px
 * minimum, and the reason picking a tree felt like threading a needle.
 * Pointer input goes through `nearestTree` instead.
 */
const HIT = 8;

/**
 * How near the pointer must come to a tree, in map units, to mean it.
 *
 * Roughly one and a half times the planting spacing, so anywhere inside a plot
 * lands on something, while the ridge and the empty ground between plots
 * select nothing.
 */
const NEAR = 26;

/**
 * How far a finger may travel and still count as a tap, in CSS pixels.
 *
 * Anything more was a scroll. Touch needs the allowance; a mouse click
 * comfortably comes in under it.
 */
const TAP_SLOP = 12;

/** How often the picker asks the server what is still free. */
const POLL_MS = 20_000;

/** Dot, ring and hover halo for each state. */
const LOOKS: Record<
  Status | "picked",
  { fill: string; stroke?: string; dash?: boolean; halo: string }
> = {
  available: { fill: "var(--color-olive)", halo: "var(--color-olive)" },
  picked: {
    fill: "var(--color-brick)",
    stroke: "var(--color-paper)",
    halo: "var(--color-brick)",
  },
  // Hollow with a broken ring: held, but not necessarily gone.
  reserved: {
    fill: "var(--color-paper)",
    stroke: "var(--color-brick)",
    dash: true,
    halo: "var(--color-brick)",
  },
  adopted: {
    fill: "var(--color-paper)",
    stroke: "var(--color-olive)",
    halo: "var(--color-olive)",
  },
  closed: { fill: "var(--color-stone-light)", halo: "var(--color-stone)" },
};

const WORDS: Record<Status, string> = {
  available: "available",
  reserved: "on hold",
  adopted: "adopted",
  closed: "opens later",
};

export function FarmMap({
  selectedSpotIds = [],
  adoptedSpotIds = [],
  reservedSpotIds = [],
  limit = 1,
  onSelect,
  live = false,
  onHoldsChange,
}: Props) {
  // Someone here to pick a tree starts zoomed into the plot they can pick
  // from. At the whole-estate view the trees are 14 CSS pixels apart; inside a
  // plot they are 40, which is the difference between aiming and just
  // pointing. Browsing still opens on the whole estate.
  const [plotId, setPlotId] = useState<string | null>(
    onSelect ? (openPlots[0]?.id ?? null) : null,
  );
  const [treeId, setTreeId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [missed, setMissed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const treeRefs = useRef(new Map<string, SVGCircleElement>());
  const svgRef = useRef<SVGSVGElement>(null);
  const tapStart = useRef<{ x: number; y: number; id: number } | null>(null);

  // What the server last said. Seeded from the render, then kept current by
  // the poll below, so a tree taken while someone deliberates greys out under
  // them instead of failing at checkout.
  const [holds, setHolds] = useState<TreeHolds>(() => ({
    adopted: adoptedSpotIds,
    reserved: reservedSpotIds,
  }));
  const fromServer = `${adoptedSpotIds.join()}|${reservedSpotIds.join()}`;
  const lastFromServer = useRef(fromServer);
  useEffect(() => {
    // A fresh render of the page wins over anything the poll has learned.
    if (lastFromServer.current === fromServer) return;
    lastFromServer.current = fromServer;
    setHolds({ adopted: adoptedSpotIds, reserved: reservedSpotIds });
  }, [fromServer, adoptedSpotIds, reservedSpotIds]);

  const report = useRef(onHoldsChange);
  report.current = onHoldsChange;

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as TreeHolds;
        if (stopped || !Array.isArray(next.adopted)) return;
        setHolds(next);
        report.current?.(next);
      } catch {
        // Offline, or the tab went away mid-request. The next tick retries.
      }
    };
    const timer = setInterval(pull, POLL_MS);
    // Coming back to the tab is when the snapshot is most likely to be stale.
    const onShow = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [live]);

  const adopted = useMemo(() => new Set(holds.adopted), [holds.adopted]);
  const reserved = useMemo(() => new Set(holds.reserved), [holds.reserved]);
  const selected = useMemo(() => new Set(selectedSpotIds), [selectedSpotIds]);

  const statusOf = useCallback(
    (tree: FarmTree): Status =>
      !tree.spotId
        ? "closed"
        : adopted.has(tree.spotId)
          ? "adopted"
          : reserved.has(tree.spotId)
            ? "reserved"
            : "available",
    [adopted, reserved],
  );

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
      plots.map((p) => [
        p.id,
        { total: 0, available: 0, reserved: 0, adopted: 0 },
      ]),
    );
    for (const t of trees) {
      const row = byPlot.get(t.plotId)!;
      row.total += 1;
      const status = statusOf(t);
      if (status === "available") row.available += 1;
      if (status === "reserved") row.reserved += 1;
      if (status === "adopted") row.adopted += 1;
    }
    return byPlot;
  }, [statusOf]);

  const shown = (t: FarmTree) => {
    if (filter === "all") return true;
    const status = statusOf(t);
    return filter === "available"
      ? status === "available"
      : status === "adopted" || status === "reserved";
  };

  const visible = useMemo(
    () => trees.filter(shown),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, statusOf],
  );

  /** Turns a pointer position into coordinates in the layer the trees live in. */
  const pointIn = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      // Undo the zoom the trees are drawn inside.
      return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
    },
    [view.x, view.y, view.scale],
  );

  /**
   * The tree the pointer means: the nearest one, within NEAR.
   *
   * This is Voronoi hit testing, the usual answer for picking small marks on a
   * chart — every point on the map belongs to whichever tree is closest, so
   * each tree's target is as large as it can be without stealing from its
   * neighbours, and there is no dead space to miss into. Measuring all 482
   * trees is quicker than it sounds and exact, so there is no triangulation
   * library here to keep in step with the data.
   */
  const nearestTree = useCallback(
    (x: number, y: number): FarmTree | null => {
      let best: FarmTree | null = null;
      let bestDistance = NEAR * NEAR;
      for (const t of visible) {
        const dx = t.x - x;
        const dy = t.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestDistance) {
          bestDistance = d;
          best = t;
        }
      }
      return best;
    },
    [visible],
  );

  function choose(target: FarmTree) {
    setTreeId(target.id);
    setPlotId(target.plotId);
    setMissed(false);
    if (!onSelect || !target.spotId || statusOf(target) !== "available") return;

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

  /** The trees of a plot in planting order, for stepping through them. */
  const family = useCallback(
    (plot: string) =>
      trees
        .filter((t) => t.plotId === plot)
        .sort((a, b) => a.row - b.row || a.pos - b.pos),
    [],
  );

  /** Move the open tree one along the planting. */
  function stepTree(delta: number) {
    if (!tree) return;
    const row = family(tree.plotId);
    const i = row.findIndex((t) => t.id === tree.id);
    const next = row[(i + delta + row.length) % row.length];
    if (!next) return;
    setTreeId(next.id);
    setHoverId(next.id);
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
    adoptableTrees.find((t) => statusOf(t) === "available")?.id ??
    adoptableTrees[0]?.id;

  const hovered = hoverId ? treeById.get(hoverId) : undefined;

  const closedPlots = plots.filter((p) => !p.open);
  const openTotal = openPlots.reduce(
    (n, p) => n + (counts.get(p.id)?.available ?? 0),
    0,
  );

  return (
    <div>
      {/* One plot is open this season. Say so before anything else, because
          three of the four blocks on the map cannot be adopted at all. */}
      <div className="mb-4 flex flex-col gap-2 rounded-[2px] border border-olive-mid/40 bg-olive/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] text-ink">
          {openPlots.map((p) => (
            <span key={p.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-olive/30"
                style={{ background: p.color }}
              />
              <span className="font-medium">{p.name}</span>
            </span>
          ))}
          <span>
            {openPlots.length === 1 ? "is the only plot" : "are the only plots"}{" "}
            open this season, with {openTotal}{" "}
            {openTotal === 1 ? "tree" : "trees"} still free.
          </span>
        </p>
        <p className="text-[13px] leading-snug text-stone">
          {closedPlots.map((p) => p.name).join(", ")} open in later seasons.
        </p>
      </div>

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
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  p.open ? "" : "opacity-40"
                }`}
                style={{ background: p.color }}
              />
              <span className={p.open || plotId === p.id ? "" : "text-stone-light"}>
                {p.name}
              </span>
              {!p.open && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-70">
                  later
                </span>
              )}
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
              ["taken", "Taken"],
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
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="block max-h-[82vh] w-full touch-manipulation select-none"
            role="group"
            aria-label="Map of the farm. Four plots, every tree on the estate."
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

              {/* A closed plot is washed out and outlined in dashes, so the
                  one plot you can actually adopt from reads first. */}
              {plots.map((p) => {
                const active = !plotId || plotId === p.id;
                return (
                  <path
                    key={p.id}
                    d={polygonPath(p.polygon)}
                    fill={`${p.color}${p.open ? (active ? "66" : "2a") : active ? "1f" : "12"}`}
                    stroke={p.open ? p.color : `${p.color}88`}
                    strokeDasharray={p.open ? undefined : 8 / view.scale}
                    strokeWidth={
                      plotId === p.id ? 3 / view.scale : p.open ? 2.75 : 1.5
                    }
                    opacity={active ? 1 : 0.45}
                    pointerEvents="none"
                    className="motion-safe:transition-[fill,opacity] motion-safe:duration-300"
                  >
                    <title>{p.name}</title>
                  </path>
                );
              })}

              {/* Built since the aerial survey. The trees that stood here
                  are gone from the data, not merely marked unavailable. */}
              {buildings.map((b) => (
                <path
                  key={b.id}
                  d={polygonPath(b.polygon)}
                  fill="var(--color-ink)"
                  fillOpacity={plotId && plotId !== b.plotId ? 0.12 : 0.62}
                  stroke="var(--color-ink)"
                  strokeWidth={1.5 / view.scale}
                  className="motion-safe:transition-[fill-opacity] motion-safe:duration-300"
                >
                  <title>{b.name}</title>
                </path>
              ))}

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
                const isHot = hoverId === t.id || isOpen;
                const pickable = Boolean(onSelect) && status === "available";
                const dimmed = Boolean(plotId && plotId !== t.plotId);
                const look = LOOKS[isPicked ? "picked" : status];
                const r = (DOT * (isOpen ? 1.9 : isHot ? 1.45 : 1)) / view.scale;
                const label = `Tree ${t.id}, ${plotOf(t).name}, ${
                  isPicked ? "your pick" : WORDS[status]
                }`;
                return (
                  <g
                    key={t.id}
                    opacity={dimmed ? 0.3 : 1}
                    className="motion-safe:transition-opacity motion-safe:duration-300"
                  >
                    {/* A halo under the pointer, so the tree you are about to
                        click reads as the size of its target, not its dot. */}
                    {isHot && !dimmed && (
                      <circle
                        cx={t.x}
                        cy={t.y}
                        r={(DOT * 2.6) / view.scale}
                        fill={look.halo}
                        fillOpacity={0.22}
                        pointerEvents="none"
                      />
                    )}
                    <circle
                      cx={t.x}
                      cy={t.y}
                      r={r}
                      fill={look.fill}
                      stroke={look.stroke}
                      strokeWidth={(isPicked ? 2.2 : 1.4) / view.scale}
                      strokeDasharray={
                        look.dash
                          ? `${2.6 / view.scale} ${2 / view.scale}`
                          : undefined
                      }
                      pointerEvents="none"
                      className="motion-safe:transition-[r] motion-safe:duration-150"
                    />
                    {/* Keyboard and screen readers reach a tree here: one
                        focusable, labelled node each, with a focus ring big
                        enough to see. It takes no pointer events — the mouse
                        and touch go through the overlay below the map, which
                        picks by proximity instead of by direct hit. */}
                    <circle
                      ref={(el) => {
                        if (el) treeRefs.current.set(t.id, el);
                        else treeRefs.current.delete(t.id);
                      }}
                      cx={t.x}
                      cy={t.y}
                      r={HIT}
                      fill="none"
                      strokeWidth={2 / view.scale}
                      pointerEvents="none"
                      tabIndex={t.id === tabStop ? 0 : -1}
                      role={pickable ? "checkbox" : "button"}
                      aria-checked={pickable ? isPicked : undefined}
                      aria-label={label}
                      className="outline-none focus-visible:stroke-brick"
                      onKeyDown={(e) => onKey(e, t)}
                      onFocus={() => setTreeId(t.id)}
                    />
                  </g>
                );
              })}
            </g>

            {/*
              Every pointer event on the map lands here, and is handed to
              whichever tree is nearest. Drawn last so it sits above the trees,
              which take no pointer events of their own any more.

              This is what makes a 7px dot comfortable to hit: you are not
              aiming at the dot, you are pointing at the region around it, and
              the regions tile the whole plot. Clicks that fall near no tree
              fall through to the plot underneath, which is how zooming by
              clicking a plot still works.
            */}
            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill="transparent"
              className={hoverId ? "cursor-pointer" : "cursor-default"}
              onPointerMove={(e) => {
                // Touch has no hover; a tap goes straight to onClick.
                if (e.pointerType !== "mouse") return;
                const at = pointIn(e);
                setHoverId(at ? (nearestTree(at.x, at.y)?.id ?? null) : null);
              }}
              onPointerLeave={() => setHoverId(null)}
              // Taps are read from the pointer itself rather than from a click
              // event. On touch that is the difference between working and
              // not: it fires without waiting on a synthetic click, and a
              // finger that moved was a scroll, not a choice.
              onPointerDown={(e) => {
                tapStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
              }}
              onPointerCancel={() => {
                tapStart.current = null;
              }}
              onPointerUp={(e) => {
                const start = tapStart.current;
                tapStart.current = null;
                if (!start || start.id !== e.pointerId) return;
                if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) {
                  return;
                }
                const at = pointIn(e);
                if (!at) return;
                const near = nearestTree(at.x, at.y);
                if (near) {
                  choose(near);
                  return;
                }
                const under = plots.find((p) =>
                  pointInPolygon(at.x, at.y, p.polygon),
                );
                setTreeId(null);
                if (under) setPlotId(under.id);
              }}
            />
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
                    : `${count.total} trees · opens later`}
                </span>
              </span>
            );
          })}

          {buildings.map((b) => {
            const centre = b.polygon.reduce(
              (acc, [x, y]) => [acc[0] + x / b.polygon.length, acc[1] + y / b.polygon.length],
              [0, 0],
            );
            return (
              <span
                key={b.id}
                aria-hidden
                style={{ ...at(centre[0], centre[1]), opacity: plotId === b.plotId ? 1 : 0 }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper transition-opacity duration-300"
              >
                {b.name}
              </span>
            );
          })}

          {hovered && (
            <span
              aria-hidden
              style={at(hovered.x, hovered.y)}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-[115%] rounded-[2px] bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-paper"
            >
              <span className="font-medium">{hovered.id}</span>
              <span className="mx-1.5 text-paper/50">·</span>
              {plotOf(hovered).name}
              <span className="mx-1.5 text-paper/50">·</span>
              <span
                className={
                  hovered.spotId && selected.has(hovered.spotId)
                    ? "text-olive-soft"
                    : statusOf(hovered) === "available"
                      ? "text-olive-soft"
                      : "text-paper/70"
                }
              >
                {hovered.spotId && selected.has(hovered.spotId)
                  ? "your pick"
                  : WORDS[statusOf(hovered)]}
              </span>
            </span>
          )}

          <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[2px] bg-paper/85 px-3 py-2 text-[12px] text-stone">
            <Key className="bg-olive" label="Available" />
            <Key
              className="border border-dashed border-brick bg-paper"
              label="On hold"
            />
            <Key className="border border-olive bg-paper" label="Adopted" />
            {onSelect && <Key className="bg-brick" label="Your pick" />}
            <Key className="bg-stone-light" label="Opens later" />
            <Key className="bg-ink/60" label="Barn" />
          </div>
        </div>

        {/*
          What you just tapped, right under the map.

          On a phone the details panel below stacks under the map and off the
          bottom of the screen, so a tap looked like it had done nothing. On a
          phone the trees are also only about 16px apart at best, so landing on
          a neighbour is easy: the arrows step one tree along the planting,
          which turns a near miss into a single tap rather than another try at
          threading the needle.
        */}
        {tree && (
          <div className="flex items-center gap-2 rounded-[2px] border border-line-strong bg-paper-raised p-2 lg:hidden">
            <NudgeButton label="Previous tree" onClick={() => stepTree(-1)}>
              <CaretLeft size={16} weight="bold" />
            </NudgeButton>

            <div className="min-w-0 flex-1 text-center">
              <p className="display text-[20px] leading-none text-olive">
                {tree.id}
              </p>
              <p className="mt-1 text-[12px] leading-none text-stone">
                {plotOf(tree).name}
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                <span
                  className={
                    statusOf(tree) === "available" ? "text-olive-mid" : "text-brick"
                  }
                >
                  {tree.spotId && selected.has(tree.spotId)
                    ? "your pick"
                    : WORDS[statusOf(tree)]}
                </span>
              </p>
            </div>

            <NudgeButton label="Next tree" onClick={() => stepTree(1)}>
              <CaretRight size={16} weight="bold" />
            </NudgeButton>

            {onSelect && statusOf(tree) === "available" && (
              <button
                type="button"
                onClick={() => choose(tree)}
                className={`shrink-0 rounded-[2px] px-4 py-3 text-[14px] font-medium transition-colors ${
                  tree.spotId && selected.has(tree.spotId)
                    ? "border border-line-strong text-ink"
                    : "bg-olive text-paper"
                }`}
              >
                {tree.spotId && selected.has(tree.spotId) ? "Remove" : "Choose"}
              </button>
            )}
          </div>
        )}

        {/*
          Side panel.

          Hidden on a phone while picking. It is 500px of tree details and a
          search box between the map and the Continue button, and on a 664px
          screen that put Continue two thirds of a screen below the fold: you
          chose a tree and then had to go looking for the way forward. The bar
          above already says which tree you got and offers Choose, Remove and
          the neighbours, so nothing here is lost that matters at that width.
          Browsing keeps it, because there the panel is the point.
        */}
        <div className={`flex-col gap-4 ${onSelect ? "hidden lg:flex" : "flex"}`}>
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
                      className={`grid w-full grid-cols-[14px_1fr_auto] items-center gap-4 rounded-[2px] border p-4 text-left transition-colors hover:border-ink ${
                        p.open
                          ? "border-olive-mid/50 bg-paper-raised"
                          : "border-line bg-paper-raised/60"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-3.5 w-3.5 rounded-[2px] ${p.open ? "" : "opacity-40"}`}
                        style={{ background: p.color }}
                      />
                      <span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={`display text-[19px] leading-tight ${
                              p.open ? "text-ink" : "text-stone"
                            }`}
                          >
                            {p.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
                              p.open
                                ? "bg-olive text-paper"
                                : "border border-line-strong text-stone"
                            }`}
                          >
                            {p.open ? "Open now" : "Opens later"}
                          </span>
                        </span>
                        <span
                          className={`mt-0.5 block text-[13px] leading-snug ${
                            p.open ? "text-stone" : "text-stone-light"
                          }`}
                        >
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

function PlotCard({
  plot,
  count,
}: {
  plot: FarmPlot;
  count: { total: number; available: number; reserved: number; adopted: number };
}) {
  const adoptedShare = count.total ? Math.round((count.adopted / count.total) * 100) : 0;
  return (
    <div
      className="rounded-[2px] border border-line bg-paper-raised p-6"
      style={{ borderTop: `5px solid ${plot.color}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
          Plot
        </p>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
            plot.open ? "bg-olive text-paper" : "border border-line-strong text-stone"
          }`}
        >
          {plot.open ? "Open now" : "Opens later"}
        </span>
      </div>
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
          {count.reserved > 0 && (
            <p className="mt-3 text-[13px] leading-relaxed text-stone">
              <span className="text-brick">{count.reserved}</span>{" "}
              {count.reserved === 1 ? "tree is" : "trees are"} on hold while
              someone finishes checking out. Those come back if they do not.
            </p>
          )}
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
            picked
              ? "Your pick"
              : status === "available"
                ? "Available"
                : status === "reserved"
                  ? "On hold"
                  : status === "adopted"
                    ? "Adopted"
                    : "Opens later"
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

      {status === "reserved" && (
        <p className="mt-6 rounded-[2px] border-l-2 border-brick bg-paper-sunk p-4 text-[13px] leading-relaxed text-stone">
          Someone is at the checkout with this tree. If they do not finish it
          comes back, usually within half an hour, so it is worth looking again.
        </p>
      )}
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

/** A step-one-tree-along button, sized for a thumb. */
function NudgeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-line-strong text-ink transition-colors hover:border-ink active:bg-paper-sunk"
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

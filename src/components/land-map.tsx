"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { getImageProps } from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { LockSimple, Tree } from "@phosphor-icons/react";
import landImage from "../../assets/land-clean-cropped.png";
import {
  bounds,
  labelPoint,
  land,
  openCells,
  pointInPolygon,
  type LandCell,
  type LandZone,
  type Point,
} from "@/lib/land";
import { site } from "@/lib/site";

/**
 * The land map.
 *
 * The surveyor's plan of the estate with the zones from assets/land-zones.json
 * drawn over it. Spots in active zones can be chosen; locked zones stay visible
 * but closed. The photo is drawn inside the SVG rather than behind it, so the
 * overlay and the land share one coordinate system and cannot drift apart when
 * the view zooms or the screen resizes.
 */

export type LandSelection = {
  zoneId: string;
  cellId: string;
  /** Centre of the spot, 0 to 1 across and down the map image. */
  x: number;
  y: number;
};

type Props = {
  selectedCellIds?: string[];
  takenCellIds?: string[];
  /** How many spots can be held at once. At the cap, a new pick replaces the earliest. */
  limit?: number;
  /** Called on every pick and unpick, with the spot and the updated selection. */
  onSelect?: (selection: LandSelection, selectedCellIds: string[]) => void;
};

// Next serves the 3 MB PNG as AVIF or WebP. An SVG <image> cannot take a
// srcset, so ask for the one optimised URL directly.
const { props: photo } = getImageProps({
  src: landImage,
  alt: "",
  width: land.width,
  height: land.height,
});

const size = land.cellSize;
const spotMetres = Math.round(land.cellSizeMeters);
const activeZones = land.zones.filter((z) => z.status === "active");
const lockedZones = land.zones.filter((z) => z.status !== "active");
const cellById = new Map(openCells.map((c) => [c.id, c]));
const cellAt = new Map(openCells.map((c) => [`${c.row}:${c.col}`, c]));
const zoneById = new Map(land.zones.map((z) => [z.id, z]));

const estateView = { x: 0, y: 0, width: land.width, height: land.height };

// The open parcels plus a margin, widened to at least 4:3 so the view does not
// run far below the fold on a desktop.
const parcelView = (() => {
  if (!activeZones.length) return null;
  const box = bounds(activeZones.map((z) => z.polygon));
  const pad = size * 1.5;
  const height = box.height + pad * 2;
  const width = Math.max(box.width + pad * 2, (height * 4) / 3);
  return {
    x: box.x + box.width / 2 - width / 2,
    y: box.y - pad,
    width,
    height,
  };
})();

const lockedLabels = lockedZones.map((zone) => ({
  zone,
  at: labelPoint(zone.polygon),
}));

const points = (polygon: Point[]) => polygon.map((p) => p.join(",")).join(" ");

type Focus = { cell: LandCell } | { zone: LandZone } | null;

const focusKey = (f: Focus) => (!f ? "" : "cell" in f ? f.cell.id : f.zone.id);

export function LandMap({
  selectedCellIds = [],
  takenCellIds = [],
  limit = 1,
  onSelect,
}: Props) {
  const reduce = useReducedMotion();
  const hatchId = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [view, setView] = useState<"parcel" | "estate">(
    parcelView ? "parcel" : "estate",
  );
  const [active, setActive] = useState<Focus>(null);
  const [announcement, setAnnouncement] = useState("");
  const cellRefs = useRef(new Map<string, SVGRectElement>());
  const scroller = useRef<HTMLDivElement>(null);

  // When the view is wider than the screen, start with the parcel centred
  // rather than at the left edge.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [view]);

  const taken = useMemo(() => new Set(takenCellIds), [takenCellIds]);
  const selected = useMemo(() => new Set(selectedCellIds), [selectedCellIds]);

  const box = view === "parcel" && parcelView ? parcelView : estateView;

  // One tab stop for the whole grid; arrow keys move between spots.
  const activeCell = active && "cell" in active ? active.cell : null;
  const tabStop =
    activeCell?.id ??
    selectedCellIds.find((id) => cellById.has(id)) ??
    openCells.find((c) => !taken.has(c.id))?.id ??
    openCells[0]?.id;

  function statusOf(cell: LandCell) {
    return taken.has(cell.id)
      ? "Already adopted"
      : selected.has(cell.id)
        ? "Your pick"
        : "Available";
  }

  function choose(cell: LandCell) {
    setActive({ cell });
    if (!onSelect || taken.has(cell.id)) return;

    const picked = selected.has(cell.id);
    const next = picked
      ? selectedCellIds.filter((id) => id !== cell.id)
      : selectedCellIds.length >= limit
        ? // At the cap, drop the earliest pick so a click always does something.
          [...selectedCellIds.slice(1), cell.id]
        : [...selectedCellIds, cell.id];

    setAnnouncement(
      `${picked ? "Removed" : "Chose"} spot ${cell.id}. ${next.length} of ${limit} chosen.`,
    );
    onSelect(
      {
        zoneId: cell.zoneId,
        cellId: cell.id,
        x: cell.x / land.width,
        y: cell.y / land.height,
      },
      next,
    );
  }

  /** What is under the pointer: an open spot, a zone, or nothing. */
  function locate(e: MouseEvent<SVGSVGElement>): Focus {
    const matrix = e.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    // Only a point inside an open zone can pick a spot. Points in the zone but
    // off the grid, such as the buildings, still show the zone.
    const open = activeZones.find((z) => pointInPolygon(p.x, p.y, z.polygon));
    if (open) {
      const cell = cellAt.get(
        `${Math.floor(p.y / size)}:${Math.floor(p.x / size)}`,
      );
      return cell ? { cell } : { zone: open };
    }
    const closed = lockedZones.find((z) => pointInPolygon(p.x, p.y, z.polygon));
    return closed ? { zone: closed } : null;
  }

  function onKey(e: KeyboardEvent<SVGRectElement>, cell: LandCell) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(cell);
      return;
    }
    const step = (
      {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      } as Record<string, [number, number]>
    )[e.key];
    if (!step) return;
    e.preventDefault();
    // Skip over gaps such as the buildings to the next spot in that direction.
    for (let n = 1; n <= 60; n++) {
      const next = cellAt.get(`${cell.row + step[0] * n}:${cell.col + step[1] * n}`);
      if (next) {
        setActive({ cell: next });
        cellRefs.current.get(next.id)?.focus();
        return;
      }
    }
  }

  const activeZone = active
    ? "cell" in active
      ? zoneById.get(active.cell.zoneId)
      : active.zone
    : undefined;

  return (
    <div>
      {parcelView && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["parcel", "Open parcel"],
              ["estate", site.estateName],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`rounded-[2px] border px-3 py-1.5 text-[12px] transition-colors ${
                view === id
                  ? "border-olive bg-olive text-paper"
                  : "border-line-strong text-stone hover:border-ink hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="min-w-0 overflow-hidden rounded-[2px] border border-line bg-paper-sunk">
          {/* On a phone the open parcel scrolls sideways rather than shrinking, so a spot stays tappable. */}
          <div ref={scroller} className="overflow-x-auto">
            <div
              className={`relative ${
                view === "parcel" ? "min-w-[700px] sm:min-w-0" : ""
              }`}
            >
              <svg
                viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
                className="block h-auto w-full touch-manipulation select-none"
                role="group"
                aria-label="Plan of the estate. Choose a spot inside the open parcel."
                onClick={(e) => {
                  const found = locate(e);
                  if (found && "cell" in found) choose(found.cell);
                  else setActive(found);
                }}
                onMouseMove={(e) => {
                  const found = locate(e);
                  if (found && focusKey(found) !== focusKey(active)) {
                    setActive(found);
                  }
                }}
              >
                <defs>
                  <pattern
                    id={hatchId}
                    width="14"
                    height="14"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="14"
                      stroke="var(--color-paper)"
                      strokeOpacity="0.55"
                      strokeWidth="3"
                    />
                  </pattern>
                </defs>

                <image
                  href={photo.src}
                  x="0"
                  y="0"
                  width={land.width}
                  height={land.height}
                  preserveAspectRatio="none"
                />

                {lockedZones.map((zone) => (
                  <g key={zone.id} className="cursor-not-allowed">
                    <title>{`${zone.name}: ${zone.label}`}</title>
                    <polygon
                      points={points(zone.polygon)}
                      fill="var(--color-ink)"
                      fillOpacity="0.3"
                    />
                    <polygon
                      points={points(zone.polygon)}
                      fill={`url(#${hatchId})`}
                    />
                  </g>
                ))}

                <polygon
                  points={points(land.boundary)}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeOpacity="0.45"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <polygon
                  points={points(land.boundary)}
                  fill="none"
                  stroke="var(--color-paper)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />

                {activeZones.map((zone) => (
                  <polygon
                    key={zone.id}
                    points={points(zone.polygon)}
                    fill="none"
                    stroke="var(--color-paper)"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ))}

                <g>
                  {openCells.map((cell) => {
                    const isTaken = taken.has(cell.id);
                    const isPicked = selected.has(cell.id);
                    return (
                      <rect
                        key={cell.id}
                        ref={(el) => {
                          if (el) cellRefs.current.set(cell.id, el);
                          else cellRefs.current.delete(cell.id);
                        }}
                        x={cell.x - size / 2 + 1}
                        y={cell.y - size / 2 + 1}
                        width={size - 2}
                        height={size - 2}
                        vectorEffect="non-scaling-stroke"
                        strokeWidth="1"
                        role="checkbox"
                        aria-checked={isPicked}
                        aria-disabled={isTaken || undefined}
                        aria-label={`Spot ${cell.id}, ${statusOf(cell).toLowerCase()}`}
                        tabIndex={cell.id === tabStop ? 0 : -1}
                        onKeyDown={(e) => onKey(e, cell)}
                        onFocus={() => setActive({ cell })}
                        className={`outline-none focus-visible:stroke-brick focus-visible:[stroke-width:3] motion-safe:transition-colors motion-safe:duration-150 ${
                          isTaken
                            ? "cursor-not-allowed fill-stone-light/75 stroke-stone-light"
                            : isPicked
                              ? "cursor-pointer fill-brick/25 stroke-brick"
                              : "cursor-pointer fill-paper/5 stroke-paper/60 hover:fill-paper/40 hover:stroke-paper"
                        }`}
                      />
                    );
                  })}
                </g>

                {openCells
                  .filter((cell) => selected.has(cell.id))
                  .map((cell) => (
                    <motion.g
                      key={`pick-${cell.id}`}
                      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                      pointerEvents="none"
                    >
                      <circle
                        cx={cell.x}
                        cy={cell.y}
                        r={size * 0.36}
                        fill="var(--color-brick)"
                        stroke="var(--color-paper)"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                      <Tree
                        x={cell.x - size * 0.22}
                        y={cell.y - size * 0.22}
                        size={size * 0.44}
                        weight="fill"
                        color="var(--color-paper)"
                      />
                    </motion.g>
                  ))}
              </svg>

              {/* HTML rather than SVG text, so the label reads the same at any zoom. */}
              {lockedLabels.map(({ zone, at }) => {
                const left = ((at[0] - box.x) / box.width) * 100;
                const top = ((at[1] - box.y) / box.height) * 100;
                if (left < 8 || left > 92 || top < 5 || top > 95) return null;
                return (
                  <span
                    key={zone.id}
                    className="pointer-events-none absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[2px] bg-ink/80 px-2.5 py-1 text-[12px] whitespace-nowrap text-paper"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    aria-hidden
                  >
                    <LockSimple size={12} weight="bold" />
                    {zone.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-paper-raised px-4 py-3 text-[12px] text-stone">
            <Key className="border border-olive-mid" label="Available" />
            <Key className="bg-stone-light" label="Taken" />
            {onSelect && <Key className="rounded-full bg-brick" label="Your pick" />}
            {lockedZones.length > 0 && (
              <Key
                className="border border-stone-light"
                style={{
                  background:
                    "repeating-linear-gradient(135deg, var(--color-stone-light) 0 2px, transparent 2px 5px)",
                }}
                label={lockedZones[0].label}
              />
            )}
          </div>
        </div>

        <aside className="self-start rounded-[2px] border border-line bg-paper-raised p-5">
          {activeCell && activeZone ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                Spot
              </p>
              <p className="display mt-1 text-[30px] leading-none text-olive">
                {activeCell.id}
              </p>
              <dl className="mt-5 space-y-2.5 text-[13px]">
                <Row label="Parcel" value={activeZone.name} />
                <Row label="Size" value={`${spotMetres} × ${spotMetres} m`} />
                <Row label="Status" value={statusOf(activeCell)} />
              </dl>
              {onSelect && !taken.has(activeCell.id) && (
                <button
                  type="button"
                  onClick={() => choose(activeCell)}
                  className="mt-5 w-full rounded-[2px] border border-olive bg-olive px-4 py-2.5 text-[13px] text-paper transition-colors hover:bg-olive-mid"
                >
                  {selected.has(activeCell.id) ? "Remove this spot" : "Choose this spot"}
                </button>
              )}
            </>
          ) : activeZone ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                {activeZone.label}
              </p>
              <p className="display mt-1 text-[30px] leading-none text-olive">
                {activeZone.name}
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-stone">
                {activeZone.status === "active"
                  ? "No spot here. Spots are kept clear of the buildings and the parcel edge."
                  : "This part of the estate is not open for adoption yet."}
              </p>
            </>
          ) : (
            <p className="text-[14px] leading-relaxed text-stone">
              {onSelect
                ? `Pick ${limit} ${limit === 1 ? "spot" : "spots"} inside the outlined parcel. Each square is a ${spotMetres} by ${spotMetres} metre spot for one tree. On a keyboard, tab to the plan and use the arrow keys.`
                : "Hover or tap a square to see whether that spot is free."}
            </p>
          )}
        </aside>
      </div>

      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function Key({
  className,
  style,
  label,
}: {
  className: string;
  style?: React.CSSProperties;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 ${className}`} style={style} />
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

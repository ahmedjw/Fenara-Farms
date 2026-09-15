#!/usr/bin/env python3
"""
Build the land map assets for the tree picker.

Inputs
  --plan     The surveyor's plan of the whole property, with the boundary drawn
             on it as a green line. This is the image the site shows.
  --parcel   The annotated satellite image of the small parcel only: yellow
             outline along the road, and the NAVE block.

Outputs, written to --out-dir
  land-clean.png          plan with the green line inpainted, transparent outside the boundary
  land-clean-cropped.png  the same, cropped to the boundary
  land-boundary.json      boundary polygon, normalised to the cropped image
  land-zones.json         boundary, zones and building exclusions, normalised
  land-preview.png        everything drawn with numbered vertices, for checking

How it works
  1. Boundary. Green pixels in the plan, morphological close, largest outer
     contour, filled and shrunk by half the line width so the polygon follows
     the centre of the drawn line.
  2. Alignment. The two images come from different sources at different
     scales, so the satellite image is placed on the plan with a similarity
     transform, seeded from --control-points and refined by fitting the yellow
     outline onto the green boundary. The sources disagree slightly in
     proportion, so this only steers the road search; the zone edges
     themselves come from the plan.
  3. Road. The road is the largest bright band in the plan near the aligned
     outline's road-side stretch. Detection stays inside that corridor because
     bare soil elsewhere is nearly as bright. The parcel-side edge of the band
     is measured at stations along the outline and smoothed with a rolling
     median, so the line follows the verge rather than every overhanging tree.
  4. Zones. The boundary is cut along that edge. small-parcel is the side that
     holds the aligned outline; the road stays outside it. large-parcel is
     everything else inside the boundary. The outline is then fitted to the
     finished small parcel to place the NAVE.
  5. Exclusions. Black blocks drawn on the plan, and the NAVE block from the
     satellite image, are recorded against the zone they sit in so the map
     never offers a tree spot under a building.

If any check fails, the preview is still written but land-zones.json is not,
and the script exits with status 2.

Requires: pip install opencv-python numpy
Run:      python scripts/process-land-image.py [--preview-only]
"""

import argparse
import json
import math
import os
import re
import sys

import cv2
import numpy as np

DEFAULT_CONTROL_POINTS = (
    # satellite x,y : plan x,y. Rough, picked by eye; the fit refines them.
    "317,307:1492,989;2274,661:1867,1069;1745,529:1765,1033;1256,2115:1672,1348"
)


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--plan", default="plano_clean2.png")
    p.add_argument("--parcel", default="finca_plot_tree_selection (1).png")
    p.add_argument("--out-dir", default="assets")
    p.add_argument("--green-lower", default="35,120,120", help="HSV lower bound of the boundary line (OpenCV ranges)")
    p.add_argument("--green-upper", default="85,255,255")
    p.add_argument("--yellow-lower", default="15,120,150", help="HSV lower bound of the parcel outline")
    p.add_argument("--yellow-upper", default="40,255,255")
    p.add_argument("--close-kernel", type=int, default=5, help="closing kernel for the boundary line, px")
    p.add_argument("--epsilon", type=float, default=1.5, help="polygon simplification tolerance, plan px")
    p.add_argument("--inpaint-dilate", type=int, default=2, help="grow the line mask by this many px before inpainting")
    p.add_argument("--inpaint-radius", type=int, default=4)
    p.add_argument("--pad", type=int, default=8, help="padding around the boundary when cropping, px")
    p.add_argument("--area-m2", type=float, default=70600, help="surveyed area, used to derive metres per pixel")
    p.add_argument("--control-points", default=DEFAULT_CONTROL_POINTS,
                   help="seed alignment as 'sx,sy:px,py;...' (satellite px : plan px), at least 2 pairs")
    p.add_argument("--road-corridor", type=int, default=35,
                   help="how far either side of the aligned outline to look for the road edge, px")
    p.add_argument("--road-min-run", type=int, default=3, help="road pixels in a row that mark the edge, px")
    p.add_argument("--edge-window", type=int, default=15, help="stations (3px apart) in the road edge median")
    p.add_argument("--road-min-dist", type=float, default=8,
                   help="yellow outline points further than this from the green line count as road side, px")
    p.add_argument("--block-max-value", type=int, default=40, help="max channel value for drawn black blocks")
    p.add_argument("--min-block-area", type=int, default=400, help="ignore black blobs smaller than this, px")
    p.add_argument("--cell-size-m", type=float, default=7, help="tree spot grid size, metres")
    p.add_argument("--small-parcel", help="JSON with a hand-adjusted small-parcel polygon, normalised like "
                                          "land-zones.json (or a copy of land-zones.json itself). Skips road detection.")
    p.add_argument("--preview-only", action="store_true", help="write everything except land-zones.json")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Geometry helpers


def hsv(s):
    return tuple(int(v) for v in s.split(","))


def largest_contour(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        raise SystemExit("No contour found. Check the colour thresholds.")
    return max(contours, key=cv2.contourArea)


def fill(contour, shape):
    out = np.zeros(shape, np.uint8)
    cv2.drawContours(out, [contour], -1, 255, -1)
    return out


def half_width(line_mask):
    dist = cv2.distanceTransform(line_mask, cv2.DIST_L2, 3)
    return float(np.percentile(dist[line_mask > 0], 95))


def shrink(region, by):
    """Pixels of a filled region further than `by` from its edge."""
    return (cv2.distanceTransform(region, cv2.DIST_L2, 5) > by).astype(np.uint8) * 255


def simplify(mask, eps):
    c = largest_contour(mask)
    return cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(np.float64)


def polygon_mask(poly, shape):
    out = np.zeros(shape, np.uint8)
    cv2.fillPoly(out, [np.round(poly).astype(np.int32)], 255)
    return out


def components(mask):
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=4)
    return n, labels, stats, centroids


def similarity(s, th, tx, ty):
    return np.array([[s * math.cos(th), -s * math.sin(th), tx], [s * math.sin(th), s * math.cos(th), ty]])


def params(M):
    return np.array([math.hypot(M[0, 0], M[1, 0]), math.atan2(M[1, 0], M[0, 0]), M[0, 2], M[1, 2]])


def transform(M, pts):
    return pts @ M[:, :2].T + M[:, 2]


def sample(img, pts, border=1e3):
    return cv2.remap(img, pts[:, 0].astype(np.float32).reshape(-1, 1), pts[:, 1].astype(np.float32).reshape(-1, 1),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=border).ravel()


def chamfer_fit(pts, dist_map, M):
    """Pattern search over scale, rotation and offset, minimising the truncated distance from the
    transformed points to a line map. Truncation lets stretches that genuinely differ be ignored."""
    p = params(M)
    base_steps = np.array([p[0] * 0.02, math.radians(0.5), 6.0, 6.0])

    def cost(q, trunc):
        return np.minimum(sample(dist_map, transform(similarity(*q), pts)), trunc).mean()

    for trunc in (14.0, 8.0, 5.0):
        steps = base_steps.copy()
        best = cost(p, trunc)
        while steps[2] > 0.05:
            improved = False
            for i in range(len(p)):
                for sign in (1, -1):
                    q = p.copy()
                    q[i] += sign * steps[i]
                    c = cost(q, trunc)
                    if c < best:
                        best, p, improved = c, q, True
            if not improved:
                steps /= 2
    return similarity(*p)


def line_distance_map(region):
    edge = np.full(region.shape, 255, np.uint8)
    cv2.drawContours(edge, [largest_contour(region)], -1, 0, 1)
    return cv2.distanceTransform(edge, cv2.DIST_L2, 5)


# ---------------------------------------------------------------------------
# Detection steps


def detect_boundary(plan_hsv, args):
    line = cv2.inRange(plan_hsv, hsv(args.green_lower), hsv(args.green_upper))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (args.close_kernel, args.close_kernel))
    line = cv2.morphologyEx(line, cv2.MORPH_CLOSE, k)
    outer = fill(largest_contour(line), line.shape)
    hw = half_width(line)
    region = shrink(outer, hw)
    return line, region, hw


def detect_parcel_outline(parcel_bgr, args):
    """Centre line of the yellow outline around the NAVE, in satellite pixels."""
    parcel_hsv = cv2.cvtColor(parcel_bgr, cv2.COLOR_BGR2HSV)
    line = cv2.inRange(parcel_hsv, hsv(args.yellow_lower), hsv(args.yellow_upper))
    line = cv2.morphologyEx(line, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    hw = half_width(line)

    nave = detect_nave(parcel_bgr, args)
    seed = nave.mean(0).astype(int)

    _, labels = cv2.connectedComponents(255 - line, connectivity=4)
    interior = (labels == labels[seed[1], seed[0]]).astype(np.uint8) * 255
    if interior[0].any() or interior[-1].any() or interior[:, 0].any() or interior[:, -1].any():
        raise SystemExit("The yellow outline is not closed around the NAVE. Try a larger yellow range.")
    k = int(2 * hw) | 1
    centre = cv2.dilate(interior, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    outline = largest_contour(centre)[:, 0, :].astype(np.float64)
    return outline[::4], nave


def detect_nave(parcel_bgr, args):
    black = (parcel_bgr.max(2) < 30).astype(np.uint8) * 255
    black = cv2.morphologyEx(black, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    c = largest_contour(black)
    return cv2.approxPolyDP(c, 4, True)[:, 0, :].astype(np.float64)


def road_side_stations(outline_plan, near_green, in_region, spacing=3.0):
    """The stretch of the aligned outline that runs along the road, resampled evenly.

    The outline is a closed loop, so the road-side stretch can wrap past index 0.
    """
    flags = ~near_green & in_region
    if not flags.any() or flags.all():
        raise SystemExit("Could not tell the road side of the aligned outline apart. Adjust --control-points.")
    # Rotate so a point on the boundary comes first, then take the longest run.
    first_off = int(np.argmin(flags))
    rolled, pts = np.roll(flags, -first_off), np.roll(outline_plan, -first_off, axis=0)
    best, run_start = (0, 0), None
    for i, f in enumerate(np.append(rolled, False)):
        if f:
            run_start = i if run_start is None else run_start
        elif run_start is not None:
            if i - run_start > best[1] - best[0]:
                best = (run_start, i)
            run_start = None
    line = pts[best[0]:best[1]]

    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
    at = np.arange(0, arc[-1], spacing)
    return np.column_stack([np.interp(at, arc, line[:, 0]), np.interp(at, arc, line[:, 1])])


def rolling(values, window, fn):
    half = window // 2
    out = np.full(len(values), np.nan)
    for i in range(len(values)):
        chunk = values[max(0, i - half):i + half + 1]
        chunk = chunk[~np.isnan(chunk)]
        if chunk.size:
            out[i] = fn(chunk)
    return out


def detect_road_edge(plan_hsv, region, stations, interior, args):
    """Where the road's parcel-side edge really is in the plan, near the aligned outline.

    The road is the largest bright band in a corridor around the outline. Along the normal at each
    station, scan from the parcel side towards the road and take the first band pixel. A rolling
    median then discards the stations where a canopy overhangs the verge or a pale patch of soil
    sits next to it, so the line follows the verge rather than every tree.
    """
    smooth = np.column_stack([rolling(stations[:, k], 9, np.mean) for k in (0, 1)])
    tangent = np.gradient(smooth, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
    normal = np.column_stack([-tangent[:, 1], tangent[:, 0]])
    mid = len(stations) // 2
    probe = stations[mid] + 10 * normal[mid]
    if cv2.pointPolygonTest(interior.astype(np.float32).reshape(-1, 1, 2), tuple(map(float, probe)), False) < 0:
        normal = -normal  # point into the parcel

    reach = args.road_corridor
    value = plan_hsv[..., 2]
    corridor = np.zeros(region.shape, np.uint8)
    cv2.polylines(corridor, [np.round(stations).astype(np.int32)], False, 255, 2 * reach)
    candidates = value[(corridor > 0) & (region > 0) & (value > 120)]
    if candidates.size < 500:
        raise SystemExit("Road corridor is empty. The seed alignment is too far off; adjust --control-points.")
    threshold, _ = cv2.threshold(candidates.reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    road = ((value > threshold) & (corridor > 0)).astype(np.uint8) * 255
    road = cv2.morphologyEx(road, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    road = cv2.morphologyEx(road, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    n, labels, stats, _ = components(road)
    if n < 2:
        raise SystemExit("No road found near the outline.")
    road = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8) * 255

    t = np.arange(reach, -reach - 1, -1.0)  # parcel side first
    rays = stations[:, None, :] + t[None, :, None] * normal[:, None, :]
    hits = sample(road.astype(np.float32), rays.reshape(-1, 2), 0).reshape(len(stations), len(t)) > 127
    run = args.road_min_run
    sums = np.cumsum(np.pad(hits.astype(np.int32), ((0, 0), (1, 0))), axis=1)
    sustained = (sums[:, run:] - sums[:, :-run]) >= run
    offsets = np.where(sustained.any(1), t[np.argmax(sustained, axis=1)], np.nan)
    found = float(np.mean(~np.isnan(offsets)))

    offsets = rolling(offsets, args.edge_window, np.median)
    offsets = rolling(offsets, max(3, args.edge_window // 2), np.mean)
    idx = np.arange(len(offsets))
    ok = ~np.isnan(offsets)
    if ok.sum() < 2:
        raise SystemExit("The road edge was not found along the outline.")
    offsets = np.interp(idx, idx[ok], offsets[ok])

    edge = stations + offsets[:, None] * normal
    # Run the cut past the boundary at both ends so it always separates the parcels.
    edge = np.vstack([edge[0] - tangent[0] * 3 * reach, edge, edge[-1] + tangent[-1] * 3 * reach])
    return edge, road, float(threshold), found


def split_along(region, edge, seed):
    cut = region.copy()
    cv2.polylines(cut, [np.round(edge).astype(np.int32)], False, 0, 3)
    _, labels = cv2.connectedComponents(cut, connectivity=4)
    label = labels[int(seed[1]), int(seed[0])]
    if label == 0:
        raise SystemExit("The small parcel seed landed on the cut line. Adjust --control-points.")
    return (labels == label).astype(np.uint8) * 255


def settle_slivers(region, small):
    """Everything inside the boundary that is not the small parcel is the large parcel,
    except thin leftovers between the outline and the boundary, which join the small one."""
    large = cv2.subtract(region, small)
    n, labels, stats, _ = components(large)
    if n < 2:
        raise SystemExit("Nothing is left for the large parcel.")
    keep = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    slivers = ((labels > 0) & (labels != keep)).astype(np.uint8) * 255
    small = cv2.bitwise_or(small, slivers)
    large = (labels == keep).astype(np.uint8) * 255
    return small, large, int(slivers.sum() // 255)


def detect_blocks(plan_bgr, region, args):
    black = (plan_bgr.max(2) < args.block_max_value).astype(np.uint8) * 255
    # The blocks are drawn with a grey X through them, so bridge those lines first.
    black = cv2.morphologyEx(black, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    black &= cv2.dilate(region, np.ones((9, 9), np.uint8))
    contours, _ = cv2.findContours(black, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blocks = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < args.min_block_area:
            continue
        # Drawn blocks are solid rectangles. Dark woodland can pass the colour test but not this one.
        (_, _), (rw, rh), _ = cv2.minAreaRect(c)
        if area / max(rw * rh, 1) < 0.8:
            continue
        blocks.append(cv2.approxPolyDP(c, 2, True)[:, 0, :].astype(np.float64))
    return blocks


# ---------------------------------------------------------------------------
# Output


def normalise(poly, origin, size):
    return [[round((x + 0.5 - origin[0]) / size[0], 5), round((y + 0.5 - origin[1]) / size[1], 5)] for x, y in poly]


def denormalise(poly, origin, size):
    return np.array([[x * size[0] + origin[0] - 0.5, y * size[1] + origin[1] - 0.5] for x, y in poly])


def grid_cells(poly, exclusions, cell, origin):
    """Mirror of the rule the map component uses: a cell is offered when its centre is inside the
    zone, and blocked when a building overlaps the circle inscribed in the cell, i.e. the centre is
    inside the building or less than half a cell from its edge."""
    local = (poly - origin).astype(np.float32).reshape(-1, 1, 2)
    ex = [(e - origin).astype(np.float32).reshape(-1, 1, 2) for e in exclusions]
    x0, y0 = local.reshape(-1, 2).min(0)
    x1, y1 = local.reshape(-1, 2).max(0)
    free, blocked = [], []
    for row in range(int(y0 // cell), int(math.ceil(y1 / cell))):
        for col in range(int(x0 // cell), int(math.ceil(x1 / cell))):
            centre = (float((col + 0.5) * cell), float((row + 0.5) * cell))
            if cv2.pointPolygonTest(local, centre, False) < 0:
                continue
            hit = any(cv2.pointPolygonTest(e, centre, True) > -cell / 2 for e in ex)
            (blocked if hit else free).append((col, row))
    return free, blocked


def write_json(path, doc):
    """Indented JSON with each [x, y] pair on one line, so the file stays editable by hand."""
    text = json.dumps(doc, indent=2)
    text = re.sub(r"\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]", r"[\1, \2]", text)
    with open(path, "w") as f:
        f.write(text + "\n")


def put_label(img, text, org, color, scale=0.4):
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1, cv2.LINE_AA)


def draw_poly(img, poly, color, prefix, scale, offset, numbers=True, thickness=2, window=None):
    pts = np.round((poly - offset) * scale).astype(np.int32)
    cv2.polylines(img, [pts], True, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.polylines(img, [pts], True, color, thickness, cv2.LINE_AA)
    if not numbers:
        return
    h, w = img.shape[:2]
    for i, (x, y) in enumerate(pts):
        if window is not None and not (0 <= x < w and 0 <= y < h):
            continue
        cv2.circle(img, (int(x), int(y)), 3, color, -1, cv2.LINE_AA)
        put_label(img, f"{prefix}{i}", (int(x) + 4, int(y) - 4), color)


def render_preview(clean_rgba, origin, boundary, zones, road, yellow_plan, cells, cell_px, notes, path):
    boundary_c = (255, 255, 255)
    small_c = (255, 210, 0)      # cyan
    large_c = (0, 140, 255)      # orange
    exclusion_c = (255, 0, 255)  # magenta
    yellow_c = (0, 0, 255)       # red, the aligned satellite outline

    h, w = clean_rgba.shape[:2]
    alpha = clean_rgba[..., 3:4].astype(np.float32) / 255
    checker = np.indices((h, w)).sum(0) // 16 % 2
    ground = np.where(checker[..., None] == 0, 235, 210).astype(np.float32).repeat(3, 2)
    base = (clean_rgba[..., :3] * alpha + ground * (1 - alpha)).astype(np.uint8)

    small, large = zones["small-parcel"], zones["large-parcel"]

    # Panel A: whole property.
    a = base.copy()
    tint = a.copy()
    cv2.fillPoly(tint, [np.round(large["polygon"] - origin).astype(np.int32)], large_c)
    cv2.fillPoly(tint, [np.round(small["polygon"] - origin).astype(np.int32)], small_c)
    a = cv2.addWeighted(a, 0.72, tint, 0.28, 0)
    draw_poly(a, boundary, boundary_c, "B", 1, origin)
    draw_poly(a, large["polygon"], large_c, "L", 1, origin, numbers=False)
    draw_poly(a, small["polygon"], small_c, "S", 1, origin, numbers=False)

    # Panel B: zoom on the small parcel, with the road and the grid.
    zoom = 3
    x0, y0 = (small["polygon"].min(0) - 30).astype(int)
    x1, y1 = (small["polygon"].max(0) + 30).astype(int)
    x0, y0 = max(x0, origin[0]), max(y0, origin[1])
    x1, y1 = min(x1, origin[0] + w), min(y1, origin[1] + h)
    crop = base[y0 - origin[1]:y1 - origin[1], x0 - origin[0]:x1 - origin[0]]
    b = cv2.resize(crop, None, fx=zoom, fy=zoom, interpolation=cv2.INTER_CUBIC)
    if road is not None:
        r = cv2.resize(road[y0:y1, x0:x1], (b.shape[1], b.shape[0]), interpolation=cv2.INTER_NEAREST)
        tint = b.copy()
        tint[r > 0] = (0, 230, 255)
        b = cv2.addWeighted(b, 0.7, tint, 0.3, 0)
    off = np.array([x0, y0], np.float64)
    free, blocked = cells
    for col, row in free:
        tl = ((np.array([col, row]) * cell_px + origin - off) * zoom).astype(int)
        br = (((np.array([col, row]) + 1) * cell_px + origin - off) * zoom).astype(int)
        cv2.rectangle(b, tuple(tl), tuple(br), small_c, 1)
    for col, row in blocked:
        tl = ((np.array([col, row]) * cell_px + origin - off) * zoom).astype(int)
        br = (((np.array([col, row]) + 1) * cell_px + origin - off) * zoom).astype(int)
        cv2.line(b, tuple(tl), tuple(br), exclusion_c, 1)
        cv2.line(b, (tl[0], br[1]), (br[0], tl[1]), exclusion_c, 1)
    if yellow_plan is not None:
        draw_poly(b, yellow_plan, yellow_c, "", zoom, off, numbers=False, thickness=1)
    draw_poly(b, large["polygon"], large_c, "L", zoom, off, window=True)
    draw_poly(b, small["polygon"], small_c, "S", zoom, off, window=True)
    for zone in (small, large):
        for j, ex in enumerate(zone["exclusions"]):
            draw_poly(b, ex, exclusion_c, f"{zone['short']}X{j}.", zoom, off, window=True)

    # Legend and notes above the panels.
    width = a.shape[1] + b.shape[1] + 30
    lines = [
        ("white B#: boundary vertices    cyan S#: small-parcel    orange L#: large-parcel    "
         "magenta: building exclusions (SX0.3 = small parcel, exclusion 0, vertex 3)", (40, 40, 40)),
        ("zoom panel: yellow tint = bright road pixels near the outline, thin red = satellite outline as aligned, "
         "cyan squares = offered cells, magenta crosses = blocked cells", (40, 40, 40)),
    ] + [(n, (0, 0, 170) if n.startswith("WARNING") else (40, 40, 40)) for n in notes]
    header = np.full((28 * len(lines) + 20, width, 3), 250, np.uint8)
    for i, (text, color) in enumerate(lines):
        cv2.putText(header, text, (14, 30 + 28 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA)

    body_h = max(a.shape[0], b.shape[0])
    body = np.full((body_h, width, 3), 250, np.uint8)
    body[:a.shape[0], 10:10 + a.shape[1]] = a
    body[:b.shape[0], a.shape[1] + 20:a.shape[1] + 20 + b.shape[1]] = b
    cv2.imwrite(path, np.vstack([header, body]))


# ---------------------------------------------------------------------------


def main():
    args = parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    out = lambda name: os.path.join(args.out_dir, name)

    plan = cv2.imread(args.plan, cv2.IMREAD_COLOR)
    parcel = cv2.imread(args.parcel, cv2.IMREAD_COLOR)
    if plan is None or parcel is None:
        raise SystemExit(f"Could not read {args.plan if plan is None else args.parcel}")
    plan_hsv = cv2.cvtColor(plan, cv2.COLOR_BGR2HSV)
    notes, warnings = [], []

    # 1. Boundary, and the plan with the drawn line removed.
    line, region, hw = detect_boundary(plan_hsv, args)
    boundary = simplify(region, args.epsilon)
    region = polygon_mask(boundary, region.shape)
    area_px = cv2.contourArea(boundary.astype(np.float32))
    m_per_px = math.sqrt(args.area_m2 / area_px)
    notes.append(f"boundary: {len(boundary)} vertices, line half width {hw:.1f}px, "
                 f"{m_per_px:.4f} m/px from {args.area_m2:.0f} m2")

    grow = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * args.inpaint_dilate + 1,) * 2)
    clean = cv2.inpaint(plan, cv2.dilate(line, grow), args.inpaint_radius, cv2.INPAINT_TELEA)

    alpha = np.zeros(region.shape, np.uint8)
    cv2.fillPoly(alpha, [np.round(boundary * 16).astype(np.int32)], 255, cv2.LINE_AA, shift=4)
    clean_rgba = np.dstack([clean, alpha])

    bx0, by0 = np.floor(boundary.min(0)).astype(int) - args.pad
    bx1, by1 = np.ceil(boundary.max(0)).astype(int) + args.pad + 1
    bx0, by0 = max(bx0, 0), max(by0, 0)
    bx1, by1 = min(bx1, plan.shape[1]), min(by1, plan.shape[0])
    origin = np.array([bx0, by0])
    size = (int(bx1 - bx0), int(by1 - by0))
    cropped = clean_rgba[by0:by1, bx0:bx1]

    # 2-4. Alignment, road and zones.
    outline, nave = detect_parcel_outline(parcel, args)
    pairs = [pair.split(":") for pair in args.control_points.split(";")]
    src = np.array([[float(v) for v in s.split(",")] for s, _ in pairs], np.float32)
    dst = np.array([[float(v) for v in d.split(",")] for _, d in pairs], np.float32)
    M, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)
    green_dist = line_distance_map(region)

    road = None
    if args.small_parcel:
        with open(args.small_parcel) as f:
            override = json.load(f)
        # A bare list of points, {"polygon": [...]}, or a whole land-zones.json with hand-edited vertices.
        if isinstance(override, dict) and "zones" in override:
            override = next(z for z in override["zones"] if z["id"] == "small-parcel")
        small_poly = denormalise(override["polygon"] if isinstance(override, dict) else override, origin, size)
        small = polygon_mask(small_poly, region.shape) & region
        M = chamfer_fit(outline, line_distance_map(small), M)
        notes.append(f"small-parcel taken from {args.small_parcel}; road detection skipped")
    else:
        def zone_from(M):
            yellow = transform(M, outline)
            near_green = sample(green_dist, yellow) <= args.road_min_dist
            in_region = sample(region.astype(np.float32), yellow, 0) > 127
            stations = road_side_stations(yellow, near_green, in_region)
            edge, road, threshold, found = detect_road_edge(plan_hsv, region, stations, yellow, args)
            small = split_along(region, edge, np.round(yellow.mean(0)).astype(int))
            return small, road, threshold, found

        # Place the outline against the boundary only, find the road near it, then place it again
        # against the finished parcel so the NAVE lands where it belongs relative to its edges.
        M = chamfer_fit(outline, green_dist, M)
        small, road, threshold, found = zone_from(M)
        notes.append(f"road: brightness threshold {threshold:.0f}; edge found at {found:.0%} of stations along the outline")
        if found < 0.7:
            warnings.append("WARNING the road edge was missing at more than 30% of stations; check the road-side line")

    small, large, sliver_px = settle_slivers(region, small)
    if sliver_px:
        notes.append(f"{sliver_px}px of leftover boundary area between the outline and the boundary joined small-parcel")
    if not args.small_parcel:
        M = chamfer_fit(outline, line_distance_map(small), M)

    yellow = transform(M, outline)
    residual = sample(line_distance_map(small), yellow)
    fit = (residual < 4).mean()
    s, th = params(M)[:2]
    notes.append(f"alignment: satellite -> plan scale {s:.4f} (x{1 / s:.2f}), rotation {math.degrees(th):.2f} deg, "
                 f"offset ({M[0, 2]:.1f}, {M[1, 2]:.1f}); {fit:.0%} of the outline within 4px of the parcel edge")

    yellow_area = cv2.contourArea(yellow.astype(np.float32))
    small_area = float((small > 0).sum())
    ratio = small_area / yellow_area
    notes.append(f"small-parcel {small_area * m_per_px ** 2:,.0f} m2 vs satellite outline "
                 f"{yellow_area * m_per_px ** 2:,.0f} m2 (ratio {ratio:.2f}); "
                 f"large-parcel {(large > 0).sum() * m_per_px ** 2:,.0f} m2")
    if not 0.8 <= ratio <= 1.2:
        warnings.append("WARNING small-parcel area differs from the satellite outline by more than 20%; "
                        "the road may not separate the parcels cleanly")
    if fit < 0.5:
        warnings.append("WARNING under half of the satellite outline fits the detected parcel edge")

    # Hand-adjusted vertices are kept exactly as given; only detected shapes are simplified.
    small_poly = small_poly if args.small_parcel else simplify(small, args.epsilon)
    large_poly = simplify(large, args.epsilon)

    # 5. Exclusions.
    exclusions = {"small-parcel": [], "large-parcel": []}
    blocks = detect_blocks(plan, region, args)
    nave_plan = transform(M, nave)
    for poly, source in [(b, "plan block") for b in blocks] + [(nave_plan, "NAVE")]:
        cx, cy = poly.mean(0)
        zone = "small-parcel" if small[int(cy), int(cx)] else "large-parcel"
        exclusions[zone].append(poly)
        notes.append(f"exclusion: {source} at ({cx:.0f}, {cy:.0f}) -> {zone}")

    cell_px = args.cell_size_m / m_per_px
    cells = grid_cells(small_poly, exclusions["small-parcel"], cell_px, origin)
    notes.append(f"grid: {args.cell_size_m:g} m = {cell_px:.2f}px; small-parcel offers {len(cells[0])} cells, "
                 f"{len(cells[1])} blocked by buildings")

    zones = {
        "small-parcel": {"short": "S", "polygon": small_poly, "exclusions": exclusions["small-parcel"]},
        "large-parcel": {"short": "L", "polygon": large_poly, "exclusions": exclusions["large-parcel"]},
    }

    # Write.
    cv2.imwrite(out("land-clean.png"), clean_rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    cv2.imwrite(out("land-clean-cropped.png"), cropped, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    image = {"src": "land-clean-cropped.png", "width": size[0], "height": size[1]}
    write_json(out("land-boundary.json"), {"image": image, "boundary": normalise(boundary, origin, size)})
    render_preview(clean_rgba[by0:by1, bx0:bx1], origin, boundary, zones, road, yellow, cells, cell_px,
                   notes + warnings, out("land-preview.png"))

    if warnings or args.preview_only:
        for n in notes + warnings:
            print(n)
        print(f"\nPreview written to {out('land-preview.png')}. land-zones.json was not written"
              + (" because detection is uncertain." if warnings else " (--preview-only)."))
        sys.exit(2 if warnings else 0)

    doc = {
        "image": image,
        "metersPerPixel": round(m_per_px, 5),
        "cellSizeMeters": args.cell_size_m,
        "boundary": normalise(boundary, origin, size),
        # code prefixes the spot ids ("A-R41-C55") and name is what certificates show.
        # Neither may change once spots in the zone have been adopted.
        "zones": [
            {"id": "small-parcel", "code": "A", "name": "La Nave", "label": "Available", "status": "active",
             "polygon": normalise(small_poly, origin, size),
             "exclusions": [normalise(e, origin, size) for e in exclusions["small-parcel"]]},
            {"id": "large-parcel", "code": "B", "name": "The rest of La Finca", "label": "Coming soon", "status": "locked",
             "polygon": normalise(large_poly, origin, size),
             "exclusions": [normalise(e, origin, size) for e in exclusions["large-parcel"]]},
        ],
    }
    write_json(out("land-zones.json"), doc)
    for n in notes:
        print(n)
    print(f"\nWrote land-clean.png, land-clean-cropped.png, land-boundary.json, land-zones.json and "
          f"land-preview.png to {args.out_dir}")


if __name__ == "__main__":
    main()

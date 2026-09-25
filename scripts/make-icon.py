#!/usr/bin/env python3
"""
Renders the site icon into the formats browsers ask for.

src/app/icon.svg is the artwork and the source of truth. Browsers that take an
SVG icon use it directly; the two rasters here exist for the ones that do not:

    src/app/favicon.ico     16, 32 and 48px, for tab bars and Windows
    src/app/apple-icon.png  180px, for an iOS home screen

Next.js picks all three up from the app directory on its own. No <link> tags.

    python scripts/make-icon.py

The shapes below mirror icon.svg by hand, because rasterising arbitrary SVG
would mean a dependency on a renderer this project does not otherwise need.
That means they can drift: change the artwork and you must change this too.
The doctest at the bottom checks the coordinates still match the file, so a
drift is caught here rather than in a browser tab.
"""

import re
from pathlib import Path

from PIL import Image, ImageDraw

SVG = Path("src/app/icon.svg")

BG = (48, 58, 43)  # #303A2B, the tile
GOLD = (216, 183, 106)  # #D8B76A, the branch and the bottle
CREAM = (243, 240, 231)  # #F3F0E7, the pour

SIZE = 64  # the coordinate space the shapes are written in
CORNER = 14
BOTTLE = (16, 5, 48, 59, 16, 3)  # x0, y0, x1, y1, radius, stroke width

# Stems: (cubic control points, stroke width).
STEMS = [
    (((29, 52), (28, 42), (29, 32), (30, 20)), 2.8),
    (((30, 27), (33, 26), (36, 24), (38, 21)), 2.4),
    (((29, 36), (26, 35), (24, 33), (22, 30)), 2.4),
]

# Leaves: closed shapes, each two cubics.
LEAVES = [
    [((38, 21), (43, 18), (44, 12), (41, 8)), ((41, 8), (36, 11), (35, 17), (38, 21))],
    [((22, 30), (17, 27), (16, 21), (19, 17)), ((19, 17), (24, 20), (25, 26), (22, 30))],
]

OLIVE_FRUIT = (25, 45, 4.6, 5.4)  # cx, cy, rx, ry

# The pour, cream over the branch.
POUR = [
    ((33.4, 14), (33.4, 10), (35.6, 7.6), (38.6, 8)),
    ((38.6, 8), (41, 8.4), (41.6, 10.8), (40, 12)),
    ((40, 12), (38.6, 13), (37, 12.2), (37.2, 10.8)),
    ((37.2, 10.8), (37.2, 10), (36, 10.3), (35.6, 12)),
    "L35.6,50",
    ((35.6, 50), (35.6, 53), (34.8, 54.8), (33.4, 56)),
]


def cubic(p0, p1, p2, p3, steps=48):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append(
            (
                u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
            )
        )
    return out


def flatten(segments):
    points = []
    for seg in segments:
        if isinstance(seg, str):  # a straight line, written as the SVG writes it
            x, y = seg[1:].split(",")
            points.append((float(x), float(y)))
        else:
            points += cubic(*seg)
    return points


def render(px):
    """The icon at px across, drawn 10x and brought down for clean edges."""
    scale = 10
    n = px * scale
    k = n / SIZE
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)

    dr.rounded_rectangle([0, 0, n - 1, n - 1], radius=CORNER * k, fill=BG + (255,))

    x0, y0, x1, y1, r, w = BOTTLE
    dr.rounded_rectangle(
        [x0 * k, y0 * k, x1 * k, y1 * k],
        radius=r * k,
        outline=GOLD + (255,),
        width=max(1, round(w * k)),
    )

    for segment, width in STEMS:
        pts = [(x * k, y * k) for x, y in cubic(*segment)]
        dr.line(pts, fill=GOLD + (255,), width=max(1, round(width * k)), joint="curve")
        # Round caps, which PIL's line does not draw on its own.
        cap = width * k / 2
        for end in (pts[0], pts[-1]):
            dr.ellipse(
                [end[0] - cap, end[1] - cap, end[0] + cap, end[1] + cap],
                fill=GOLD + (255,),
            )

    for leaf in LEAVES:
        dr.polygon([(x * k, y * k) for x, y in flatten(leaf)], fill=GOLD + (255,))

    cx, cy, rx, ry = OLIVE_FRUIT
    dr.ellipse(
        [(cx - rx) * k, (cy - ry) * k, (cx + rx) * k, (cy + ry) * k],
        fill=GOLD + (255,),
    )

    dr.polygon([(x * k, y * k) for x, y in flatten(POUR)], fill=CREAM + (255,))

    return img.resize((px, px), Image.LANCZOS)


def check_against_svg():
    """Shouts if icon.svg no longer matches the shapes above."""
    svg = SVG.read_text(encoding="utf-8", errors="replace")
    svg = re.sub(r"<metadata>.*?</metadata>", "", svg, flags=re.S)
    wanted = [
        f"{GOLD[0]:02x}{GOLD[1]:02x}{GOLD[2]:02x}",
        f"{BG[0]:02x}{BG[1]:02x}{BG[2]:02x}",
        "M29,52", "M30,27", "M29,36", "M38,21", "M22,30", "M33.4,14",
        'cx="25"', 'rx="14"',
    ]
    missing = [w for w in wanted if w.lower() not in svg.lower()]
    if missing:
        raise SystemExit(
            "scripts/make-icon.py no longer matches src/app/icon.svg.\n"
            f"Not found in the SVG: {', '.join(missing)}\n"
            "Update the shapes in this script to match the artwork."
        )


def main():
    check_against_svg()

    # Each ICO size is rendered at its own scale rather than downsampled from
    # one big image: at 16px that keeps thin strokes solid instead of grey.
    render(256).save(
        "src/app/favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[render(16), render(32), render(48)],
    )

    # iOS puts nothing behind the icon, so it needs its own opaque square.
    apple = render(180)
    square = Image.new("RGB", (180, 180), BG)
    square.paste(apple, (0, 0), apple)
    square.save("src/app/apple-icon.png")

    print("wrote src/app/favicon.ico and src/app/apple-icon.png from", SVG)


if __name__ == "__main__":
    main()

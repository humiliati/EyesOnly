#!/usr/bin/env python3
"""
EYES ONLY — Map Tile Stitcher
Fetches dark-themed map tiles and stitches them into a single image
suitable for UGRS grid overlay in the M console.

Usage:
  python stitch-map.py --lat 48.1765 --lng -116.7834 --zoom 17 --cols 6 --rows 4
  python stitch-map.py --lat 48.1765 --lng -116.7834 --zoom 16 --cols 8 --rows 8 --style toner --api-key YOUR_KEY
  python stitch-map.py --lat 47.6062 --lng -122.3321 --zoom 17 --style dark --out seattle.png

Tile providers:
  dark     — CartoDB Dark Matter (dark bg, white roads, no labels)
  darklbl  — CartoDB Dark Matter + labels
  toner    — Stamen Toner (high contrast B&W) [requires Stadia API key]
  tonerlite— Stamen Toner Lite (lighter B&W)  [requires Stadia API key]
  voyager  — CartoDB Voyager (light, colorful)
  osm      — Standard OpenStreetMap

Authentication:
  Stadia-hosted tiles (toner, tonerlite) require a free API key.
  Get one at: https://client.stadiamaps.com/
  Pass via --api-key or set STADIA_API_KEY environment variable.

Output is always PNG, typically 200KB–3MB depending on grid size.
"""

import argparse
import math
import os
import sys
import time
from io import BytesIO
from urllib.request import urlopen, Request

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Pillow required. Install with: pip install Pillow")
    sys.exit(1)


# --- Tile URL templates ---
TILE_PROVIDERS = {
    "dark":      "https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
    "darklbl":   "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
    "toner":     "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}@2x.png",
    "tonerlite": "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}@2x.png",
    "voyager":   "https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
    "osm":       "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
}

TILE_SIZE = 512  # @2x tiles are 512px
OSM_TILE_SIZE = 256  # OSM doesn't have @2x


def lat_lng_to_tile(lat, lng, zoom):
    """Convert lat/lng to tile x,y at given zoom level."""
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def tile_to_lat_lng(x, y, zoom):
    """Convert tile x,y back to lat/lng (NW corner of tile)."""
    n = 2 ** zoom
    lng = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat = math.degrees(lat_rad)
    return lat, lng


def fetch_tile(url, retries=3):
    """Fetch a single tile image with retries."""
    headers = {
        "User-Agent": "EyesOnly-MapStitcher/1.0 (ops@flapsandseals.com)",
    }
    for attempt in range(retries):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=15) as resp:
                return Image.open(BytesIO(resp.read()))
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1 * (attempt + 1))
            else:
                print(f"  WARN: Failed to fetch {url}: {e}")
                return None
    return None


def stitch_map(lat, lng, zoom, cols, rows, style="dark", margin=0, api_key=None):
    """
    Stitch a grid of map tiles centered on lat/lng.

    Args:
        lat, lng: Center coordinates
        zoom: Tile zoom level (16-18 recommended)
        cols, rows: Number of tiles wide/tall
        style: Tile provider key
        margin: Pixel margin to crop from edges (removes partial blocks at boundary)
        api_key: Stadia Maps API key (required for toner/tonerlite styles)

    Returns:
        PIL.Image of the stitched map
    """
    provider = TILE_PROVIDERS.get(style, TILE_PROVIDERS["dark"])

    # Append Stadia API key for providers that need it
    if api_key and "stadiamaps.com" in provider:
        provider += f"?api_key={api_key}"
    elif not api_key and "stadiamaps.com" in provider:
        print(f"  WARNING: {style} tiles require a Stadia API key.")
        print(f"  Get one at https://client.stadiamaps.com/")
        print(f"  Pass via --api-key or set STADIA_API_KEY env var.")
    tile_sz = OSM_TILE_SIZE if style == "osm" else TILE_SIZE

    # Find center tile
    cx, cy = lat_lng_to_tile(lat, lng, zoom)

    # Calculate tile range (centered)
    x_start = cx - cols // 2
    y_start = cy - rows // 2

    total = cols * rows
    print(f"Stitching {cols}x{rows} = {total} tiles at zoom {zoom} ({style})")
    print(f"Center: {lat:.6f}, {lng:.6f} → tile ({cx}, {cy})")
    print(f"Tile range: x=[{x_start}..{x_start + cols - 1}], y=[{y_start}..{y_start + rows - 1}]")

    # Fetch and stitch
    canvas = Image.new("RGB", (cols * tile_sz, rows * tile_sz), (10, 10, 10))
    fetched = 0

    for ty in range(rows):
        for tx in range(cols):
            tile_x = x_start + tx
            tile_y = y_start + ty
            url = provider.format(z=zoom, x=tile_x, y=tile_y)

            tile_img = fetch_tile(url)
            if tile_img:
                # Resize if needed (OSM tiles are 256, others 512)
                if tile_img.size != (tile_sz, tile_sz):
                    tile_img = tile_img.resize((tile_sz, tile_sz), Image.LANCZOS)
                canvas.paste(tile_img, (tx * tile_sz, ty * tile_sz))
                fetched += 1

            progress = (ty * cols + tx + 1) / total * 100
            print(f"\r  [{progress:5.1f}%] Fetched {fetched}/{total} tiles", end="", flush=True)

            # Be polite to tile servers
            time.sleep(0.1)

    print(f"\n  Done: {fetched}/{total} tiles fetched")

    # Crop margin if specified
    if margin > 0:
        w, h = canvas.size
        canvas = canvas.crop((margin, margin, w - margin, h - margin))
        print(f"  Cropped {margin}px margin → {canvas.size[0]}x{canvas.size[1]}")

    # Report coverage
    nw_lat, nw_lng = tile_to_lat_lng(x_start, y_start, zoom)
    se_lat, se_lng = tile_to_lat_lng(x_start + cols, y_start + rows, zoom)
    print(f"  Coverage: NW({nw_lat:.5f}, {nw_lng:.5f}) → SE({se_lat:.5f}, {se_lng:.5f})")

    return canvas


def add_grid_overlay(img, cols, rows, color=(51, 255, 51, 40)):
    """Add a faint UGRS grid overlay to the map image."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    cell_w = w / cols
    cell_h = h / rows

    # Vertical lines
    for c in range(1, cols):
        x = int(c * cell_w)
        draw.line([(x, 0), (x, h)], fill=color, width=1)

    # Horizontal lines
    for r in range(1, rows):
        y = int(r * cell_h)
        draw.line([(0, y), (w, y)], fill=color, width=1)

    # Composite
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return Image.alpha_composite(img, overlay)


def add_cell_labels(img, grid_cols, grid_rows, color=(51, 255, 51, 80)):
    """Add UGRS cell labels (A1, B2, etc.) to each cell."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    cell_w = w / grid_cols
    cell_h = h / grid_rows

    for r in range(grid_rows):
        for c in range(grid_cols):
            label = f"{chr(65 + c)}{r + 1}"
            x = int(c * cell_w + 4)
            y = int(r * cell_h + 2)
            # Draw with basic font
            draw.text((x, y), label, fill=color)

    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return Image.alpha_composite(img, overlay)


def main():
    parser = argparse.ArgumentParser(
        description="EYES ONLY — Stitch map tiles into a UGRS-ready image"
    )
    parser.add_argument("--lat", type=float, required=True, help="Center latitude")
    parser.add_argument("--lng", type=float, required=True, help="Center longitude")
    parser.add_argument("--zoom", type=int, default=17, help="Zoom level (16-18, default: 17)")
    parser.add_argument("--cols", type=int, default=4, help="Tiles wide (default: 4)")
    parser.add_argument("--rows", type=int, default=4, help="Tiles tall (default: 4)")
    parser.add_argument("--style", default="dark", choices=TILE_PROVIDERS.keys(),
                        help="Tile style (default: dark)")
    parser.add_argument("--grid", action="store_true", help="Add UGRS grid overlay")
    parser.add_argument("--grid-cols", type=int, default=None, help="UGRS grid columns (default: same as tile cols)")
    parser.add_argument("--grid-rows", type=int, default=None, help="UGRS grid rows (default: same as tile rows)")
    parser.add_argument("--labels", action="store_true", help="Add UGRS cell labels (A1, B2, ...)")
    parser.add_argument("--margin", type=int, default=0, help="Pixels to crop from edges")
    parser.add_argument("--out", default=None, help="Output filename (default: map-{style}-z{zoom}.png)")
    parser.add_argument("--webp", action="store_true", help="Save as WebP instead of PNG (smaller)")
    parser.add_argument("--quality", type=int, default=90, help="WebP quality (default: 90)")
    parser.add_argument("--api-key", default=None,
                        help="Stadia Maps API key (or set STADIA_API_KEY env var)")

    args = parser.parse_args()

    # Resolve API key: CLI flag > environment variable
    api_key = args.api_key or os.environ.get("STADIA_API_KEY")

    # Stitch
    img = stitch_map(
        lat=args.lat, lng=args.lng,
        zoom=args.zoom, cols=args.cols, rows=args.rows,
        style=args.style, margin=args.margin,
        api_key=api_key,
    )

    # Grid overlay
    gcols = args.grid_cols or args.cols
    grows = args.grid_rows or args.rows

    if args.grid:
        img = add_grid_overlay(img, gcols, grows)
        print(f"  Added {gcols}x{grows} grid overlay")

    if args.labels:
        img = add_cell_labels(img, gcols, grows)
        print(f"  Added cell labels")

    # Determine output path
    ext = "webp" if args.webp else "png"
    if args.out:
        out_path = args.out
    else:
        out_path = f"map-{args.style}-z{args.zoom}.{ext}"

    # Save
    if args.webp:
        if img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(out_path, "WEBP", quality=args.quality)
    else:
        img.save(out_path, "PNG", optimize=True)

    size_kb = os.path.getsize(out_path) / 1024
    size_mb = size_kb / 1024
    print(f"\n  Saved: {out_path}")
    print(f"  Size:  {size_kb:.0f} KB ({size_mb:.2f} MB)")
    print(f"  Dims:  {img.size[0]}x{img.size[1]} px")

    if size_mb > 10:
        print(f"  ⚠ WARNING: File exceeds 10MB R2 upload limit!")
        print(f"  Try: --webp, fewer tiles, or lower zoom")
    elif size_mb > 5:
        print(f"  ⚠ Large file — consider --webp for smaller output")

    print(f"\n  Upload to M console: drag-drop onto command map, or use UPLOAD MAP IMAGE button")


if __name__ == "__main__":
    main()

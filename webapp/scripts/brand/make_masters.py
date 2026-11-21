#!/usr/bin/env python3
# Generates the Brisk logo master SVGs (filled outlines, no strokes or live text).
# Requires: pip install shapely fonttools. Font: Inter Display Bold (SIL OFL 1.1).
# Usage: python3 make_masters.py <path to InterDisplay-Bold.otf> <output dir>
import math
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from shapely.geometry import LineString
from shapely.ops import unary_union

GREEN_LIGHT = '#4ade80'
GREEN = '#16a34a'
GREEN_DARK = '#15803d'
FOREST = '#14532d'
INK = '#0b2e1d'


def arc(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def breeze_lines(w):
    """The three wind strokes on a 64 grid. Angles are in SVG space (y down)."""
    r = 7.5
    top = [(8, 20), (38, 20)] + arc(38, 20 - r, r, 90, -180)[1:]
    mid = [(4, 32), (52, 32)]
    bottom = [(12, 44), (34, 44)] + arc(34, 44 + r, r, -90, 180)[1:]
    return [LineString(p).buffer(w / 2, cap_style='round', join_style='round', quad_segs=16) for p in (top, mid, bottom)]


def to_path(geom, dx=0.0, dy=0.0, s=1.0):
    polys = getattr(geom, 'geoms', [geom])
    out = []
    for poly in polys:
        for ring in [poly.exterior, *poly.interiors]:
            pts = list(ring.coords)
            out.append('M' + ' L'.join(f'{dx + x * s:.2f} {dy + y * s:.2f}' for x, y in pts[:-1]) + ' Z')
    return ' '.join(out)


def mark_geom(w=6.5):
    return unary_union(breeze_lines(w))


def wordmark(font_path, text='Brisk', cap_height_px=40.0):
    font = TTFont(font_path)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    cap = font['OS/2'].sCapHeight
    scale = cap_height_px / cap
    pen = SVGPathPen(gs)
    x = 0
    hmtx = font['hmtx']
    for ch in text:
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (scale, 0, 0, -scale, x * scale, cap_height_px))
        gs[g].draw(tp)
        x += hmtx[g][0]
    return pen.getCommands(), x * scale


def svg(view_w, view_h, body, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w:g} {view_h:g}" '
            f'width="{view_w:g}" height="{view_h:g}">{defs}{body}</svg>\n')


def gradient(gid, x1, x2):
    return (f'<defs><linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x1:g}" y1="0" x2="{x2:g}" y2="0">'
            f'<stop offset="0" stop-color="{GREEN_LIGHT}"/><stop offset="1" stop-color="{GREEN_DARK}"/></linearGradient></defs>')


def main(font_path, out):
    m = mark_geom()
    minx, miny, maxx, maxy = m.bounds
    # Mark on its own, centered in a 64 box.
    dx, dy = (64 - (maxx - minx)) / 2 - minx, (64 - (maxy - miny)) / 2 - miny
    mark_d = to_path(m, dx, dy)
    files = {}
    files['brisk-mark.svg'] = svg(64, 64, f'<path fill="url(#g)" d="{mark_d}"/>', gradient('g', 2, 58))
    files['brisk-mark-mono.svg'] = svg(64, 64, f'<path fill="currentColor" d="{mark_d}"/>')

    # App tile: white mark on a green tile. Small tile uses heavier strokes for 16-32 px.
    tile_bg = (f'<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22c55e"/>'
               f'<stop offset="1" stop-color="{FOREST}"/></linearGradient></defs>')

    def tile(geom, s, radius, badge=''):
        bx0, by0, bx1, by1 = geom.bounds
        tdx = (64 - (bx1 - bx0) * s) / 2 - bx0 * s
        tdy = (64 - (by1 - by0) * s) / 2 - by0 * s
        return svg(64, 64, f'<rect width="64" height="64" rx="{radius}" fill="url(#t)"/>'
                           f'<path fill="#fff" d="{to_path(geom, tdx, tdy, s)}"/>{badge}', tile_bg)

    files['brisk-tile.svg'] = tile(m, 0.74, 14)
    files['brisk-tile-square.svg'] = tile(m, 0.66, 0)  # iOS/Android apply their own mask
    small = mark_geom(9)
    files['brisk-tile-small.svg'] = tile(small, 0.8, 12)
    files['brisk-tile-small-mentions.svg'] = tile(small, 0.8, 12, '<circle cx="50" cy="50" r="14" fill="#fff"/><circle cx="50" cy="50" r="10.5" fill="#d24b4e"/>')
    files['brisk-tile-small-unread.svg'] = tile(small, 0.8, 12, '<circle cx="50" cy="50" r="14" fill="#fff"/><circle cx="50" cy="50" r="10.5" fill="#052e16"/>')

    # Lockup: mark + wordmark. Height 64; wordmark cap height 40.
    wd, ww = wordmark(font_path)
    gap = 14
    mw = maxx - minx
    lock_mark = to_path(m, -minx, (64 - (maxy - miny)) / 2 - miny)
    total_w = mw + gap + ww
    text_g = f'<g transform="translate({mw + gap:.2f} 12)">'

    def lockup(mark_fill, text_fill, defs=''):
        return svg(round(total_w, 2), 64, f'<path fill="{mark_fill}" d="{lock_mark}"/>{text_g}<path fill="{text_fill}" d="{wd}"/></g>', defs)

    files['brisk-lockup.svg'] = lockup('url(#g)', INK, gradient('g', 0, mw))
    files['brisk-lockup-green.svg'] = lockup('url(#g)', GREEN_DARK, gradient('g', 0, mw))
    files['brisk-lockup-dark.svg'] = lockup('url(#g)', '#1f2d26', gradient('g', 0, mw))
    files['brisk-lockup-gray.svg'] = lockup('#7a8580', '#7a8580')
    files['brisk-lockup-white.svg'] = lockup('#ffffff', '#ffffff')
    files['brisk-lockup-mono.svg'] = lockup('currentColor', 'currentColor')
    files['brisk-wordmark.svg'] = svg(round(ww, 2), 40, f'<path fill="{INK}" d="{wd}"/>')
    for name, body in files.items():
        with open(f'{out}/{name}', 'w') as f:
            f.write(body)
    print('\n'.join(sorted(files)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

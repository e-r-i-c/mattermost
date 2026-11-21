// Renders every Brisk PNG the web client ships from the SVG masters in
// channels/src/images/brisk/. Each output keeps the filename and pixel size of the
// file it replaces, so root.html, the PWA manifest and server email templates
// pick it up unchanged.
//
// Usage (from webapp/): node scripts/brand/render.mjs
// Regenerate the masters first with scripts/brand/make_masters.py if the mark changes.

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const images = path.resolve(here, '../../channels/src/images');
const masters = path.join(images, 'brisk');

const favicon = (name, size, master) => ({out: `favicon/${name}-${size}x${size}.png`, master, width: size, height: size});

const targets = [

    // Browser tab favicons. Small sizes use the heavier-stroke tile.
    ...[16, 24, 32].flatMap((s) => [
        favicon('favicon-default', s, 'brisk-tile-small.svg'),
        favicon('favicon-mentions', s, 'brisk-tile-small-mentions.svg'),
        favicon('favicon-unread', s, 'brisk-tile-small-unread.svg'),
    ]),
    ...[64, 96].flatMap((s) => [
        favicon('favicon-default', s, 'brisk-tile.svg'),
        favicon('favicon-mentions', s, 'brisk-tile-small-mentions.svg'),
        favicon('favicon-unread', s, 'brisk-tile-small-unread.svg'),
    ]),
    favicon('favicon', 16, 'brisk-tile-small.svg'),
    favicon('favicon', 32, 'brisk-tile-small.svg'),
    favicon('favicon', 96, 'brisk-tile.svg'),

    // Home-screen icons. iOS and Android apply their own corner mask.
    ...[57, 60, 72, 76, 120, 144, 152].map((s) => favicon('apple-touch-icon', s, 'brisk-tile-square.svg')),
    favicon('android-chrome', 192, 'brisk-tile.svg'),

    // App icons used by notifications, the OAuth authorize page and settings.
    {out: 'icon50x50.png', master: 'brisk-tile.svg', width: 50, height: 50},
    {out: 'icon64x64.png', master: 'brisk-tile.svg', width: 64, height: 64},

    // Lockups (mark + wordmark), padded to the old canvas sizes.
    {out: 'logo.png', master: 'brisk-lockup.svg', width: 465, height: 91},
    {out: 'logoWhite.png', master: 'brisk-lockup-white.svg', width: 219, height: 36},
    {out: 'logo-email.png', master: 'brisk-lockup.svg', width: 288, height: 48},
    {out: 'logo_email_blue.png', master: 'brisk-lockup-green.svg', width: 264, height: 44},
    {out: 'logo_email_dark.png', master: 'brisk-lockup-dark.svg', width: 264, height: 44},
    {out: 'logo_email_gray.png', master: 'brisk-lockup-gray.svg', width: 132, height: 22},
];

async function render({out, master, width, height}) {
    const svg = await readFile(path.join(masters, master));

    // Rasterise at 4x density for clean edges, then fit inside the target canvas,
    // left-aligned for lockups (as the old logos were) and centred for square icons.
    const square = width === height;
    const buffer = await sharp(svg, {density: 72 * 4}).
        resize(width, height, {fit: 'contain', position: square ? 'centre' : 'left', background: {r: 0, g: 0, b: 0, alpha: 0}}).
        png({compressionLevel: 9}).
        toBuffer();
    await sharp(buffer).toFile(path.join(images, out));
    return out;
}

const done = await Promise.all(targets.map(render));
// eslint-disable-next-line no-console
console.log(`Rendered ${done.length} files into ${path.relative(process.cwd(), images)}`);

/**
 * Bundle the Expo web export into ONE self-contained HTML file.
 *
 * Expo's `output: single` export already produces an SPA (index.html + one JS
 * bundle + a couple of PNGs). This script inlines the JS bundle and every
 * exported asset as a data URI so the result is a single file that runs by
 * just being opened in a browser — no web server, no GitHub Pages, no setup.
 *
 * Usage:
 *   npx expo export --platform web      # produces ./dist
 *   node scripts/build-single-html.mjs  # writes ./dist/alpha-and-carry.html
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const DIST = 'dist';
const OUT = join(DIST, 'alpha-and-carry.html');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Recursively list every file under a directory. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let html = readFileSync(join(DIST, 'index.html'), 'utf8');

// 1. Inline every binary asset (fonts, images) as a data URI, keyed by the
//    absolute "/assets/..." path Expo bakes into the bundle and the HTML.
const assetsDir = join(DIST, 'assets');
const assetReplacements = [];
let assetCount = 0;
try {
  for (const file of walk(assetsDir)) {
    const ext = extname(file).toLowerCase();
    const mime = MIME[ext];
    if (!mime) continue;
    const servedPath = '/' + relative(DIST, file).split('\\').join('/');
    const dataUri = `data:${mime};base64,${readFileSync(file).toString('base64')}`;
    // Replace occurrences inside both the HTML and (later) the JS bundle.
    html = html.split(servedPath).join(dataUri);
    assetReplacements.push([servedPath, dataUri]);
    assetCount += 1;
  }
} catch {
  // No assets directory — fine.
}

// 2. Inline the JS bundle referenced by <script src="...">.
const scriptMatch = html.match(/<script[^>]*\ssrc="([^"]+)"[^>]*><\/script>/);
if (!scriptMatch) {
  throw new Error('Could not find the bundle <script src> tag in index.html');
}
const scriptSrc = scriptMatch[1].replace(/^\//, ''); // strip leading slash
let js = readFileSync(join(DIST, scriptSrc), 'utf8');

// Apply the same asset → data-URI replacements inside the JS bundle.
for (const [path, dataUri] of assetReplacements) {
  js = js.split(path).join(dataUri);
}

// Escape any literal </script> so the inlined code can't close the tag early.
js = js.split('</script>').join('<\\/script>');

// IMPORTANT: use a replacement *function*. The bundle contains `$&`, `` $` ``
// and `$'` sequences which String.replace would otherwise interpret as special
// patterns and splice the matched <script> tag back into the output. A function
// return value is inserted verbatim.
html = html.replace(scriptMatch[0], () => `<script>${js}</script>`);

writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Wrote ${OUT} (${kb} kB, ${assetCount} assets inlined).`);

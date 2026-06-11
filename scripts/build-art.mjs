/**
 * Generates the itch.io / store art in the game's newspaper-broadsheet style —
 * all English. Renders HTML (with the real Playfair / PT-Serif fonts embedded
 * as base64) to PNG via the headless Chrome already on disk: no network, no deps.
 *
 *   node scripts/build-art.mjs
 *
 * Outputs (into branding/):
 *   cover.png         630×500   — itch.io cover
 *   cover-square.png  1024×1024 — square cover / social card
 *   icon-1024.png … icon-32.png — app/favicon icon set (icon.png = 1024)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';

/** Box-filter downscale a PNG file to a square `size` (headless Chrome can't
 *  reliably render windows below ~500px, so small icons are downsampled). */
function downscale(srcPath, size, outName) {
  const src = PNG.sync.read(readFileSync(srcPath));
  const out = new PNG({ width: size, height: size });
  const sx = src.width / size;
  const sy = src.height / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) << 2;
          r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3]; n++;
        }
      }
      const o = (y * size + x) << 2;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = a / n;
    }
  }
  writeFileSync(join(OUT, outName), PNG.sync.write(out));
  console.log(`Wrote branding/${outName} (${size}×${size}, downsampled)`);
}

const ROOT = process.cwd();
const OUT = join(ROOT, 'branding');
mkdirSync(OUT, { recursive: true });

const FONT = {
  black: 'dist/assets/node_modules/@expo-google-fonts/playfair-display/PlayfairDisplay_900Black.299c0b90ec08297dbbdaf5e486486612.ttf',
  bold: 'dist/assets/node_modules/@expo-google-fonts/playfair-display/PlayfairDisplay_700Bold.48ebb38b5445196e567f948e132230ca.ttf',
  serif: 'dist/assets/node_modules/@expo-google-fonts/pt-serif/PTSerif_400Regular.30e6f341123ce95115a85122d239f8a0.ttf',
  italic: 'dist/assets/node_modules/@expo-google-fonts/pt-serif/PTSerif_400Regular_Italic.f264e36f9419562f1605901418716d43.ttf',
};
const dataUri = (p) => `data:font/ttf;base64,${readFileSync(join(ROOT, p)).toString('base64')}`;

const C = {
  bg: '#E7DFC9',
  surface: '#F1EBD8',
  border: '#2A251B',
  text: '#211D14',
  muted: '#5C5340',
  primary: '#5A3E22',
  accent: '#6B4E2E',
  positive: '#33543A',
};

const fontFaces = `
@font-face { font-family:'PF'; font-weight:900; src:url('${dataUri(FONT.black)}'); }
@font-face { font-family:'PF'; font-weight:700; src:url('${dataUri(FONT.bold)}'); }
@font-face { font-family:'PTS'; font-weight:400; font-style:normal; src:url('${dataUri(FONT.serif)}'); }
@font-face { font-family:'PTS'; font-weight:400; font-style:italic; src:url('${dataUri(FONT.italic)}'); }
`;

/** A rising stock line as an inline SVG path. */
function chart(w, h, stroke, sw = 3, style = '') {
  const pts = [0.05, 0.22, 0.16, 0.34, 0.3, 0.28, 0.46, 0.52, 0.4, 0.62, 0.74, 0.68, 0.86, 0.95];
  const d = pts
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - y * h).toFixed(1)}`)
    .join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${style ? `style="${style}"` : ''} xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

const page = (w, h, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px}
body{background:${C.bg};color:${C.text};font-family:'PTS',serif;overflow:hidden}
.rule{border:none;border-top:2px solid ${C.border}}.rule.thin{border-top:1px solid ${C.border};opacity:.7}
.rule.dbl{border-top:5px double ${C.border}}
.dateline{font-style:italic;letter-spacing:2px;text-transform:uppercase;color:${C.muted};text-align:center}
.mast{font-family:'PF';font-weight:900;text-align:center;letter-spacing:-1px}
.amp{color:${C.primary}}
.kicker{font-family:'PF';font-weight:700;letter-spacing:6px;text-transform:uppercase;text-align:center;color:${C.accent}}
.head{font-family:'PF';font-weight:700;line-height:1.05}
.ln{background:${C.muted};opacity:.32}
.chartbox{border:2px solid ${C.border};background:${C.surface};display:flex;flex-direction:column}
.clabel{font-family:'PF';font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.muted}}
.tag{font-style:italic;color:${C.muted};text-align:center}
</style></head><body>${body}</body></html>`;

const COVER = page(
  630,
  500,
  `<div style="width:630px;height:500px;padding:22px;display:flex;flex-direction:column">
  <div class="dateline" style="font-size:12px;padding:6px 0">The Financial Chronicle · Founded in Year I · Price 2 / 20</div>
  <hr class="rule dbl"/>
  <div class="mast" style="font-size:92px;line-height:.92;padding:6px 0 2px">Alpha <span class="amp">&amp;</span> Carry</div>
  <hr class="rule"/>
  <div class="kicker" style="font-size:15px;padding-top:4px">A Fund-Management Simulation</div>
  <div style="flex:1;display:flex;gap:18px;padding-top:14px">
    <div style="flex:1;display:flex;flex-direction:column;gap:6px">
      <div class="head" style="font-size:20px">Read the cycle. Build the team. Deliver alpha.</div>
      <div class="ln" style="height:7px"></div><div class="ln" style="height:7px"></div>
      <div class="ln" style="height:7px;width:70%"></div><div class="ln" style="height:7px"></div>
      <div class="ln" style="height:7px;width:70%"></div>
    </div>
    <div class="chartbox" style="flex:1.15;padding:10px">
      <div class="clabel" style="font-size:12px">Enterprise Value · 20 Years</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">${chart(230, 150, C.positive, 4)}</div>
    </div>
  </div>
  <div class="tag" style="font-size:13px;padding-top:8px">Equities · Bonds · FX · Options · Startups · Crises</div>
  <hr class="rule thin" style="margin-top:8px"/>
</div>`,
);

const COVER_SQ = page(
  1024,
  1024,
  `<div style="width:1024px;height:1024px;padding:54px;display:flex;flex-direction:column">
  <div class="dateline" style="font-size:20px;padding:10px 0">The Financial Chronicle · Founded in Year I</div>
  <hr class="rule dbl"/>
  <div class="mast" style="font-size:150px;line-height:.95;padding:24px 0 8px">Alpha<br><span class="amp">&amp;</span> Carry</div>
  <hr class="rule"/>
  <div class="kicker" style="font-size:24px;padding-top:14px">A Fund-Management Simulation</div>
  <div class="chartbox" style="flex:1;margin-top:34px;padding:22px">
    <div class="clabel" style="font-size:20px">Enterprise Value · 20 Years</div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center">${chart(760, 300, C.positive, 9)}</div>
  </div>
  <div class="tag" style="font-size:23px;padding-top:22px">Equities · Bonds · FX · Options · Startups · Crises</div>
</div>`,
);

/** Square icon; fills the viewport at any size (vw/vh/vmin). `detail` adds kicker + chart. */
const icon = (detail) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%}
body{background:${C.bg};overflow:hidden;font-family:'PF'}
.amp{color:${C.primary}}
.kicker{font-weight:700;letter-spacing:6px;text-transform:uppercase;color:${C.accent}}
.mast{font-weight:900;letter-spacing:-1vmin;color:${C.text}}
</style></head><body>
  <div style="width:100vw;height:100vh;padding:5.3vmin">
    <div style="width:100%;height:100%;border:1.8vmin solid ${C.border};background:${C.surface};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
      ${detail ? `<div class="kicker" style="font-size:4.4vmin;position:absolute;top:6.8vmin">Est. Year I</div>` : ''}
      <div class="mast" style="font-size:${detail ? 40 : 50}vmin;line-height:.8;margin-bottom:${detail ? 8 : 0}vmin">A<span class="amp" style="font-size:${detail ? 29 : 36}vmin">&amp;</span>C</div>
      ${detail ? `<div style="position:absolute;bottom:8vmin;left:0;right:0;display:flex;justify-content:center">${chart(620, 150, C.positive, 10, 'width:74vmin;height:auto')}</div>` : ''}
    </div>
  </div>
</body></html>`;

const CHROME = '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const tmp = mkdtempSync(join(tmpdir(), 'art-'));

function render(html, w, h, outName) {
  const f = join(tmp, `${outName}.html`);
  writeFileSync(f, html);
  execFileSync(
    CHROME,
    ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=3000', `--window-size=${w},${h}`, `--screenshot=${join(OUT, outName)}`, `file://${f}`],
    { stdio: 'ignore' },
  );
  console.log(`Wrote branding/${outName} (${w}×${h})`);
}

render(COVER, 630, 500, 'cover.png');
render(COVER_SQ, 1024, 1024, 'cover-square.png');

// Detailed icon (kicker + chart) at the larger sizes Chrome renders reliably.
render(icon(true), 1024, 1024, 'icon-1024.png');
render(icon(false), 512, 512, 'icon-512.png'); // simple monogram reads better small
// Small sizes: render the simple monogram at a safe 512 master, then downsample.
const master = join(OUT, 'icon-512.png');
for (const s of [256, 192, 180, 32]) downscale(master, s, `icon-${s}.png`);
copyFileSync(join(OUT, 'icon-1024.png'), join(OUT, 'icon.png'));
console.log('Wrote branding/icon.png (= icon-1024)');

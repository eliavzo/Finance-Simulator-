/**
 * Generates the itch.io cover (630×500) and app icon (1024×1024) in the game's
 * newspaper/broadsheet style. Renders HTML (with the real Playfair/PT-Serif
 * fonts embedded as base64) to PNG via the headless Chrome already on disk —
 * no network, no extra deps.
 *
 *   node scripts/build-art.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const FONT = {
  black: 'dist/assets/node_modules/@expo-google-fonts/playfair-display/PlayfairDisplay_900Black.299c0b90ec08297dbbdaf5e486486612.ttf',
  bold: 'dist/assets/node_modules/@expo-google-fonts/playfair-display/PlayfairDisplay_700Bold.48ebb38b5445196e567f948e132230ca.ttf',
  serif: 'dist/assets/node_modules/@expo-google-fonts/pt-serif/PTSerif_400Regular.30e6f341123ce95115a85122d239f8a0.ttf',
  italic: 'dist/assets/node_modules/@expo-google-fonts/pt-serif/PTSerif_400Regular_Italic.f264e36f9419562f1605901418716d43.ttf',
};
const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');
const dataUri = (p) => `data:font/ttf;base64,${b64(p)}`;

const C = {
  bg: '#E7DFC9',
  surface: '#F1EBD8',
  border: '#2A251B',
  text: '#211D14',
  muted: '#5C5340',
  primary: '#5A3E22',
  accent: '#6B4E2E',
  positive: '#33543A',
  negative: '#7C2B22',
  paper: '#F3EEDD',
};

const fontFaces = `
@font-face { font-family:'PF'; font-weight:900; src:url('${dataUri(FONT.black)}'); }
@font-face { font-family:'PF'; font-weight:700; src:url('${dataUri(FONT.bold)}'); }
@font-face { font-family:'PTS'; font-weight:400; font-style:normal; src:url('${dataUri(FONT.serif)}'); }
@font-face { font-family:'PTS'; font-weight:400; font-style:italic; src:url('${dataUri(FONT.italic)}'); }
`;

/** A rising stock line as an inline SVG path. */
function chart(w, h, stroke, sw = 3) {
  const pts = [0.05, 0.22, 0.16, 0.34, 0.3, 0.28, 0.46, 0.52, 0.4, 0.62, 0.74, 0.68, 0.86, 0.95];
  const d = pts
    .map((y, i) => {
      const x = (i / (pts.length - 1)) * w;
      const yy = h - y * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yy.toFixed(1)}`;
    })
    .join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

const COVER = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:630px;height:500px}
body{background:${C.bg};color:${C.text};font-family:'PTS',serif;overflow:hidden}
.frame{width:630px;height:500px;padding:22px;display:flex;flex-direction:column}
.rule{border:none;border-top:2px solid ${C.border}}
.rule.thin{border-top:1px solid ${C.border};opacity:.7}
.rule.dbl{border-top:5px double ${C.border}}
.dateline{font-style:italic;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};text-align:center;padding:6px 0}
.masthead{font-family:'PF';font-weight:900;font-size:92px;line-height:.92;text-align:center;letter-spacing:-1px;padding:6px 0 2px}
.amp{color:${C.primary}}
.kicker{font-family:'PF';font-weight:700;font-size:15px;letter-spacing:6px;text-transform:uppercase;text-align:center;color:${C.accent};padding-top:4px}
.body{flex:1;display:flex;gap:18px;padding-top:14px}
.col{flex:1;display:flex;flex-direction:column;gap:6px}
.head{font-family:'PF';font-weight:700;font-size:20px;line-height:1.05}
.ln{height:7px;background:${C.muted};opacity:.32}
.ln.s{width:70%}
.chartbox{flex:1.15;border:2px solid ${C.border};background:${C.surface};padding:10px;display:flex;flex-direction:column}
.chartlabel{font-family:'PF';font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.muted}}
.tag{font-style:italic;font-size:13px;color:${C.muted};text-align:center;padding-top:8px}
</style></head><body>
<div class="frame">
  <div class="dateline">Die Finanz-Chronik · Gegründet im Jahr I · Preis 2 / 20</div>
  <hr class="rule dbl"/>
  <div class="masthead">Alpha <span class="amp">&amp;</span> Carry</div>
  <hr class="rule"/>
  <div class="kicker">Eine Fonds-Management-Simulation</div>
  <div class="body">
    <div class="col">
      <div class="head">Lies den Zyklus. Stelle das Team. Liefere Alpha.</div>
      <div class="ln"></div><div class="ln"></div><div class="ln s"></div>
      <div class="ln"></div><div class="ln s"></div>
    </div>
    <div class="chartbox">
      <div class="chartlabel">Unternehmenswert · 20 Jahre</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">${chart(230, 150, C.positive, 4)}</div>
    </div>
  </div>
  <div class="tag">Aktien · Anleihen · Devisen · Optionen · Startups · Krisen</div>
  <hr class="rule thin" style="margin-top:8px"/>
</div>
</body></html>`;

const ICON = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1024px;height:1024px}
body{background:${C.bg};font-family:'PF';overflow:hidden}
.pad{width:1024px;height:1024px;padding:54px}
.box{width:100%;height:100%;border:18px solid ${C.border};background:${C.surface};
  display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
.k{font-weight:700;font-size:46px;letter-spacing:10px;text-transform:uppercase;color:${C.accent};position:absolute;top:70px}
.mono{font-weight:900;font-size:430px;line-height:.8;color:${C.text};letter-spacing:-10px}
.amp{font-size:300px;color:${C.primary};vertical-align:middle}
.chart{position:absolute;bottom:78px;left:0;right:0;display:flex;justify-content:center}
.yr{font-family:'PTS';font-style:italic;font-size:34px;color:${C.muted};position:absolute;bottom:34px}
</style></head><body>
<div class="pad"><div class="box">
  <div class="k">EST. YEAR I</div>
  <div class="mono">A<span class="amp">&amp;</span>C</div>
  <div class="chart">${chart(620, 150, C.positive, 14)}</div>
</div></div>
</body></html>`;

const CHROME =
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const tmp = mkdtempSync(join(tmpdir(), 'art-'));

function render(html, w, h, out) {
  const f = join(tmp, `${out}.html`);
  writeFileSync(f, html);
  const outPath = join(ROOT, 'itch-dist', out);
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${w},${h}`,
      `--screenshot=${outPath}`,
      `file://${f}`,
    ],
    { stdio: 'ignore' },
  );
  console.log(`Wrote itch-dist/${out} (${w}×${h})`);
}

render(COVER, 630, 500, 'cover.png');
render(ICON, 1024, 1024, 'icon.png');

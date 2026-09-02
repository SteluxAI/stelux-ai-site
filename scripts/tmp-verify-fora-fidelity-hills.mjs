// Read-only probe: render assets-src/hills.svg over the dusk sky colour with
// individual elements toggled off, to identify what produces the pale band
// above the right/left far-hill ridges.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'assets-src/hills.svg'), 'utf8');
const out = path.join(root, 'shots/verify-hills');
fs.mkdirSync(out, { recursive: true });

const variants = {
  asis: svg,
  // remove the two far-hill crest ellipses (inside the blurred groups)
  nocrestFar: svg
    .replace(/<ellipse cx="300" cy="262"[^>]*\/>/, '')
    .replace(/<ellipse cx="1330" cy="250"[^>]*\/>/, ''),
  // remove ALL crest ellipses
  nocrestAll: svg.replace(/<ellipse[^>]*fill="url\(#crest\)"[^>]*\/>/g, ''),
  // remove the horizon haze rect
  nohz: svg.replace(/<rect x="0" y="180" width="1440" height="420" fill="url\(#hz\)"\/>/, ''),
  // no blur filter
  noblur: svg.replace(/filter="url\(#softer\)"/g, ''),
  // crest ellipses clipped to their own hill path (what the author likely intended)
  clipped: svg
    .replace('<clipPath id="allhills">',
      '<clipPath id="cFarR"><path d="M980,430 C1080,320 1240,232 1440,262 L1440,600 L980,600 Z"/></clipPath>' +
      '<clipPath id="cFarL"><path d="M0,330 C120,296 210,250 330,286 C430,316 480,326 570,300 C640,280 700,290 760,318 L760,600 L0,600 Z"/></clipPath>' +
      '<clipPath id="allhills">')
    .replace('<ellipse cx="300" cy="262"', '<ellipse clip-path="url(#cFarL)" cx="300" cy="262"')
    .replace('<ellipse cx="1330" cy="250"', '<ellipse clip-path="url(#cFarR)" cx="1330" cy="250"'),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 1 });

const results = {};
for (const [name, body] of Object.entries(variants)) {
  // dusk sky approximation behind the hills (sampled from the live hero sky ~#8f7a7f)
  const html = `<!doctype html><html><body style="margin:0;background:#8f7a7f;width:1440px;height:760px;overflow:hidden">
  <div style="width:1440px;height:760px">${body.replace('<svg ', '<svg width="1440" height="760" ')}</div></body></html>`;
  await page.setContent(html);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `${name}-right.png`), clip: { x: 960, y: 300, width: 480, height: 300 } });
  await page.screenshot({ path: path.join(out, `${name}-left.png`), clip: { x: 0, y: 300, width: 480, height: 300 } });
  // sample pixels: column x=1300 from y=300..520 (viewBox coords; ridge crest ~ y=416 at x~1352)
  const samples = await page.evaluate(async () => {
    const svgEl = document.querySelector('svg');
    const xml = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    await img.decode();
    const c = document.createElement('canvas'); c.width = 1440; c.height = 760;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8f7a7f'; ctx.fillRect(0, 0, 1440, 760);
    ctx.drawImage(img, 0, 0);
    const col = (x, ys) => ys.map(y => { const d = ctx.getImageData(x, y, 1, 1).data; return `${y}:rgb(${d[0]},${d[1]},${d[2]})`; });
    return { x1300: col(1300, [320, 340, 360, 380, 400, 410, 420, 440, 460]), x1100: col(1100, [380, 420, 460, 500, 540]), x120: col(120, [340, 360, 380, 400, 420, 440, 460]) };
  });
  results[name] = samples;
}
console.log(JSON.stringify(results, null, 1));
await browser.close();

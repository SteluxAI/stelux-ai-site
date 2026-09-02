// Read-only probe of the live build: sample on-screen colours in the right-hand
// sky / band / hill region beside the dashboard, and save a zoomed crop.
import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('shots/verify-hills', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/verify-hills/live-right.png', clip: { x: 1180, y: 440, width: 260, height: 260 } });
await page.screenshot({ path: 'shots/verify-hills/live-left.png', clip: { x: 0, y: 440, width: 260, height: 260 } });
await page.screenshot({ path: 'shots/verify-hills/live-full.png' });
const png = fs.readFileSync('shots/verify-hills/live-full.png');
// decode via browser canvas for pixel sampling
const samples = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const col = (x, ys) => ys.map(y => { const d = ctx.getImageData(x, y, 1, 1).data; return `${y}:rgb(${d[0]},${d[1]},${d[2]})`; });
  return { x1330: col(1330, [460, 500, 520, 540, 560, 580, 600, 620, 640, 660]), x1260: col(1260, [500, 540, 580, 620, 660]), x100: col(100, [480, 520, 560, 600, 640, 680]) };
}, png.toString('base64'));
console.log(JSON.stringify(samples, null, 1));
// geometry: where does the hills img sit and what is its rendered size?
console.log(await page.evaluate(() => { const r = document.querySelector('.hills').getBoundingClientRect(); return { top: r.top, height: r.height, width: r.width }; }));
await browser.close();

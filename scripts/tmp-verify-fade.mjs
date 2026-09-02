import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.SHOT_URL || 'http://localhost:4173/';
const OUT = 'shots/verify-fade';
fs.mkdirSync(OUT, { recursive: true });

async function samples(page, buf, points) {
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  return page.evaluate(async ({ dataUrl, points }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return points.map(([x, y]) => { const d = ctx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; });
  }, { dataUrl, points });
}
const lum = ([r, g, b]) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

async function run(vp, label, scrolls) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const geo = await page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), z: cs.zIndex }; };
    return { hero: r('.hero'), fade: r('.hero-fade'), fg: r('.hero-fg'), fgImg: r('.hero-fg img'), dash: r('.dash'), dashMain: r('.dash-main'), dashSide: r('.dash-side'), heroContent: r('.hero-content'), products: r('#products'), fadeBg: getComputedStyle(document.querySelector('.hero-fade')).backgroundImage };
  });
  console.log(`\n=== ${label} ${vp.width}x${vp.height} ===`);
  console.log(JSON.stringify(geo, null, 1));

  for (const sy of scrolls) {
    await page.evaluate((y) => window.scrollTo(0, y), sy);
    await page.waitForTimeout(800);
    const rects = await page.evaluate(() => {
      const g = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
      return { fade: g('.hero-fade'), fg: g('.hero-fg'), dash: g('.dash'), dashMain: g('.dash-main') };
    });
    const on = await page.screenshot();
    await page.addStyleTag({ content: '.hero-fade{display:none!important}' });
    await page.waitForTimeout(150);
    const off = await page.screenshot();
    await page.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); if (s && s.textContent.includes('.hero-fade{display:none')) s.remove(); });
    fs.writeFileSync(`${OUT}/${label}-s${sy}-fadeOn.png`, on);
    fs.writeFileSync(`${OUT}/${label}-s${sy}-fadeOff.png`, off);
    console.log(`\n-- scroll ${sy}: fade ${rects.fade.top}..${rects.fade.bottom} | fg ${rects.fg.top}..${rects.fg.bottom} | dash ${rects.dash.top}..${rects.dash.bottom} | dashMain ${rects.dashMain.top}..${rects.dashMain.bottom}`);
    const cols = vp.width >= 1000 ? { sidebar: 320, panelC: 700, panelR: 1150, hillsL: 60, hillsR: 1400 } : { sidebar: 30, panelC: 200, panelR: 330, hillsL: 6 };
    const ys = [];
    for (let y = Math.max(0, rects.fade.top - 30); y < vp.height; y += 15) ys.push(y);
    ys.push(vp.height - 1);
    for (const [name, x] of Object.entries(cols)) {
      const pts = ys.map((y) => [x, y]);
      const a = await samples(page, on, pts);
      const b = await samples(page, off, pts);
      const rows = ys.map((y, i) => { const la = lum(a[i]), lb = lum(b[i]); const drop = lb ? Math.round((1 - la / lb) * 100) : 0; return `y${y}:${lb}->${la}(-${drop}%)`; });
      console.log(`${name.padEnd(8)} x=${x}: ${rows.join('  ')}`);
    }
    // bottom crops for visual side-by-side reading
    const H = 160;
    await page.screenshot({ path: `${OUT}/${label}-s${sy}-bottom-on.png`, clip: { x: 0, y: vp.height - H, width: vp.width, height: H } });
    await page.addStyleTag({ content: '.hero-fade{display:none!important}' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${label}-s${sy}-bottom-off.png`, clip: { x: 0, y: vp.height - H, width: vp.width, height: H } });
    await page.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); if (s && s.textContent.includes('.hero-fade{display:none')) s.remove(); });
  }
  await browser.close();
}

await run({ width: 1440, height: 900 }, 'desktop', [0, 150, 300, 450]);
await run({ width: 375, height: 812 }, 'mobile', [0, 200]);

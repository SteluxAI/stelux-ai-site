import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const ov = (a,b)=> a && b && a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
for (const w of [640, 700, 768, 820, 900, 1024, 1100, 1200, 1280, 1440]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const q = s => document.querySelector(s);
    return { widgets: [...document.querySelectorAll('.dash-widget')].map(box), avatar: box(q('.dash-avatar')), title: box(q('#dash-title')), sub: box(q('#dash-sub')), ticker: box(q('#dash-ticker')), main: box(q('.dash-main')) };
  });
  const [sw, cp] = r.widgets;
  const hits = [];
  for (const [name, el] of [['avatar', r.avatar], ['title', r.title], ['sub', r.sub], ['ticker', r.ticker]]) {
    if (ov(sw, el)) hits.push('swarm∩' + name);
    if (ov(cp, el)) hits.push('compute∩' + name);
  }
  const gapL = r.avatar.x - (sw.x + sw.w), gapR = cp.x - (r.avatar.x + r.avatar.w);
  console.log(`${w}px main=${Math.round(r.main.w)} gapL=${Math.round(gapL)} gapR=${Math.round(gapR)} overlaps=[${hits.join(', ')}]`);
}
await browser.close();

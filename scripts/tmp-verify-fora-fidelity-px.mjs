import { chromium } from 'playwright';

const url = process.env.SHOT_URL || 'http://localhost:4173/';
const browser = await chromium.launch();

async function samplePixels(page, buf, points) {
  const b64 = buf.toString('base64');
  return page.evaluate(async ({ b64, points }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return points.map(([x, y, label]) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const lum = (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255;
      return { label, x, y, rgb: [d[0], d[1], d[2]], lum: +lum.toFixed(3) };
    });
  }, { b64, points });
}

for (const [name, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 375, height: 812 } })) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Points: panel column (inside .dash-main away from decorations), sidebar column, and rows from just above fade start to viewport bottom.
  const pts = name === 'desktop'
    ? [
        [830, 820, 'panel y820 (above fade)'], [830, 845, 'panel y845'], [830, 870, 'panel y870'], [830, 885, 'panel y885'], [830, 898, 'panel y898 (viewport bottom)'],
        [1150, 820, 'panel-right y820'], [1150, 898, 'panel-right y898'],
        [320, 820, 'sidebar y820'], [320, 898, 'sidebar y898'],
        [100, 820, 'hills-left y820'], [100, 898, 'hills-left y898'],
      ]
    : [
        [187, 700, 'panel y700'], [187, 780, 'panel y780'], [187, 800, 'panel y800'], [187, 810, 'panel y810 (viewport bottom)'],
      ];

  const shotWith = await page.screenshot({ fullPage: false });
  const withFade = await samplePixels(page, shotWith, pts);

  await page.addStyleTag({ content: '.hero-fade{display:none !important}' });
  await page.waitForTimeout(200);
  const shotWithout = await page.screenshot({ fullPage: false });
  const noFade = await samplePixels(page, shotWithout, pts);

  console.log(`\n=== ${name} (${vp.width}x${vp.height}) ===`);
  for (let i = 0; i < pts.length; i++) {
    const a = withFade[i], b = noFade[i];
    const drop = b.lum > 0 ? ((b.lum - a.lum) / b.lum * 100).toFixed(1) : 'n/a';
    console.log(`${a.label.padEnd(30)} with=${JSON.stringify(a.rgb)} lum=${a.lum}  |  without=${JSON.stringify(b.rgb)} lum=${b.lum}  |  lum drop=${drop}%`);
  }
  await page.close();

  // 2x zoom crops of the bottom band, with & without fade, for visual comparison.
  const page2 = await browser.newPage({ viewport: vp, deviceScaleFactor: 2 });
  await page2.goto(url, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1500);
  const clip = name === 'desktop' ? { x: 150, y: 760, width: 1140, height: 140 } : { x: 0, y: 660, width: 375, height: 152 };
  await page2.screenshot({ path: `shots/verify-fora-fidelity/zoom-${name}-bottom-with-fade.png`, clip });
  await page2.addStyleTag({ content: '.hero-fade{display:none !important}' });
  await page2.waitForTimeout(200);
  await page2.screenshot({ path: `shots/verify-fora-fidelity/zoom-${name}-bottom-no-fade.png`, clip });
  await page2.close();
}
await browser.close();

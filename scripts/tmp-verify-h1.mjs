import { chromium } from 'playwright';
const url = process.env.SHOT_URL || 'http://localhost:4173/';
const browser = await chromium.launch();
for (const vp of [{w:375,h:812},{w:390,h:844},{w:414,h:896},{w:360,h:780},{w:320,h:568},{w:640,h:900},{w:1440,h:900}]) {
  const ctx = await browser.newContext({ viewport: {width: vp.w, height: vp.h}, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const h1 = document.querySelector('.hero-h1');
    const r = h1.getBoundingClientRect();
    const cs = getComputedStyle(h1);
    // measure individual line boxes via Range on text nodes
    const range = document.createRange();
    const lines = [];
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      for (let i = 0; i < n.textContent.length; i++) {
        range.setStart(n, i); range.setEnd(n, i+1);
        const rr = range.getBoundingClientRect();
        if (rr.width === 0) continue;
        const ch = n.textContent[i];
        const last = lines[lines.length-1];
        if (last && Math.abs(last.top - rr.top) < 2) {
          last.text += ch; last.right = Math.max(last.right, rr.right); last.left = Math.min(last.left, rr.left);
        } else {
          lines.push({ top: Math.round(rr.top), left: rr.left, right: rr.right, text: ch });
        }
      }
    }
    return {
      fontSize: cs.fontSize, textWrap: cs.textWrap, width: r.width, left: r.left,
      lines: lines.map(l => ({ top: l.top, text: l.text.trim(), w: Math.round(l.right - l.left), pct: Math.round((l.right - l.left) / r.width * 100) }))
    };
  });
  console.log(`\n== ${vp.w}x${vp.h} ==`);
  console.log(JSON.stringify(info, null, 1));
  // Hypothetical: remove <br> and see how balance wraps
  const alt = await page.evaluate(() => {
    const h1 = document.querySelector('.hero-h1');
    const orig = h1.innerHTML;
    h1.innerHTML = orig.replace('<br>', ' ');
    const r = h1.getBoundingClientRect();
    const range = document.createRange();
    const lines = [];
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      for (let i = 0; i < n.textContent.length; i++) {
        range.setStart(n, i); range.setEnd(n, i+1);
        const rr = range.getBoundingClientRect();
        if (rr.width === 0) continue;
        const ch = n.textContent[i];
        const last = lines[lines.length-1];
        if (last && Math.abs(last.top - rr.top) < 2) { last.text += ch; last.right = Math.max(last.right, rr.right); last.left = Math.min(last.left, rr.left); }
        else lines.push({ top: Math.round(rr.top), left: rr.left, right: rr.right, text: ch });
      }
    }
    const res = lines.map(l => ({ top: l.top, text: l.text.trim(), w: Math.round(l.right - l.left), pct: Math.round((l.right - l.left) / r.width * 100) }));
    h1.innerHTML = orig;
    return res;
  });
  console.log('without <br> (balance only):', JSON.stringify(alt));
  if (vp.w === 375) {
    await page.screenshot({ path: 'shots/verify-h1/mobile-375-current.png', clip: { x: 0, y: 120, width: 375, height: 260 } });
    await page.evaluate(() => { const h1 = document.querySelector('.hero-h1'); h1.innerHTML = h1.innerHTML.replace('<br>', ' '); });
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'shots/verify-h1/mobile-375-nobr.png', clip: { x: 0, y: 120, width: 375, height: 260 } });
  }
  await ctx.close();
}
await browser.close();

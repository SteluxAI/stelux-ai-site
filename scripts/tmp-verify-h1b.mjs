import { chromium } from 'playwright';
const url = 'http://localhost:4173/';
const browser = await chromium.launch();
const measure = () => {
  const h1 = document.querySelector('.hero-h1');
  const r = h1.getBoundingClientRect();
  const range = document.createRange(); const lines = [];
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) for (let i = 0; i < n.textContent.length; i++) {
    range.setStart(n, i); range.setEnd(n, i+1); const rr = range.getBoundingClientRect(); if (!rr.width) continue;
    const last = lines[lines.length-1];
    if (last && Math.abs(last.top - rr.top) < 2) { last.text += n.textContent[i]; last.right = Math.max(last.right, rr.right); last.left = Math.min(last.left, rr.left); }
    else lines.push({ top: Math.round(rr.top), left: rr.left, right: rr.right, text: n.textContent[i] });
  }
  return lines.map(l => `${l.text.trim()} (${Math.round((l.right-l.left)/r.width*100)}%)`).join(' | ');
};
for (const w of [640, 768, 1024, 1280, 1440, 1920]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const a = await page.evaluate(measure);
  const b = await page.evaluate((m) => { const h1 = document.querySelector('.hero-h1'); h1.innerHTML = h1.innerHTML.replace('<br>', ' '); return eval(m)(); }, measure.toString());
  console.log(`${w}px  with<br>: ${a}\n${' '.repeat(String(w).length+2)} no<br>:   ${b}  ${a===b?'SAME':'DIFFERENT'}`);
  await ctx.close();
}
// 360px screenshots
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/verify-h1/mobile-360-current.png', clip: { x: 0, y: 120, width: 360, height: 300 } });
await page.evaluate(() => { const h1 = document.querySelector('.hero-h1'); h1.innerHTML = h1.innerHTML.replace('<br>', ' '); });
await page.screenshot({ path: 'shots/verify-h1/mobile-360-nobr.png', clip: { x: 0, y: 120, width: 360, height: 300 } });
await browser.close();

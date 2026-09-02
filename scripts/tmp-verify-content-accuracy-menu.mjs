import { chromium } from 'playwright';
const url = process.env.SHOT_URL || 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.click('#menu-btn');
await page.waitForTimeout(500);
const open = await page.evaluate(() => {
  const mm = document.querySelector('#mobile-menu');
  const items = [...mm.querySelectorAll('nav a')].map(a => { const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), href: a.getAttribute('href'), y: Math.round(r.top), visible: r.width > 0 && r.height > 0 }; });
  return { hidden: mm.hidden, items };
});
console.log(JSON.stringify(open, null, 1));
await page.screenshot({ path: 'shots/verify-content-accuracy/mobile-menu-open-375.png' });
await browser.close();

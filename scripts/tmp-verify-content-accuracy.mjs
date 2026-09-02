import { chromium } from 'playwright';
const url = process.env.SHOT_URL || 'http://localhost:4173/';
const browser = await chromium.launch();
for (const vp of [{ w: 1440, h: 900 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 375, h: 812 }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const res = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const nav = [...document.querySelectorAll('#nav a')].map(a => ({ text: a.textContent.trim().replace(/\s+/g,' '), href: a.getAttribute('href'), visible: vis(a) }));
    const mm = document.querySelector('#mobile-menu');
    const mobile = [...document.querySelectorAll('#mobile-menu a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
    const menuBtn = document.querySelector('#menu-btn');
    const showcase = document.querySelector('#showcase');
    const showcaseLinks = [...document.querySelectorAll('a[href="#showcase"]')].map(a => ({ text: a.textContent.trim().replace(/\s+/g,' '), inNav: !!a.closest('#nav'), inMobile: !!a.closest('#mobile-menu'), visible: vis(a) }));
    const navRect = document.querySelector('#nav').getBoundingClientRect();
    return { navLinks: nav, mobileMenuHidden: mm.hidden, mobileLinks: mobile, menuBtnVisible: menuBtn ? vis(menuBtn) : null, showcaseExists: !!showcase, showcaseHeading: showcase?.querySelector('h2')?.textContent.trim(), showcaseLinks, navWidth: Math.round(navRect.width), navLeft: Math.round(navRect.left) };
  });
  console.log(`\n=== ${vp.w}x${vp.h} ===`);
  console.log(JSON.stringify(res, null, 1));
  await page.screenshot({ path: `shots/verify-content-accuracy/nav-${vp.w}.png`, clip: { x: 0, y: 0, width: vp.w, height: 120 } });
  await page.close();
}
await browser.close();

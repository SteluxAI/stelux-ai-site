import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.env.SHOT_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' });
const legal = await page.evaluate(() => {
  const out = {};
  const heads = [...document.querySelectorAll('footer div')].filter(d => d.textContent.trim() === 'Legal' && d.children.length === 0);
  const h = heads[0];
  out.legalHeadingFound = !!h;
  if (h) {
    const ul = h.parentElement.querySelector('ul');
    out.links = [...ul.querySelectorAll('a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href'), resolved: a.href }));
  }
  out.allFooterHrefs = [...document.querySelectorAll('footer a')].map(a => ({ text: a.textContent.trim().slice(0,40), href: a.getAttribute('href') }));
  out.anyLegalPageLinks = [...document.querySelectorAll('a')].map(a => a.getAttribute('href') || '').filter(h => /privacy|terms|legal|security/i.test(h));
  return out;
});
console.log(JSON.stringify(legal, null, 2));
// scroll to footer and screenshot it
const footer = await page.$('footer');
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/verify-brief-compliance/desktop-footer.png', fullPage: false });
await footer.screenshot({ path: 'shots/verify-brief-compliance/footer-element.png' });
// probe: does /privacy.html etc exist on the server?
for (const p of ['privacy.html','terms.html','security.html','legal.html','privacy','terms','security','legal']) {
  const r = await page.request.get('http://localhost:4173/' + p);
  const ct = r.headers()['content-type'] || '';
  const body = await r.text();
  console.log(p, r.status(), ct, 'isIndexFallback=', /Stelux AI/.test(body) && /Launch Platform/.test(body));
}
await browser.close();

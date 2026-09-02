import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) }); p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
const out = []
for (const v of ['overview','agents','tasks','data','compute','logs','products']) {
  await p.click(`.dash-nav[data-view="${v}"]`); await p.waitForTimeout(450)
  out.push(await p.evaluate((v) => ({ v,
    active: document.querySelector('.dash-nav.active')?.dataset.view,
    sub: document.querySelector('#dash-sub')?.innerText.replace(/\s+/g,' '),
    title: document.querySelector('#dash-title')?.textContent,
    widgets: [...document.querySelectorAll('.dash-widget')].map(w => getComputedStyle(w).display),
    ticker: document.querySelector('#dash-ticker')?.textContent }), v))
}
console.log(JSON.stringify(out, null, 1)); console.log('errors:', errs)
await b.close()

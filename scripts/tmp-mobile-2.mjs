import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = 'http://localhost:4173/'
const OUT = 'shots/mobile-custom'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
for (const w of [640, 700, 768, 834, 900, 960, 1000, 1024, 1100, 1180]) {
  await page.setViewportSize({ width: w, height: 1024 })
  await page.waitForTimeout(500)
  const r = await page.evaluate(() => {
    const R = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) } }
    const widgets = Array.from(document.querySelectorAll('.dash-widget')).filter((w) => getComputedStyle(w).display !== 'none').map(R)
    const items = { avatar: R(document.querySelector('.dash-avatar')), title: R(document.querySelector('#dash-title')), sub: R(document.querySelector('#dash-sub')), ticker: R(document.querySelector('#dash-ticker')), cta: R(document.querySelector('.dash-cta')) }
    const ov = {}
    for (const [k, a] of Object.entries(items)) {
      ov[k] = widgets.map((b) => { const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l); const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t); return ox > 0 && oy > 0 ? ox + 'x' + oy : '-' }).join(',')
    }
    return { mainW: document.querySelector('.dash-main').offsetWidth, side: getComputedStyle(document.querySelector('.dash-side')).display, widgets: widgets.length, ov }
  })
  console.log('w=' + w, JSON.stringify(r))
  if ([640, 834, 900].includes(w)) await page.screenshot({ path: OUT + '/hero-w' + w + '.png', clip: { x: 0, y: 380, width: w, height: 560 } })
}
// css layer check: is .hidden beaten by .btn-glow?
await page.setViewportSize({ width: 375, height: 812 })
await page.waitForTimeout(400)
const layer = await page.evaluate(() => {
  const el = document.querySelector('#nav a.btn-glow')
  const t = document.createElement('a'); t.className = 'hidden'; document.body.appendChild(t)
  const t2 = document.createElement('a'); t2.className = 'btn-glow hidden'; document.body.appendChild(t2)
  const t3 = document.createElement('span'); t3.className = 'pill hidden'; document.body.appendChild(t3)
  const t4 = document.createElement('span'); t4.className = 'eyebrow hidden'; document.body.appendChild(t4)
  const out = { navCta: getComputedStyle(el).display, plainHidden: getComputedStyle(t).display, btnGlowHidden: getComputedStyle(t2).display, pillHidden: getComputedStyle(t3).display, eyebrowHidden: getComputedStyle(t4).display }
  t.remove(); t2.remove(); t3.remove(); t4.remove()
  // find layer statement in stylesheet
  let layers = ''
  for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) { if (r.constructor.name === 'CSSLayerStatementRule') layers += r.cssText + ' ' } } catch {} }
  return { ...out, layers }
})
console.log('LAYER CHECK', JSON.stringify(layer))
await browser.close()

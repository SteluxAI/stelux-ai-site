import { chromium } from 'playwright'
const browser = await chromium.launch()
const out = []
for (const w of [1440, 1280, 1100, 1024, 960, 900, 800, 768, 700, 640]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  await page.goto(process.env.SHOT_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const bb = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) } : null }
    const ws = [...document.querySelectorAll('.dash-widget')].map((e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) } })
    const main = bb('.dash-main')
    const ov = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    const targets = { avatar: bb('.dash-avatar'), title: bb('#dash-title'), sub: bb('#dash-sub'), ticker: bb('#dash-ticker') }
    const collisions = []
    for (const [k, t] of Object.entries(targets)) ws.forEach((wg, i) => { if (ov(wg, t)) collisions.push(`${k}~widget${i}`) })
    const cs = getComputedStyle(document.querySelector('.dash-widget'))
    return { mainW: main && main.w, widgets: ws, gap: ws.length === 2 ? ws[1].l - ws[0].r : null, titleW: targets.title && targets.title.w, subW: targets.sub && targets.sub.w, collisions, widgetBg: cs.backgroundColor, widgetDisplay: cs.display }
  })
  out.push({ w, ...r })
  await page.close()
}
console.log(JSON.stringify(out, null, 1))
await browser.close()

import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(process.env.SHOT_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
console.log(JSON.stringify(await p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const c = e.getBoundingClientRect(); return { top: Math.round(c.top), bottom: Math.round(c.bottom), left: Math.round(c.left), right: Math.round(c.right) } }
  return { hero: r('#hero'), heroBg: r('.hero-bg'), canvas: r('#aurora'), nav: r('#nav'), htmlBg: getComputedStyle(document.documentElement).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor }
})))
await b.close()

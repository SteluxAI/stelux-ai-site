// Fourth probe: 320px nav overflow, Lenis autoRaf state, second 60fps loop identity. Read-only.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/runtime'
const browser = await chromium.launch()
const out = {}
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600)
  out.nav320 = await page.evaluate(() => { const nav = document.querySelector('#nav'), r = nav.getBoundingClientRect(); const cta = document.querySelector('#nav a.btn-glow').getBoundingClientRect(); return { innerWidth, navLeft: Math.round(r.left), navRight: Math.round(r.right), navW: Math.round(r.width), ctaDisplay: getComputedStyle(document.querySelector('#nav a.btn-glow')).display, ctaW: Math.round(cta.width), docScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, headerScrollWidth: document.querySelector('header').scrollWidth } })
  await page.screenshot({ path: `${OUT}/mobile-320-top.png`, clip: { x: 0, y: 0, width: 320, height: 120 } })
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    window.__rafSrc = {}
    const orf = window.requestAnimationFrame
    window.requestAnimationFrame = function (fn) { const k = fn.toString().slice(0, 90); window.__rafSrc[k] = (window.__rafSrc[k] || 0) + 1; return orf.call(window, fn) }
  })
  await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600)
  const a = await page.evaluate(() => JSON.parse(JSON.stringify(window.__rafSrc)))
  await page.waitForTimeout(1000)
  const b = await page.evaluate(() => JSON.parse(JSON.stringify(window.__rafSrc)))
  out.rafSources = Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - (a[k] || 0)]))
  out.lenis = await page.evaluate(() => { const l = window.__lenis; return { autoRaf: l.options && l.options.autoRaf, rafId: l.__rafID, keys: Object.keys(l).filter((k) => /raf|Raf/.test(k)), isSmooth: l.isSmooth } })
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe4.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

// Second probe: rAF loop attribution, tab-switch duplication, clean focus-visible tests, crest fraction. Read-only.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/runtime'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}

const INIT = () => {
  window.__raf = {}
  const orf = window.requestAnimationFrame
  window.requestAnimationFrame = function (fn) { const k = (fn.name || fn.toString().slice(0, 30)); window.__raf[k] = (window.__raf[k] || 0) + 1; return orf.call(window, fn) }
}
const rafSnapshot = async (page, ms = 1000) => {
  const a = await page.evaluate(() => JSON.parse(JSON.stringify(window.__raf)))
  await page.waitForTimeout(ms)
  const b = await page.evaluate(() => JSON.parse(JSON.stringify(window.__raf)))
  const d = {}
  for (const k of Object.keys(b)) d[k] = b[k] - (a[k] || 0)
  return d
}
const scrollTo = async (page, y, wait = 500) => {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(wait)
}

async function make(vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.addInitScript(INIT)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { ctx, page }
}

{
  const { ctx, page } = await make({ width: 1440, height: 900 })
  const r = {}
  r.rafAtTop = await rafSnapshot(page)
  // slow scroll to bottom in 40 steps
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  for (let i = 1; i <= 40; i++) await scrollTo(page, Math.round(max * i / 40), 120)
  await page.waitForTimeout(800)
  r.rafAtBottomSlowScroll = await rafSnapshot(page)
  // jump straight back to top, then to bottom
  await scrollTo(page, 0, 600)
  r.rafBackAtTop = await rafSnapshot(page)
  await scrollTo(page, max, 900)
  r.rafAtBottomJump = await rafSnapshot(page)
  // realistic tab switch at bottom: hidden for 1.5s then visible
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(300)
  r.rafAtBottomAfterTabSwitch = await rafSnapshot(page)
  // now at top: tab switch while hero visible (rAF keeps running in headless, so simulate the frozen-callback case by dispatching visible only)
  await scrollTo(page, 0, 900)
  r.rafAtTopBefore = await rafSnapshot(page)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(50)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(300)
  r.rafAtTopAfterTabSwitch50ms = await rafSnapshot(page)
  await ctx.close()
  out.raf = r
}

{
  // clean focus-visible test on desktop: first Tab = nav logo link with utility rounded-full
  const { ctx, page } = await make({ width: 1440, height: 900 })
  await page.keyboard.press('Tab')
  out.focusDesktop = await page.evaluate(() => { const e = document.activeElement; return { el: e.tagName + ' ' + (e.getAttribute('aria-label') || ''), cls: e.className.slice(0, 60), fv: e.matches(':focus-visible'), borderRadius: getComputedStyle(e).borderRadius } })
  await page.screenshot({ path: `${OUT}/desktop-focus-logo.png`, clip: { x: 380, y: 0, width: 700, height: 90 } })
  // tab through the nav to Launch Platform and a dash-nav button
  const trail = []
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); trail.push(await page.evaluate(() => { const e = document.activeElement; return { el: (e.textContent.trim().slice(0, 16) || e.tagName), br: getComputedStyle(e).borderRadius, fv: e.matches(':focus-visible') } })) }
  out.focusTrailDesktop = trail
  await ctx.close()
}
{
  const { ctx, page } = await make({ width: 375, height: 812 }, { isMobile: true })
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  out.focusMobileMenuBtn = await page.evaluate(() => { const e = document.activeElement; return { el: e.tagName + '#' + e.id, fv: e.matches(':focus-visible'), borderRadius: getComputedStyle(e).borderRadius, w: e.getBoundingClientRect().width } })
  await page.screenshot({ path: `${OUT}/mobile-focus-menu-btn.png`, clip: { x: 0, y: 0, width: 375, height: 90 } })
  // sky canvas zoom at mobile
  await page.screenshot({ path: `${OUT}/mobile-sky-zoom.png`, clip: { x: 0, y: 0, width: 375, height: 420 } })
  // crest fraction in image vs --crest
  out.crest = await page.evaluate(async () => {
    const img = document.querySelector('.hills'); await img.decode().catch(() => {})
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let minY = Infinity, minX = -1
    for (let x = 0; x < c.width; x += 4) { for (let y = 0; y < c.height; y++) { if (d[(y * c.width + x) * 4 + 3] > 128) { if (y < minY) { minY = y; minX = x }; break } } }
    // crest within the central 100vw band on mobile (image is 170vw wide, centered): x in [0.206, 0.794] of width
    let minYc = Infinity
    for (let x = Math.round(c.width * 0.206); x < c.width * 0.794; x += 4) { for (let y = 0; y < c.height; y++) { if (d[(y * c.width + x) * 4 + 3] > 128) { if (y < minYc) minYc = y; break } } }
    const cs = getComputedStyle(document.documentElement)
    return { imgCrestFracOfWidth: +(minY / c.width).toFixed(4), crestX: minX / c.width, imgCrestFracCentralBand: +(minYc / c.width).toFixed(4), cssCrestDesktopVw: 27.2, cssCrestMobileVw: parseFloat(cs.getPropertyValue('--crest')), impliedDesktop: +(minY / c.width * 100).toFixed(2), impliedMobile: +(minY / c.width * 170).toFixed(2), impliedMobileCentral: +(minYc / c.width * 170).toFixed(2) }
  })
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe2.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

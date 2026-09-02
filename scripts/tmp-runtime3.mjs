// Third probe: nav CTA visibility at 375, menu-btn focus ring, sky loop duplication, mobile menu-link scroll accuracy. Read-only.
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
async function make(vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile, reducedMotion: opts.rm || 'no-preference' })
  const page = await ctx.newPage()
  await page.addInitScript(INIT)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { ctx, page }
}

{
  const { ctx, page } = await make({ width: 1440, height: 900 })
  // synchronous hidden->visible toggle while hero visible (mirrors: rAF callback frozen while hidden, resumes after visibilitychange)
  out.rafTopBefore = await rafSnapshot(page)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(200)
  out.rafTopAfterSyncToggle = await rafSnapshot(page)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(200)
  out.rafTopAfterSecondToggle = await rafSnapshot(page)
  await ctx.close()
}
{
  const { ctx, page } = await make({ width: 375, height: 812 }, { isMobile: true })
  out.navCtaAt375 = await page.evaluate(() => { const a = document.querySelector('#nav a.btn-glow'); const cs = getComputedStyle(a); return { cls: a.className, display: cs.display, w: a.getBoundingClientRect().width, innerWidth, mqSm: matchMedia('(min-width: 640px)').matches } })
  // find CSS rules for .hidden and sm:inline-flex in the bundle
  out.cssRules = await page.evaluate(() => { const hits = []; for (const ss of document.styleSheets) { try { const walk = (rules, media) => { for (const r of rules) { if (r.cssRules && r.media) walk(r.cssRules, r.media.mediaText); else if (r.cssRules) walk(r.cssRules, media); else if (r.selectorText && /^\.hidden$|sm\\:inline-flex|\[hidden\]/.test(r.selectorText)) hits.push({ sel: r.selectorText, css: r.style.cssText.slice(0, 80), media, layer: r.parentRule && r.parentRule.name }) } }; walk(ss.cssRules) } catch (e) { hits.push({ err: String(e) }) } } return hits })
  // focus-visible on hamburger
  let found = false
  for (let i = 0; i < 6 && !found; i++) { await page.keyboard.press('Tab'); found = await page.evaluate(() => document.activeElement.id === 'menu-btn') }
  out.focusMenuBtn = await page.evaluate(() => { const e = document.activeElement; return { el: e.tagName + '#' + e.id, fv: e.matches(':focus-visible'), borderRadius: getComputedStyle(e).borderRadius, outline: getComputedStyle(e).outline } })
  await page.screenshot({ path: `${OUT}/mobile-focus-menu-btn.png`, clip: { x: 200, y: 0, width: 175, height: 90 } })
  // menu link scroll accuracy: from y=600, open menu, tap Pricing, sample scrollY
  await page.evaluate(() => { window.__lenis.scrollTo(600, { immediate: true, force: true }); window.scrollTo(0, 600) }); await page.waitForTimeout(600)
  const pricingDocTop = await page.evaluate(() => document.querySelector('#pricing').getBoundingClientRect().top + scrollY)
  await page.click('#menu-btn'); await page.waitForTimeout(300)
  await page.click('#mobile-menu a[href="#pricing"]')
  const samples = []
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(300); samples.push(await page.evaluate(() => ({ y: Math.round(scrollY), pricingTop: Math.round(document.querySelector('#pricing').getBoundingClientRect().top), lenisTarget: window.__lenis.targetScroll && Math.round(window.__lenis.targetScroll), stopped: window.__lenis.isStopped }))) }
  out.menuPricing = { pricingDocTop: Math.round(pricingDocTop), expectedY: Math.round(pricingDocTop - 96), samples }
  // same link without the menu (hero "Launch Platform" -> #pricing)
  await page.evaluate(() => { window.__lenis.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0) }); await page.waitForTimeout(600)
  await page.click('.hero-copy a[href="#pricing"]'); await page.waitForTimeout(2500)
  out.heroPricing = await page.evaluate(() => ({ y: Math.round(scrollY), pricingTop: Math.round(document.querySelector('#pricing').getBoundingClientRect().top) }))
  // products link from the menu
  await page.evaluate(() => { window.__lenis.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0) }); await page.waitForTimeout(600)
  await page.click('#menu-btn'); await page.waitForTimeout(300)
  await page.click('#mobile-menu a[href="#products"]'); await page.waitForTimeout(2500)
  out.menuProducts = await page.evaluate(() => ({ y: Math.round(scrollY), productsTop: Math.round(document.querySelector('#products').getBoundingClientRect().top) }))
  await page.screenshot({ path: `${OUT}/mobile-after-menu-products.png` })
  await ctx.close()
}
{
  // reduced motion: scrollIntoView lands the target under the fixed nav?
  const { ctx, page } = await make({ width: 1440, height: 900 }, { rm: 'reduce' })
  await page.click('nav a[href="#pricing"]'); await page.waitForTimeout(1200)
  out.reducedNavPricing = await page.evaluate(() => ({ y: Math.round(scrollY), pricingTop: Math.round(document.querySelector('#pricing').getBoundingClientRect().top), navBottom: Math.round(document.querySelector('#nav').getBoundingClientRect().bottom), scrollMarginTop: getComputedStyle(document.querySelector('#pricing')).scrollMarginTop }))
  await page.click('nav a[href="#agents"]'); await page.waitForTimeout(1200)
  out.reducedNavAgents = await page.evaluate(() => ({ y: Math.round(scrollY), agentsTop: Math.round(document.querySelector('#agents').getBoundingClientRect().top), indexTop: Math.round(document.querySelector('#agents .card-index').getBoundingClientRect().top), navBottom: Math.round(document.querySelector('#nav').getBoundingClientRect().bottom) }))
  await page.screenshot({ path: `${OUT}/desktop-reduced-nav-agents.png` })
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe3.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

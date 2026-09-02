// Runtime-correctness probe (read-only). Run: node scripts/tmp-runtime.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/runtime'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}

const INIT = () => {
  window.__intervals = []
  const oi = window.setInterval, oc = window.clearInterval
  window.setInterval = function (fn, ms, ...a) { const id = oi.call(window, fn, ms, ...a); window.__intervals.push({ id, ms, alive: true, src: (fn && fn.toString().slice(0, 60)) }); return id }
  window.clearInterval = function (id) { const r = window.__intervals.find((i) => i.id === id); if (r) r.alive = false; return oc.call(window, id) }
  window.__rafCount = 0
  const orf = window.requestAnimationFrame
  window.requestAnimationFrame = function (fn) { window.__rafCount++; return orf.call(window, fn) }
}

async function newPage(vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: vp, deviceScaleFactor: 1, isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile,
    reducedMotion: opts.rm || 'no-preference',
  })
  const page = await ctx.newPage()
  const logs = []
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()) })
  page.on('requestfailed', (r) => logs.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)))
  page.on('response', (r) => { if (r.status() >= 400) logs.push('http ' + r.status() + ' ' + r.url()) })
  await page.addInitScript(INIT)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  return { ctx, page, logs }
}

const scrollTo = async (page, y, wait = 700) => {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(wait)
}

async function fullScroll(page) {
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  for (let i = 0; i <= 20; i++) await scrollTo(page, Math.round(max * i / 20), 350)
  return max
}

const imgInfo = () => Array.from(document.images).map((i) => {
  const r = i.getBoundingClientRect()
  return { src: i.currentSrc.split('/').pop(), complete: i.complete, nw: i.naturalWidth, nh: i.naturalHeight, w: +r.width.toFixed(1), h: +r.height.toFixed(1), left: +r.left.toFixed(1), cssWidth: getComputedStyle(i).width, vw: innerWidth, ratioW: +(r.width / innerWidth).toFixed(3) }
})

const horizonInfo = () => {
  const cs = getComputedStyle(document.documentElement)
  const hw = document.querySelector('.hills-wrap'), c = document.querySelector('#aurora'), hero = document.querySelector('#hero'), hills = document.querySelector('.hills'), fg = document.querySelector('.hero-fg'), fgImg = document.querySelector('.hero-fg img')
  const hr = hero.getBoundingClientRect(), hwr = hw.getBoundingClientRect(), cr = c.getBoundingClientRect(), fr = fg.getBoundingClientRect(), fir = fgImg.getBoundingClientRect()
  const crest = parseFloat(cs.getPropertyValue('--crest'))
  const crestPx = crest / 100 * innerWidth
  const jsHz = Math.min(0.98, Math.max(0.2, (hw.offsetTop + crestPx) / (c.clientHeight || 1)))
  return {
    vars: { crest: cs.getPropertyValue('--crest').trim(), horizon: cs.getPropertyValue('--horizon').trim(), hillsH: cs.getPropertyValue('--hills-h').trim(), folH: cs.getPropertyValue('--fol-h').trim(), fgH: cs.getPropertyValue('--fg-h').trim(), overlap: cs.getPropertyValue('--overlap').trim() },
    innerWidth, clientWidth: document.documentElement.clientWidth, innerHeight,
    heroH: +hr.height.toFixed(1), heroTop: +hr.top.toFixed(1),
    hillsWrapTopInHero: +(hwr.top - hr.top).toFixed(1), hillsOffsetTop: hw.offsetTop, hillsWrapH: +hwr.height.toFixed(1),
    hillsImgTopInHero: +(hills.getBoundingClientRect().top - hr.top).toFixed(1), hillsImgW: +hills.getBoundingClientRect().width.toFixed(1), hillsImgH: +hills.getBoundingClientRect().height.toFixed(1),
    crestPxJs: +crestPx.toFixed(1), crestYInHero: +(hwr.top - hr.top + crestPx).toFixed(1),
    canvasClientH: c.clientHeight, canvasBackingW: c.width, canvasBackingH: c.height, jsHorizonFrac: +jsHz.toFixed(4), jsHorizonPx: +(jsHz * c.clientHeight).toFixed(1),
    fgTopInHero: +(fr.top - hr.top).toFixed(1), fgW: +fr.width.toFixed(1), fgImgW: +fir.width.toFixed(1), fgImgH: +fir.height.toFixed(1), fgImgLeft: +fir.left.toFixed(1),
    heroContentPadBottom: getComputedStyle(document.querySelector('.hero-content')).paddingBottom,
    terminalBottomInHero: +(document.querySelector('#terminal').getBoundingClientRect().bottom - hr.top).toFixed(1),
  }
}

// sample bottom-row color of an image vs the CSS fill color used below it
const seamInfo = async (page) => page.evaluate(async () => {
  const samp = async (sel) => {
    const img = document.querySelector(sel)
    await img.decode().catch(() => {})
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const row = (y) => { const d = ctx.getImageData(0, y, c.width, 1).data; let r = 0, g = 0, b = 0, a = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; n++ } return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), a: Math.round(a / n) } }
    const col = (x) => { const d = ctx.getImageData(x, 0, 1, c.height).data; let firstOpaque = -1; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 128) { firstOpaque = i / 4; break } } return firstOpaque }
    // find the highest opaque pixel across the width (the crest)
    let minY = Infinity, minX = -1
    for (let x = 0; x < c.width; x += 8) { const y = col(x); if (y >= 0 && y < minY) { minY = y; minX = x } }
    return { bottomRow: row(c.height - 1), bottomRow5: row(c.height - 5), topRow: row(0), crestY: minY, crestX: minX, crestFrac: +(minY / c.width).toFixed(4), nw: c.width, nh: c.height }
  }
  return { hills: await samp('.hills'), foliage: await samp('.hero-fg img') }
})

async function desktop() {
  const { ctx, page, logs } = await newPage({ width: 1440, height: 900 })
  const r = {}
  r.images = await page.evaluate(imgInfo)
  r.horizon = await page.evaluate(horizonInfo)
  r.seam = await seamInfo(page)
  r.lenis = await page.evaluate(() => !!window.__lenis)
  // sticky offsetTop behaviour
  const max = await fullScroll(page)
  r.scrollMax = max
  r.intervalsAfterFullScroll = await page.evaluate(() => window.__intervals.map((i) => ({ ms: i.ms, alive: i.alive, src: i.src })))
  // is the sim stopped when terminal off-screen?
  r.simIntervalAliveAtBottom = await page.evaluate(() => window.__intervals.filter((i) => i.ms === 1600 && i.alive).length)
  // rAF rate at bottom (sky loop should be stopped)
  const raf0 = await page.evaluate(() => window.__rafCount); await page.waitForTimeout(1000); const raf1 = await page.evaluate(() => window.__rafCount)
  r.rafPerSecAtBottom = raf1 - raf0
  // simulate tab hide/show while at bottom -> does sky loop restart?
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(300)
  const raf2 = await page.evaluate(() => window.__rafCount); await page.waitForTimeout(1000); const raf3 = await page.evaluate(() => window.__rafCount)
  r.rafPerSecAtBottomAfterTabSwitch = raf3 - raf2

  // anchor to sticky card from the bottom (footer "Agent Swarms")
  await scrollTo(page, max, 500)
  const before = await page.evaluate(() => ({ y: scrollY, agentsRectTop: document.querySelector('#agents').getBoundingClientRect().top, agentsOffsetTop: document.querySelector('#agents').offsetTop, dataOffsetTop: document.querySelector('#data').offsetTop, computeOffsetTop: document.querySelector('#compute').offsetTop, containerTop: document.querySelector('.stack-cards').getBoundingClientRect().top + scrollY }))
  await page.click('footer a[href="#agents"]')
  await page.waitForTimeout(2200)
  const after = await page.evaluate(() => {
    const a = document.querySelector('#agents'), c = document.querySelector('#compute'), d = document.querySelector('#data')
    const st = getComputedStyle(document.documentElement).getPropertyValue('--stack-top')
    return { y: scrollY, stackTop: st, agentsTop: +a.getBoundingClientRect().top.toFixed(1), agentsTransform: getComputedStyle(a).transform, agentsFilter: getComputedStyle(a).filter, dataTop: +d.getBoundingClientRect().top.toFixed(1), computeTop: +c.getBoundingClientRect().top.toFixed(1), computeCoversAgents: c.getBoundingClientRect().top < a.getBoundingClientRect().top + 60, hash: location.hash }
  })
  r.footerAgentsLink = { before, after }
  await page.screenshot({ path: `${OUT}/desktop-after-footer-agents-link.png` })

  // from the compute card (stacked state) click nav "Agents"
  await scrollTo(page, max, 300)
  await page.evaluate(() => document.querySelector('nav a[href="#compute"]').click()); await page.waitForTimeout(2200)
  const atCompute = await page.evaluate(() => ({ y: scrollY, computeTop: +document.querySelector('#compute').getBoundingClientRect().top.toFixed(1), agentsTop: +document.querySelector('#agents').getBoundingClientRect().top.toFixed(1) }))
  await page.evaluate(() => document.querySelector('nav a[href="#agents"]').click()); await page.waitForTimeout(2200)
  const atAgents = await page.evaluate(() => ({ y: scrollY, agentsTop: +document.querySelector('#agents').getBoundingClientRect().top.toFixed(1), agentsScale: getComputedStyle(document.querySelector('#agents')).transform, computeTop: +document.querySelector('#compute').getBoundingClientRect().top.toFixed(1) }))
  r.navComputeThenAgents = { atCompute, atAgents }
  await page.screenshot({ path: `${OUT}/desktop-after-nav-agents-from-compute.png` })
  // natural position of #agents for reference (from top)
  await scrollTo(page, 0, 300)
  r.agentsNaturalDocTop = await page.evaluate(() => document.querySelector('#agents').getBoundingClientRect().top + scrollY)
  await page.evaluate(() => document.querySelector('nav a[href="#agents"]').click()); await page.waitForTimeout(2200)
  r.navAgentsFromTop = await page.evaluate(() => ({ y: scrollY, agentsTop: +document.querySelector('#agents').getBoundingClientRect().top.toFixed(1) }))

  // focus-visible border radius on nav logo link (rounded-full utility)
  await scrollTo(page, 0, 300)
  await page.keyboard.press('Tab')
  r.focusFirst = await page.evaluate(() => { const e = document.activeElement; return { el: e.tagName + (e.id ? '#' + e.id : '') + ' ' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20)), fv: e.matches(':focus-visible'), br: getComputedStyle(e).borderRadius, outline: getComputedStyle(e).outlineStyle } })
  // sky canvas resize behaviour
  const hz1 = await page.evaluate(() => { const c = document.querySelector('#aurora'); return { w: c.width, h: c.height } })
  await page.setViewportSize({ width: 1100, height: 700 }); await page.waitForTimeout(500)
  const hz2 = await page.evaluate(horizonInfo)
  const c2 = await page.evaluate(() => { const c = document.querySelector('#aurora'); return { w: c.width, h: c.height } })
  r.resize = { before: hz1, after: c2, afterHorizon: { crestYInHero: hz2.crestYInHero, jsHorizonPx: hz2.jsHorizonPx, heroH: hz2.heroH } }
  r.logs = logs
  out.desktop = r
  await ctx.close()
}

async function mobile() {
  const { ctx, page, logs } = await newPage({ width: 375, height: 812 }, { isMobile: true })
  const r = {}
  r.images = await page.evaluate(imgInfo)
  r.horizon = await page.evaluate(horizonInfo)
  r.docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  await page.screenshot({ path: `${OUT}/mobile-top.png` })
  const max = await fullScroll(page)
  r.scrollMax = max
  r.intervalsAfterFullScroll = await page.evaluate(() => window.__intervals.map((i) => ({ ms: i.ms, alive: i.alive, src: i.src })))
  // mobile menu scroll lock
  await scrollTo(page, 600, 300)
  await page.click('#menu-btn'); await page.waitForTimeout(300)
  r.menuOpen = await page.evaluate(() => ({ hidden: document.querySelector('#mobile-menu').hidden, htmlOverflow: document.documentElement.style.overflow, lenisStopped: document.documentElement.classList.contains('lenis-stopped'), expanded: document.querySelector('#menu-btn').getAttribute('aria-expanded'), active: document.activeElement.id, mainInert: document.querySelector('main').inert, menuContentH: document.querySelector('#mobile-menu > div').scrollHeight, vh: innerHeight }))
  await page.screenshot({ path: `${OUT}/mobile-menu-open.png` })
  // tab past the last menu link: does focus escape into the page behind?
  const focusTrail = []
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); focusTrail.push(await page.evaluate(() => { const e = document.activeElement; return (e.closest('#mobile-menu') ? 'menu:' : e.closest('header') ? 'header:' : 'PAGE:') + (e.textContent.trim().slice(0, 18) || e.id || e.tagName) })) }
  r.menuFocusTrail = focusTrail
  await page.keyboard.press('Escape'); await page.waitForTimeout(200)
  r.menuAfterEsc = await page.evaluate(() => ({ hidden: document.querySelector('#mobile-menu').hidden, htmlOverflow: document.documentElement.style.overflow, expanded: document.querySelector('#menu-btn').getAttribute('aria-expanded'), active: document.activeElement.tagName + '#' + document.activeElement.id }))
  // menu link click -> scroll target
  await page.click('#menu-btn'); await page.waitForTimeout(200)
  await page.click('#mobile-menu a[href="#pricing"]'); await page.waitForTimeout(2000)
  r.menuLinkPricing = await page.evaluate(() => ({ menuHidden: document.querySelector('#mobile-menu').hidden, y: scrollY, pricingTop: +document.querySelector('#pricing').getBoundingClientRect().top.toFixed(1), htmlOverflow: document.documentElement.style.overflow }))
  // focus-visible radius on hamburger
  await scrollTo(page, 0, 300)
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  r.focusMenuBtn = await page.evaluate(() => { const e = document.activeElement; return { el: e.tagName + '#' + e.id, fv: e.matches(':focus-visible'), br: getComputedStyle(e).borderRadius } })
  await page.screenshot({ path: `${OUT}/mobile-focus-menu-btn.png`, clip: { x: 0, y: 0, width: 375, height: 90 } })
  r.logs = logs
  out.mobile = r
  await ctx.close()

  // landscape phone: does the menu fit / can it scroll?
  const l = await newPage({ width: 667, height: 375 }, { isMobile: true })
  await l.page.click('#menu-btn'); await l.page.waitForTimeout(300)
  out.landscapeMenu = await l.page.evaluate(() => { const m = document.querySelector('#mobile-menu'), inner = m.firstElementChild; const cta = document.querySelector('#mobile-menu .btn-glow').getBoundingClientRect(); return { vh: innerHeight, contentH: inner.scrollHeight, clientH: inner.clientHeight, overflowY: getComputedStyle(inner).overflowY, menuOverflowY: getComputedStyle(m).overflowY, ctaTop: +cta.top.toFixed(0), ctaBottom: +cta.bottom.toFixed(0), ctaVisible: cta.bottom <= innerHeight } })
  await l.page.screenshot({ path: `${OUT}/landscape-menu-open.png` })
  out.landscapeLogs = l.logs
  await l.ctx.close()
}

async function reduced() {
  const { ctx, page, logs } = await newPage({ width: 1440, height: 900 }, { rm: 'reduce' })
  const r = {}
  r.lenis = await page.evaluate(() => !!window.__lenis)
  r.skyDrawn = await page.evaluate(() => { const c = document.querySelector('#aurora'); const d = c.getContext('2d').getImageData(0, c.height - 1, 1, 1).data; return Array.from(d) })
  r.svgAnimRunning = await page.evaluate(() => Array.from(document.querySelectorAll('.card-visual svg')).map((s) => !s.animationsPaused()))
  r.smilCount = await page.evaluate(() => document.querySelectorAll('animateMotion, animate').length)
  const max = await fullScroll(page)
  r.intervals = await page.evaluate(() => window.__intervals.map((i) => ({ ms: i.ms, alive: i.alive })))
  r.counters = await page.evaluate(() => Array.from(document.querySelectorAll('[data-count]')).map((e) => e.textContent))
  r.heroTransforms = await page.evaluate(() => ({ bg: getComputedStyle(document.querySelector('.hero-bg')).transform, fg: getComputedStyle(document.querySelector('.hero-fg')).transform }))
  r.revealOpacity = await page.evaluate(() => Array.from(document.querySelectorAll('[data-reveal]')).map((e) => getComputedStyle(e).opacity))
  // anchor nav under reduced motion (scrollIntoView path) from bottom
  await scrollTo(page, max, 300)
  await page.click('footer a[href="#agents"]'); await page.waitForTimeout(1500)
  r.footerAgentsLink = await page.evaluate(() => ({ y: scrollY, agentsTop: +document.querySelector('#agents').getBoundingClientRect().top.toFixed(1), computeTop: +document.querySelector('#compute').getBoundingClientRect().top.toFixed(1), agentsTransform: getComputedStyle(document.querySelector('#agents')).transform }))
  r.logs = logs
  out.reduced = r
  await ctx.close()
}

await desktop()
await mobile()
await reduced()
await browser.close()
fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

// Compliance probe: parallax ratios, dashboard interactivity, stack cards, showcase, counters.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/compliance'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}

async function setScroll(page, y) {
  await page.evaluate((y) => {
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true })
    window.scrollTo(0, y)
  }, y)
  await page.waitForTimeout(700)
}
const ty = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return { ty: m.m42, tx: m.m41, scale: m.a, top: el.getBoundingClientRect().top, h: el.getBoundingClientRect().height, filter: getComputedStyle(el).filter }
}, sel)

/* ---------------- desktop ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // nav
  out.nav = await page.evaluate(() => {
    const header = document.querySelector('header'); const nav = document.querySelector('#nav')
    const cs = getComputedStyle(nav); const hcs = getComputedStyle(header)
    const cta = nav.querySelector('.btn-glow')
    return { headerPos: hcs.position, headerZ: hcs.zIndex, radius: cs.borderRadius, backdrop: cs.backdropFilter || cs.webkitBackdropFilter, bg: cs.backgroundColor, border: cs.borderColor, ctaText: cta?.textContent.trim(), ctaShadow: getComputedStyle(cta).boxShadow.slice(0, 160), ctaVisible: !!cta && getComputedStyle(cta).display !== 'none' }
  })

  // hero geometry + parallax
  const heroH = await page.evaluate(() => document.querySelector('#hero').offsetHeight)
  out.heroH = heroH
  out.parallax = []
  for (const y of [0, 100, 300, 500, 700, Math.round(heroH * 0.5), Math.round(heroH * 0.9), heroH]) {
    await setScroll(page, y)
    const bg = await ty(page, '.hero-bg'), fg = await ty(page, '.hero-fg'), copy = await ty(page, '.hero-copy'), term = await ty(page, '#terminal')
    out.parallax.push({ y, bgTy: +bg.ty.toFixed(1), bgRatio: y ? +(bg.ty / y).toFixed(3) : null, fgTy: +fg.ty.toFixed(1), fgRatio: y ? +(fg.ty / y).toFixed(3) : null, copyTy: +copy.ty.toFixed(1), termTy: +term.ty.toFixed(1), termTop: Math.round(term.top) })
  }
  await setScroll(page, 0)

  // hero layer geometry at rest
  out.heroGeom = await page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) } }
    const z = (s) => getComputedStyles(s)
    function getComputedStyles(s) { const c = getComputedStyle(document.querySelector(s)); return { z: c.zIndex, pos: c.position, overflow: c.overflow } }
    return { hero: r('#hero'), bg: { ...r('.hero-bg'), ...z('.hero-bg') }, hills: r('.hills-wrap'), hillsImg: r('.hills'), fg: { ...r('.hero-fg'), ...z('.hero-fg') }, fgImg: r('.hero-fg img'), term: r('#terminal'), copy: r('.hero-copy'), fade: r('.hero-fade'), vh: innerHeight }
  })

  // dashboard interactivity: click each sidebar item, read title/sub
  out.dashViews = []
  for (const v of ['overview', 'agents', 'tasks', 'data', 'compute', 'logs', 'products']) {
    await page.click(`.dash-nav[data-view="${v}"]`)
    await page.waitForTimeout(450)
    const r = await page.evaluate((v) => {
      const b = document.querySelector(`.dash-nav[data-view="${v}"]`)
      const main = document.querySelector('.dash-main')
      return { v, active: b.classList.contains('active'), title: document.querySelector('#dash-title').textContent, sub: document.querySelector('#dash-sub-text').textContent, mainHTMLHash: main.innerHTML.length, widgetsVisible: Array.from(document.querySelectorAll('.dash-widget')).map((w) => getComputedStyle(w).display) }
    }, v)
    out.dashViews.push(r)
  }
  await page.screenshot({ path: `${OUT}/desk-dash-products-view.png`, clip: { x: 200, y: 540, width: 1040, height: 360 } })
  // hover tilt
  const tb = await page.locator('#terminal').boundingBox()
  await page.mouse.move(tb.x + tb.width * 0.9, tb.y + tb.height * 0.2)
  await page.waitForTimeout(400)
  out.tilt = await page.evaluate(() => document.querySelector('.terminal-inner').style.transform)
  await page.mouse.move(5, 5)
  await page.waitForTimeout(400)

  // live simulation check
  const s1 = await page.evaluate(() => ({ ticker: document.querySelector('#dash-ticker').textContent, tasks: document.querySelector('#m-tasks').textContent, gpu: document.querySelector('#m-gpu').textContent }))
  await page.waitForTimeout(3600)
  const s2 = await page.evaluate(() => ({ ticker: document.querySelector('#dash-ticker').textContent, tasks: document.querySelector('#m-tasks').textContent, gpu: document.querySelector('#m-gpu').textContent }))
  out.sim = { s1, s2, changed: JSON.stringify(s1) !== JSON.stringify(s2) }

  // stacking cards
  const cardTops = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => ({ id: c.id, docTop: Math.round(c.getBoundingClientRect().top + scrollY), h: Math.round(c.offsetHeight), title: c.querySelector('.card-h3').textContent.trim(), pos: getComputedStyle(c).position, stickyTop: getComputedStyle(c).top })))
  out.cardsMeta = cardTops
  out.stack = []
  const c0 = cardTops[0].docTop
  const c2 = cardTops[2].docTop
  const probes = [c0 - 400, c0 - 88, c0 + 200, c0 + 500, cardTops[1].docTop - 300, cardTops[1].docTop - 106, cardTops[1].docTop + 100, c2 - 300, c2 - 124, c2 + 50, c2 + 400]
  for (const y of probes) {
    await setScroll(page, y)
    const r = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); const b = c.getBoundingClientRect(); return { scale: +m.a.toFixed(3), top: Math.round(b.top), bottom: Math.round(b.bottom), filter: getComputedStyle(c).filter } }))
    out.stack.push({ y, cards: r })
  }
  await setScroll(page, cardTops[1].docTop - 106 + 40)
  await page.screenshot({ path: `${OUT}/desk-stack-mid.png` })
  await setScroll(page, c2 - 124 + 20)
  await page.screenshot({ path: `${OUT}/desk-stack-end.png` })

  // showcase
  const sc = await page.evaluate(() => document.querySelector('#showcase').getBoundingClientRect().top + scrollY)
  await setScroll(page, sc - 40)
  await page.waitForTimeout(5500)
  out.showcase = {}
  out.showcase.autoRun = await page.evaluate(() => ({ status: document.querySelector('#run-status').textContent, resultHidden: document.querySelector('#run-result').hidden, done: document.querySelectorAll('#run-steps .step.done').length }))
  for (const t of ['py', 'rest', 'cli']) {
    await page.click(`.code-tab[data-tab="${t}"]`)
    await page.waitForTimeout(150)
    out.showcase['tab_' + t] = await page.evaluate((t) => ({ active: document.querySelector('.code.active')?.dataset.code, tabActive: document.querySelector('.code-tab.active')?.dataset.tab, codeW: document.querySelector('.code.active').scrollWidth, cw: document.querySelector('.code.active').clientWidth }), t)
  }
  await page.click('#copy-btn')
  await page.waitForTimeout(200)
  out.showcase.copyLabel = await page.evaluate(() => document.querySelector('#copy-btn').textContent)
  await page.click('#run-btn')
  await page.waitForTimeout(400)
  out.showcase.runStarted = await page.evaluate(() => ({ status: document.querySelector('#run-status').textContent, active: document.querySelectorAll('#run-steps .step.active').length, resultHidden: document.querySelector('#run-result').hidden }))
  await page.waitForTimeout(5500)
  out.showcase.runEnded = await page.evaluate(() => ({ status: document.querySelector('#run-status').textContent, done: document.querySelectorAll('#run-steps .step.done').length, resultHidden: document.querySelector('#run-result').hidden }))
  await page.screenshot({ path: `${OUT}/desk-showcase.png` })

  // telemetry
  const tel = await page.evaluate(() => document.querySelector('#telemetry').getBoundingClientRect().top + scrollY)
  // fresh page for counters to observe animation from 0
  const page2 = await ctx.newPage()
  await page2.goto(BASE, { waitUntil: 'networkidle' })
  await page2.waitForTimeout(800)
  await page2.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, tel - 40)
  const samples = []
  for (let i = 0; i < 6; i++) { await page2.waitForTimeout(400); samples.push(await page2.evaluate(() => Array.from(document.querySelectorAll('[data-count]')).map((e) => e.textContent))) }
  await page2.waitForTimeout(2500)
  samples.push(await page2.evaluate(() => Array.from(document.querySelectorAll('[data-count]')).map((e) => e.textContent)))
  out.counters = samples
  await page2.screenshot({ path: `${OUT}/desk-telemetry.png` })

  // pricing + footer
  out.pricing = await page.evaluate(() => ({ badge: document.querySelector('.price.featured .badge')?.textContent, featuredTier: document.querySelector('.price.featured > div')?.textContent, tiers: Array.from(document.querySelectorAll('.price > div:first-child, .price.featured > div:nth-child(2)')).map((d) => d.textContent) }))
  out.footer = await page.evaluate(() => ({ status: document.querySelector('footer .live-dot')?.parentElement.textContent.trim(), legal: Array.from(document.querySelectorAll('footer a.foot-link')).filter((a) => /Privacy|Terms|Security/.test(a.textContent)).map((a) => a.textContent + ' → ' + a.getAttribute('href')), columns: Array.from(document.querySelectorAll('footer .font-mono.uppercase')).map((d) => d.textContent) }))

  // theme tokens
  out.theme = await page.evaluate(() => ({ bodyBg: getComputedStyle(document.body).backgroundColor, glass: (() => { const g = document.querySelector('.glass'); const c = getComputedStyle(g); return { backdrop: c.backdropFilter, bg: c.backgroundColor, border: c.borderColor } })(), product: (() => { const c = getComputedStyle(document.querySelector('.product')); return { backdrop: c.backdropFilter, bg: c.backgroundColor } })() }))
  out.desktopErrors = errors
  await ctx.close()
}

/* ---------------- mobile ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  out.mobile = {}
  out.mobile.nav = await page.evaluate(() => { const cta = document.querySelector('#nav .btn-glow'); return { ctaDisplay: getComputedStyle(cta).display, links: Array.from(document.querySelectorAll('#nav ul')).map((u) => getComputedStyle(u).display) } })
  out.mobile.dash = await page.evaluate(() => ({ side: getComputedStyle(document.querySelector('.dash-side')).display, widgets: Array.from(document.querySelectorAll('.dash-widget')).map((w) => getComputedStyle(w).display), mainH: document.querySelector('.dash-main').offsetHeight, termTop: Math.round(document.querySelector('#terminal').getBoundingClientRect().top), heroH: document.querySelector('#hero').offsetHeight }))
  const heroH = out.mobile.dash.heroH
  out.mobile.parallax = []
  for (const y of [0, 200, 500, Math.round(heroH * 0.6)]) {
    await setScroll(page, y)
    const bg = await ty(page, '.hero-bg'), fg = await ty(page, '.hero-fg')
    out.mobile.parallax.push({ y, bgRatio: y ? +(bg.ty / y).toFixed(3) : null, fgRatio: y ? +(fg.ty / y).toFixed(3) : null })
  }
  await setScroll(page, 0)
  await page.screenshot({ path: `${OUT}/mob-hero-full.png`, fullPage: false })
  await setScroll(page, Math.round(heroH * 0.35))
  await page.screenshot({ path: `${OUT}/mob-hero-35.png` })
  out.mobile.cards = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => ({ pos: getComputedStyle(c).position, transform: getComputedStyle(c).transform })))
  // mobile menu
  await page.click('#menu-btn')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/mob-menu.png` })
  out.mobile.menu = await page.evaluate(() => ({ hidden: document.querySelector('#mobile-menu').hidden, links: Array.from(document.querySelectorAll('#mobile-menu nav a')).map((a) => a.textContent) }))
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

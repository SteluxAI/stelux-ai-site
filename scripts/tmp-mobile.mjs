import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = 'http://localhost:4173/'
const OUT = 'shots/mobile-custom'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

async function open(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.w < 900, hasTouch: vp.w < 900 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  return { ctx, page }
}
async function scrollTo(page, y) {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(900)
}
const rect = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, transform: cs.transform } }, sel)

// ---------- MOBILE 375x812 ----------
{
  const { ctx, page } = await open({ w: 375, h: 812 })
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const r = (s) => { const el = q(s); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width) } }
    const badge = q('.price.featured .badge')
    const lbl = badge.nextElementSibling
    return {
      heroH: q('#hero').offsetHeight,
      docH: document.documentElement.scrollHeight,
      hero: r('#hero'), heroContent: r('.hero-content'), terminal: r('#terminal'), dashMain: r('.dash-main'),
      avatar: r('.dash-avatar'), title: r('#dash-title'), sub: r('#dash-sub'), ticker: r('#dash-ticker'), cta: r('.dash-cta'),
      heroFg: r('.hero-fg'), heroFgImg: r('.hero-fg img'), hillsWrap: r('.hills-wrap'), hills: r('.hills'),
      navCta: { display: getComputedStyle(q('#nav a.btn-glow')).display, ...r('#nav a.btn-glow') },
      menuBtn: r('#menu-btn'), nav: r('#nav'),
      footerH: q('footer').offsetHeight, footerCols: getComputedStyle(q('footer .grid')).gridTemplateColumns,
      h1: { h: q('.hero-h1').offsetHeight, lh: getComputedStyle(q('.hero-h1')).lineHeight, fs: getComputedStyle(q('.hero-h1')).fontSize },
      products: r('#products'), platform: r('#platform'), showcase: r('#showcase'), telemetry: r('#telemetry'), pricing: r('#pricing'), footer: r('footer'),
      codePanel: Array.from(document.querySelectorAll('.code')).map((c) => ({ code: c.dataset.code, sw: c.scrollWidth, cw: c.clientWidth })),
      badge: r('.price.featured .badge'), badgeLabel: { top: Math.round(lbl.getBoundingClientRect().top + scrollY), bottom: Math.round(lbl.getBoundingClientRect().bottom + scrollY) }, featuredTop: r('.price.featured').top,
      cardVisualW: q('.card-visual').offsetWidth,
    }
  })
  console.log('MOBILE INFO', JSON.stringify(info))

  const crest = await page.evaluate(async () => {
    const img = document.querySelector('.hero-fg img')
    await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    const cols = []
    for (let x = 0; x < c.width; x += 8) {
      let y = 0
      for (; y < c.height; y++) { if (d[(y * c.width + x) * 4 + 3] > 128) break }
      cols.push(y)
    }
    const r = img.getBoundingClientRect()
    const scale = r.width / img.naturalWidth
    const x0 = Math.max(0, Math.round((0 - r.left) / scale)), x1 = Math.min(c.width, Math.round((375 - r.left) / scale))
    const vis = cols.slice(Math.floor(x0 / 8), Math.ceil(x1 / 8))
    const min = Math.min(...vis), avg = vis.reduce((a, b) => a + b, 0) / vis.length
    return { natural: [c.width, c.height], rendered: [Math.round(r.width), Math.round(r.height)], scale, imgLeft: Math.round(r.left), crestMinPx: Math.round(min * scale), crestAvgPx: Math.round(avg * scale) }
  })
  console.log('FOLIAGE CREST', JSON.stringify(crest))

  for (const s of [0, 80, 160, 240, 320, 400, 500]) {
    await scrollTo(page, s)
    const cta = await rect(page, '.dash-cta'), title = await rect(page, '#dash-title'), fg = await rect(page, '.hero-fg'), fgImg = await rect(page, '.hero-fg img'), fade = await rect(page, '.hero-fade')
    console.log('hero s=' + s + ': title[' + title.top + '..' + title.bottom + '] cta[' + cta.top + '..' + cta.bottom + '] fgTop=' + fg.top + ' fgImgTop=' + fgImg.top + ' crestMin=' + (fgImg.top + crest.crestMinPx) + ' crestAvg=' + (fgImg.top + crest.crestAvgPx) + ' fadeTop=' + fade.top)
    await page.screenshot({ path: OUT + '/m-hero-s' + s + '.png' })
  }

  await scrollTo(page, 0)
  const taps = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('a, button')) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (el.closest('[hidden]')) continue
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
      if (r.height < 40 || r.width < 40) out.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''), text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out
  })
  console.log('TAP TARGETS <40px (mobile):', taps.length); taps.forEach((t) => console.log('  ', JSON.stringify(t)))

  await page.click('#menu-btn')
  await page.waitForTimeout(500)
  const menu = await page.evaluate(() => {
    const m = document.querySelector('#mobile-menu')
    const links = Array.from(m.querySelectorAll('a')).map((a) => { const r = a.getBoundingClientRect(); return { t: a.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height) } })
    return { hidden: m.hidden, htmlOverflow: document.documentElement.style.overflow, links, menuH: m.offsetHeight, menuZ: getComputedStyle(m).zIndex, btnLabel: document.querySelector('#menu-btn').getAttribute('aria-label'), btnIcon: document.querySelector('#menu-btn svg').innerHTML.slice(0, 60) }
  })
  console.log('MENU', JSON.stringify(menu))
  await page.screenshot({ path: OUT + '/m-menu-open.png' })
  await page.click('#mobile-menu a[href="#pricing"]')
  await page.waitForTimeout(1600)
  console.log('after menu link click: menu hidden=', await page.evaluate(() => document.querySelector('#mobile-menu').hidden), 'scrollY=', await page.evaluate(() => Math.round(scrollY)), 'pricingTop=', (await rect(page, '#pricing')).top)
  await page.screenshot({ path: OUT + '/m-after-menu-nav.png' })

  await scrollTo(page, info.showcase.top + 250)
  await page.screenshot({ path: OUT + '/m-showcase.png' })
  await scrollTo(page, info.featuredTop - 80)
  await page.screenshot({ path: OUT + '/m-pricing-featured.png' })
  await scrollTo(page, info.footer.top - 40)
  await page.screenshot({ path: OUT + '/m-footer-top.png' })
  await scrollTo(page, info.products.top + 300)
  await page.screenshot({ path: OUT + '/m-products.png' })
  await page.setViewportSize({ width: 320, height: 568 })
  await page.waitForTimeout(800)
  await scrollTo(page, 0)
  const ov320 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, navR: Math.round(document.querySelector('#nav').getBoundingClientRect().right), ctaDisplay: getComputedStyle(document.querySelector('#nav a.btn-glow')).display }))
  console.log('320px', JSON.stringify(ov320))
  await page.screenshot({ path: OUT + '/m320-hero.png' })
  await ctx.close()
}

// ---------- TABLET 768x1024 and 1024x768 ----------
for (const vp of [{ w: 768, h: 1024, n: 't768' }, { w: 1024, h: 768, n: 'l1024' }]) {
  const { ctx, page } = await open(vp)
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const cards = Array.from(document.querySelectorAll('.stack-card')).map((c) => ({ id: c.id, h: c.offsetHeight, pos: getComputedStyle(c).position, top: getComputedStyle(c).top, inner: c.firstElementChild.offsetHeight, cols: getComputedStyle(c.firstElementChild).gridTemplateColumns }))
    const nav = q('#nav').getBoundingClientRect()
    return {
      docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, vh: innerHeight,
      cards, stackTop: getComputedStyle(document.documentElement).getPropertyValue('--stack-top'),
      nav: { left: Math.round(nav.left), right: Math.round(nav.right), w: Math.round(nav.width) },
      navLinks: Array.from(document.querySelectorAll('#nav .nav-link')).filter((a) => a.offsetParent).map((a) => a.textContent.trim()),
      menuBtn: getComputedStyle(q('#menu-btn')).display,
      side: getComputedStyle(q('.dash-side')).display, widgets: Array.from(document.querySelectorAll('.dash-widget')).map((w) => getComputedStyle(w).display),
      dashGrid: getComputedStyle(q('#terminal .grid')).gridTemplateColumns,
      footerCols: getComputedStyle(q('footer .grid')).gridTemplateColumns,
      priceCols: getComputedStyle(q('#pricing .grid')).gridTemplateColumns,
      statCols: getComputedStyle(q('#telemetry .grid')).gridTemplateColumns,
      showcaseCols: getComputedStyle(q('#showcase .glass')).gridTemplateColumns,
      hero: { h: q('#hero').offsetHeight, ctaBottom: Math.round(q('.dash-cta').getBoundingClientRect().bottom + scrollY), fgTop: Math.round(q('.hero-fg').getBoundingClientRect().top + scrollY) },
      pricingTop: Math.round(q('#pricing').getBoundingClientRect().top + scrollY), footerTop: Math.round(q('footer').getBoundingClientRect().top + scrollY), showcaseTop: Math.round(q('#showcase').getBoundingClientRect().top + scrollY),
    }
  })
  console.log(vp.n, 'INFO', JSON.stringify(info))
  await page.screenshot({ path: OUT + '/' + vp.n + '-hero.png' })
  const stackTop = parseFloat(info.stackTop) || 88
  const tops = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => Math.round(c.getBoundingClientRect().top + scrollY)))
  console.log(vp.n, 'card doc tops', tops)
  const spots = [
    { n: 'card1-pinned', y: tops[0] - stackTop },
    { n: 'card1-mid', y: tops[0] - stackTop + Math.round((tops[1] - tops[0]) / 2) },
    { n: 'card2-pinned', y: tops[1] - stackTop - 18 },
    { n: 'card3-pinned', y: tops[2] - stackTop - 36 },
    { n: 'card3-plus300', y: tops[2] - stackTop - 36 + 300 },
  ]
  for (const sp of spots) {
    await scrollTo(page, sp.y)
    const rects = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const r = c.getBoundingClientRect(); return { id: c.id, top: Math.round(r.top), bottom: Math.round(r.bottom), tf: getComputedStyle(c).transform } }))
    console.log(vp.n, sp.n, 'y=' + sp.y, JSON.stringify(rects))
    await page.screenshot({ path: OUT + '/' + vp.n + '-' + sp.n + '.png' })
  }
  for (const [n, y] of [['showcase', info.showcaseTop + 200], ['pricing', info.pricingTop + 150], ['footer', info.footerTop - 60]]) {
    await scrollTo(page, y)
    await page.screenshot({ path: OUT + '/' + vp.n + '-' + n + '.png' })
  }
  const taps = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('a, button')) {
      const cs = getComputedStyle(el); if (cs.display === 'none') continue
      if (el.closest('[hidden]')) continue
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
      if (r.height < 40) out.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''), text: (el.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out
  })
  console.log(vp.n, 'TAP <40h:', taps.length, JSON.stringify(taps.slice(0, 40)))
  await ctx.close()
}
await browser.close()

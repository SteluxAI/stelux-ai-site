import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/compliance'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}
async function setScroll(page, y) {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(700)
}
const rect = (page, sel) => page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) } }, sel)

async function open(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  return { ctx, page }
}

/* 1. tablet viewports: stack card heights vs viewport */
for (const vp of [{ w: 1024, h: 768, n: 'tab-land' }, { w: 768, h: 1024, n: 'tab-port' }, { w: 1280, h: 720, n: 'laptop720' }, { w: 1440, h: 900, n: 'desk' }]) {
  const { ctx, page } = await open(vp)
  const meta = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => ({ id: c.id, docTop: Math.round(c.getBoundingClientRect().top + scrollY), h: Math.round(c.offsetHeight), stickyTop: parseFloat(getComputedStyle(c).top) })))
  const containerBottom = await page.evaluate(() => { const s = document.querySelector('.stack-cards').getBoundingClientRect(); return Math.round(s.bottom + scrollY) })
  const res = { vp, meta, containerBottom, vh: vp.h }
  // for each card compute: when pinned at stickyTop, how much of the card is below the fold
  res.pinnedOverflow = meta.map((m) => ({ id: m.id, belowFold: m.stickyTop + m.h - vp.h }))
  // scroll to the point where card 2 first reaches its pin and screenshot
  const y1 = meta[1].docTop - meta[1].stickyTop
  await setScroll(page, y1 + 10)
  res.atCard2Pin = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const b = c.getBoundingClientRect(); const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); return { top: Math.round(b.top), bottom: Math.round(b.bottom), scale: +m.a.toFixed(3) } }))
  await page.screenshot({ path: `${OUT}/${vp.n}-stack-card2pin.png` })
  const y2 = meta[2].docTop - meta[2].stickyTop
  await setScroll(page, y2)
  res.atCard3Pin = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const b = c.getBoundingClientRect(); const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); return { top: Math.round(b.top), bottom: Math.round(b.bottom), scale: +m.a.toFixed(3) } }))
  await page.screenshot({ path: `${OUT}/${vp.n}-stack-card3pin.png` })
  // mid-way while card1 pinned and card2 halfway over it: is card1's bottom visible?
  await setScroll(page, meta[0].docTop - meta[0].stickyTop + 200)
  res.card1PinnedMid = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const b = c.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } }))
  await page.screenshot({ path: `${OUT}/${vp.n}-stack-card1pinned.png` })
  out[vp.n] = res
  await ctx.close()
}

/* 2. mobile: dashboard CTA occlusion by foliage */
{
  const { ctx, page } = await open({ w: 375, h: 812, mobile: true })
  out.mobileCta = []
  for (const y of [0, 60, 100, 130, 160, 200, 260, 320]) {
    await setScroll(page, y)
    const cta = await rect(page, '.dash-cta'), fg = await rect(page, '.hero-fg img'), term = await rect(page, '#terminal'), hero = await rect(page, '#hero')
    // sample whether foliage pixels are opaque over the CTA centre by checking the image's alpha at that row
    const alpha = await page.evaluate(([ctaTop, ctaBottom]) => {
      const img = document.querySelector('.hero-fg img'); const b = img.getBoundingClientRect()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d'); g.drawImage(img, 0, 0)
      const sy = img.naturalHeight / b.height, sx = img.naturalWidth / b.width
      const rows = []
      for (const vy of [ctaTop, (ctaTop + ctaBottom) / 2, ctaBottom]) {
        const iy = Math.round((vy - b.top) * sy)
        if (iy < 0 || iy >= img.naturalHeight) { rows.push(null); continue }
        // sample across the CTA's horizontal extent (x 30..345 viewport) and count opaque px
        let opaque = 0, n = 0
        for (let vx = 30; vx < 345; vx += 3) { const ix = Math.round((vx - b.left) * sx); if (ix < 0 || ix >= img.naturalWidth) continue; const a = g.getImageData(ix, iy, 1, 1).data[3]; n++; if (a > 128) opaque++ }
        rows.push(+(opaque / n).toFixed(2))
      }
      return rows
    }, [cta.top, cta.bottom])
    out.mobileCta.push({ y, cta: [cta.top, cta.bottom], fgImgTop: fg.top, termBottom: term.bottom, heroBottom: hero.bottom, opaqueFracAt_top_mid_bottom: alpha, ctaInViewport: cta.bottom <= 812 && cta.top >= 0 })
    await page.screenshot({ path: `${OUT}/mob-cta-${y}.png` })
  }
  // hero→products gap on mobile
  await setScroll(page, 623)
  out.mobileGap = { hero: await rect(page, '#hero'), productsSection: await rect(page, '#products'), eyebrow: await rect(page, '#products .eyebrow'), fgImg: await rect(page, '.hero-fg img'), fade: await rect(page, '.hero-fade') }
  await ctx.close()
}

/* 3. desktop: CTA occlusion + hero→products gap */
{
  const { ctx, page } = await open({ w: 1440, h: 900 })
  out.deskCta = []
  for (const y of [0, 80, 150, 220, 300]) {
    await setScroll(page, y)
    const cta = await rect(page, '.dash-cta'), fg = await rect(page, '.hero-fg img')
    const alpha = await page.evaluate(([ctaTop, ctaBottom]) => {
      const img = document.querySelector('.hero-fg img'); const b = img.getBoundingClientRect()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d'); g.drawImage(img, 0, 0)
      const sy = img.naturalHeight / b.height, sx = img.naturalWidth / b.width
      const rows = []
      for (const vy of [ctaTop, (ctaTop + ctaBottom) / 2, ctaBottom]) {
        const iy = Math.round((vy - b.top) * sy)
        if (iy < 0 || iy >= img.naturalHeight) { rows.push(null); continue }
        let opaque = 0, n = 0
        for (let vx = 550; vx < 1110; vx += 4) { const ix = Math.round((vx - b.left) * sx); if (ix < 0 || ix >= img.naturalWidth) continue; const a = g.getImageData(ix, iy, 1, 1).data[3]; n++; if (a > 128) opaque++ }
        rows.push(+(opaque / n).toFixed(2))
      }
      return rows
    }, [cta.top, cta.bottom])
    out.deskCta.push({ y, cta: [cta.top, cta.bottom], fgImgTop: fg.top, opaqueFracAt_top_mid_bottom: alpha, ctaInViewport: cta.bottom <= 900 && cta.top >= 0 })
  }
  await setScroll(page, 375)
  out.deskGap = { hero: await rect(page, '#hero'), productsSection: await rect(page, '#products'), eyebrow: await rect(page, '#products .eyebrow'), fgImg: await rect(page, '.hero-fg img'), fade: await rect(page, '.hero-fade') }
  // foliage image first opaque row (natural px) to understand visible silhouette start
  out.foliageInfo = await page.evaluate(() => {
    const img = document.querySelector('.hero-fg img'); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let first = -1, fullRow = -1
    for (let y = 0; y < c.height; y++) { let op = 0; for (let x = 0; x < c.width; x += 2) { if (d[(y * c.width + x) * 4 + 3] > 128) op++ } const f = op / (c.width / 2); if (first < 0 && f > 0.02) first = y; if (fullRow < 0 && f > 0.98) { fullRow = y; break } }
    return { natural: [c.width, c.height], firstOpaqueRow: first, fullyOpaqueRow: fullRow, firstOpaqueFrac: +(first / c.height).toFixed(3), fullyOpaqueFrac: +(fullRow / c.height).toFixed(3) }
  })
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe2.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-mobcta'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}
async function setScroll(page, y) {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(500)
}
const rect = (page, sel) => page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) } }, sel)

// alpha-map of foliage: per displayed-row opaque fraction across the CTA's horizontal extent
async function foliageOpaqueAtRows(page, ctaLeft, ctaRight, vys) {
  return page.evaluate(([l, r, vys]) => {
    const img = document.querySelector('.hero-fg img'); const b = img.getBoundingClientRect()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const sy = img.naturalHeight / b.height, sx = img.naturalWidth / b.width
    const d = g.getImageData(0, 0, c.width, c.height).data
    return vys.map((vy) => {
      const iy = Math.round((vy - b.top) * sy)
      if (iy < 0 || iy >= img.naturalHeight) return iy < 0 ? 0 : 1
      let op = 0, n = 0
      for (let vx = l; vx < r; vx += 2) { const ix = Math.round((vx - b.left) * sx); if (ix < 0 || ix >= img.naturalWidth) continue; n++; if (d[(iy * c.width + ix) * 4 + 3] > 96) op++ }
      return +(op / n).toFixed(2)
    })
  }, [ctaLeft, ctaRight, vys])
}

for (const vp of [
  { w: 375, h: 812, n: 'i13' },
  { w: 390, h: 844, n: 'i14' },
  { w: 375, h: 667, n: 'iSE' },
  { w: 360, h: 800, n: 'andr' },
  { w: 412, h: 915, n: 'pixel7' },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const rows = []
  let firstFullyVisible = null, firstOccluded = null, lastClear = null
  for (let y = 0; y <= 440; y += 20) {
    await setScroll(page, y)
    const cta = await rect(page, '.dash-cta'), term = await rect(page, '#terminal'), hero = await rect(page, '#hero'), fg = await rect(page, '.hero-fg img')
    const vys = []; for (let v = cta.top; v <= cta.bottom; v += 6) vys.push(v)
    const op = await foliageOpaqueAtRows(page, cta.left + 6, cta.right - 6, vys)
    const maxOp = Math.max(...op), meanOp = +(op.reduce((a, b) => a + b, 0) / op.length).toFixed(2)
    const inVp = cta.top >= 0 && cta.bottom <= vp.h
    if (inVp && firstFullyVisible === null) firstFullyVisible = y
    if (inVp && maxOp < 0.05) lastClear = y
    if (inVp && maxOp >= 0.05 && firstOccluded === null) firstOccluded = y
    rows.push({ y, cta: [cta.top, cta.bottom], ctaPctOfVh: [+(cta.top / vp.h).toFixed(2), +(cta.bottom / vp.h).toFixed(2)], termBottom: term.bottom, fgTop: fg.top, maxOp, meanOp, inVp })
  }
  out[vp.n] = { vp, heroH: (await rect(page, '#hero')).h, firstFullyVisible, lastClear, firstOccluded, rows }
  if (vp.n === 'i13') {
    for (const y of [0, 140, 240, 280, 300]) { await setScroll(page, y); await page.screenshot({ path: `${OUT}/i13-${y}.png` }) }
  }
  if (vp.n === 'iSE') {
    for (const y of [0, 120, 200]) { await setScroll(page, y); await page.screenshot({ path: `${OUT}/iSE-${y}.png` }) }
  }
  await ctx.close()
}
// desktop reference for the same metric
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
  const rows = []
  for (let y = 0; y <= 320; y += 20) {
    await setScroll(page, y)
    const cta = await rect(page, '.dash-cta')
    const vys = []; for (let v = cta.top; v <= cta.bottom; v += 6) vys.push(v)
    const op = await foliageOpaqueAtRows(page, cta.left + 6, cta.right - 6, vys)
    rows.push({ y, cta: [cta.top, cta.bottom], ctaPctOfVh: [+(cta.top / 900).toFixed(2), +(cta.bottom / 900).toFixed(2)], maxOp: Math.max(...op) })
  }
  out.desk = rows
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(out, null, 2))
for (const k of Object.keys(out)) {
  if (k === 'desk') { console.log('desk', out.desk.map((r) => `${r.y}:[${r.ctaPctOfVh}] op${r.maxOp}`).join('  ')); continue }
  const o = out[k]
  console.log(k, `heroH=${o.heroH} firstFullyVisible=${o.firstFullyVisible} lastClear=${o.lastClear} firstOccluded=${o.firstOccluded}`)
  console.log('   ', o.rows.filter((r) => r.inVp).map((r) => `${r.y}:[${r.ctaPctOfVh}] op${r.maxOp}`).join('  '))
}

import { chromium } from 'playwright'
const browser = await chromium.launch()
const OUT = 'shots/verify-fora-fidelity'

async function run(vp, tag, dsf) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // 1. geometry
  const geo = await page.evaluate(() => {
    const fg = document.querySelector('.hero-fg')
    const img = fg.querySelector('img')
    const r = fg.getBoundingClientRect(), ir = img.getBoundingClientRect()
    const cs = getComputedStyle(fg)
    return { fgTop: r.top, fgLeft: r.left, fgW: r.width, fgH: r.height, imgTop: ir.top, imgH: ir.height, imgW: ir.width, imgNatural: [img.naturalWidth, img.naturalHeight], zIndex: cs.zIndex, transform: cs.transform, src: img.currentSrc, scrollY }
  })
  console.log(tag, 'geometry', JSON.stringify(geo))

  // 2. independent alpha + RGB profile of foliage.webp raw decoded pixels
  const prof = await page.evaluate(async () => {
    const img = new Image(); img.src = '/assets/foliage.webp'; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
    const out = {}
    for (const y of [0, 1, 5, 10, 30, 60, 100, 130, 150, 170, 200, 250]) {
      const d = g.getImageData(0, y, c.width, 1).data
      let sumA = 0, maxA = 0, minA = 255, zero = 0, sumR = 0, sumG = 0, sumB = 0, n = d.length / 4
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; sumA += a; maxA = Math.max(maxA, a); minA = Math.min(minA, a); if (a === 0) zero++; sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2] }
      out['row' + y] = { meanA: +(sumA / n).toFixed(2), maxA, minA, pctZero: +(100 * zero / n).toFixed(1), meanRGB: [Math.round(sumR / n), Math.round(sumG / n), Math.round(sumB / n)] }
    }
    // also sample a few individual pixels in the "sky" area, mid-width, row 20
    const px = []
    for (const x of [10, 200, 500, 720, 1000, 1300]) { const d = g.getImageData(x, 20, 1, 1).data; px.push([x, 20, Array.from(d)]) }
    return { natural: [img.naturalWidth, img.naturalHeight], out, samplePixels: px }
  })
  console.log(tag, 'foliage.webp alpha profile', JSON.stringify(prof))

  // 3. Screenshot with fg shown and hidden, compare pixel rows around the seam
  const seamY = Math.round(geo.fgTop)
  const clipH = 120
  const clipY = seamY - 60
  const bufOn = await page.screenshot({ clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
  await page.screenshot({ path: `${OUT}/${tag}-seam-fgon.png`, clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
  await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = 'hidden' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${tag}-seam-fgoff.png`, clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
  const bufOff = await page.screenshot({ clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
  await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = '' })

  // Decode PNGs in browser and compute per-row mean luminance diff (on - off) 
  const diff = await page.evaluate(async ({ on, off, w, h, dsf }) => {
    async function decode(b64) {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
      return { g, w: c.width, h: c.height }
    }
    const A = await decode(on), B = await decode(off)
    const rows = []
    for (let y = 0; y < A.h; y++) {
      const da = A.g.getImageData(0, y, A.w, 1).data, db = B.g.getImageData(0, y, B.w, 1).data
      let s = 0, maxd = 0, n = A.w
      for (let i = 0; i < da.length; i += 4) {
        const la = 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2]
        const lb = 0.299 * db[i] + 0.587 * db[i + 1] + 0.114 * db[i + 2]
        const d = la - lb; s += d; maxd = Math.max(maxd, Math.abs(d))
      }
      rows.push({ y, cssY: +(y / dsf).toFixed(1), meanLumDiff: +(s / n).toFixed(2), maxAbsDiff: +maxd.toFixed(1) })
    }
    return rows
  }, { on: bufOn.toString('base64'), off: bufOff.toString('base64'), w: vp.width, h: clipH, dsf })
  // print a compact profile: every row near seam
  const near = diff.filter(r => Math.abs(r.cssY + clipY - seamY) <= 8)
  console.log(tag, 'seam CSS y =', seamY, ' rows near seam (cssY absolute, meanLumDiff on-off, maxAbsDiff):')
  for (const r of near) console.log('  ', (r.cssY + clipY).toFixed(1), r.meanLumDiff, r.maxAbsDiff)
  const above = diff.filter(r => r.cssY + clipY < seamY - 2)
  const below = diff.filter(r => r.cssY + clipY > seamY + 2 && r.cssY + clipY < seamY + 30)
  const avg = a => (a.reduce((s, r) => s + r.meanLumDiff, 0) / a.length).toFixed(2)
  console.log(tag, 'avg meanLumDiff above seam:', avg(above), ' below seam (2-30px):', avg(below))

  // 4. Zoom crops at 3x of the seam across specific regions
  const zc = await browser.newContext({ viewport: vp, deviceScaleFactor: 3 })
  const zp = await zc.newPage()
  await zp.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await zp.waitForTimeout(1500)
  if (tag === 'desktop') {
    await zp.screenshot({ path: `${OUT}/desktop-zoom-left-hills-sidebar.png`, clip: { x: 0, y: seamY - 40, width: 520, height: 80 } })
    await zp.screenshot({ path: `${OUT}/desktop-zoom-center-panel.png`, clip: { x: 520, y: seamY - 40, width: 420, height: 80 } })
    await zp.screenshot({ path: `${OUT}/desktop-zoom-right.png`, clip: { x: 940, y: seamY - 40, width: 500, height: 80 } })
    // full hero frame for context
    await zp.screenshot({ path: `${OUT}/desktop-hero-full.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } })
  } else {
    await zp.screenshot({ path: `${OUT}/mobile-zoom-seam.png`, clip: { x: 0, y: Math.max(0, seamY - 40), width: 375, height: 80 } })
    // scroll and re-measure
    for (const sy of [150, 300, 450]) {
      await zp.evaluate(y => window.scrollTo(0, y), sy)
      await zp.waitForTimeout(700)
      const g2 = await zp.evaluate(() => { const r = document.querySelector('.hero-fg').getBoundingClientRect(); const d = document.querySelector('.dash, [class*="dash"]'); return { fgTop: r.top, dashTop: d ? d.getBoundingClientRect().top : null, dashBottom: d ? d.getBoundingClientRect().bottom : null, scrollY } })
      console.log(tag, 'scroll', sy, JSON.stringify(g2))
      await zp.screenshot({ path: `${OUT}/mobile-scroll${sy}-zoom.png`, clip: { x: 0, y: Math.max(0, Math.round(g2.fgTop) - 40), width: 375, height: 80 } })
      await zp.screenshot({ path: `${OUT}/mobile-scroll${sy}-full.png` })
    }
  }
  await zc.close()
  await ctx.close()
}

await run({ width: 1440, height: 900 }, 'desktop', 2)
await run({ width: 375, height: 812 }, 'mobile', 2)
await browser.close()

import { chromium } from 'playwright'
const browser = await chromium.launch()
const OUT = 'shots/verify-fora-fidelity'

// helper: decode two PNG buffers in page and compute per-region abs diff stats at rows below vs above a seam
async function regionDiff(page, on, off, dsf, clipY, seamY, regions) {
  return page.evaluate(async ({ on, off, dsf, clipY, seamY, regions }) => {
    async function decode(b64) {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
      return { g, w: c.width, h: c.height }
    }
    const A = await decode(on), B = await decode(off)
    const res = {}
    for (const [name, x0, x1] of regions) {
      const px0 = Math.round(x0 * dsf), px1 = Math.round(x1 * dsf)
      const stat = { above: { sumAbs: 0, sumSigned: 0, n: 0, max: 0 }, below: { sumAbs: 0, sumSigned: 0, n: 0, max: 0 } }
      for (let y = 0; y < A.h; y++) {
        const cssY = clipY + y / dsf
        let bucket = null
        if (cssY < seamY - 2 && cssY > seamY - 30) bucket = stat.above
        else if (cssY > seamY + 2 && cssY < seamY + 30) bucket = stat.below
        if (!bucket) continue
        const da = A.g.getImageData(px0, y, px1 - px0, 1).data, db = B.g.getImageData(px0, y, px1 - px0, 1).data
        for (let i = 0; i < da.length; i += 4) {
          const la = 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2]
          const lb = 0.299 * db[i] + 0.587 * db[i + 1] + 0.114 * db[i + 2]
          const d = la - lb
          bucket.sumAbs += Math.abs(d); bucket.sumSigned += d; bucket.n++; bucket.max = Math.max(bucket.max, Math.abs(d))
        }
      }
      const lumRow = (yCss) => { const y = Math.round((yCss - clipY) * dsf); const d = A.g.getImageData(px0, y, px1 - px0, 1).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; return s / (d.length / 4) }
      res[name] = {
        aboveMeanAbs: +(stat.above.sumAbs / stat.above.n).toFixed(2), aboveMeanSigned: +(stat.above.sumSigned / stat.above.n).toFixed(2), aboveMax: +stat.above.max.toFixed(1),
        belowMeanAbs: +(stat.below.sumAbs / stat.below.n).toFixed(2), belowMeanSigned: +(stat.below.sumSigned / stat.below.n).toFixed(2), belowMax: +stat.below.max.toFixed(1),
        lumOn_seamMinus3: +lumRow(seamY - 3).toFixed(1), lumOn_seamPlus3: +lumRow(seamY + 3).toFixed(1),
      }
    }
    return res
  }, { on: on.toString('base64'), off: off.toString('base64'), dsf, clipY, seamY, regions })
}

// find first rows with alpha thresholds
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  const r = await page.evaluate(async () => {
    const img = new Image(); img.src = '/assets/foliage.webp'; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
    let first30 = null, first128 = null, first255 = null, firstMean50 = null
    for (let y = 0; y < c.height; y++) {
      const d = g.getImageData(0, y, c.width, 1).data
      let mx = 0, s = 0
      for (let i = 3; i < d.length; i += 4) { mx = Math.max(mx, d[i]); s += d[i] }
      if (first30 === null && mx > 30) first30 = y
      if (first128 === null && mx > 128) first128 = y
      if (first255 === null && mx >= 250) first255 = y
      if (firstMean50 === null && s / (d.length / 4) > 50) firstMean50 = y
    }
    return { h: c.height, first30, first128, first255, firstMean50, pct: { first30: +(100 * first30 / c.height).toFixed(1), first255: +(100 * first255 / c.height).toFixed(1) } }
  })
  console.log('foliage alpha thresholds', JSON.stringify(r))
  await ctx.close()
}

// DESKTOP region diff (dsf 2) + a dsf 1 crop for normal-DPR viewing
for (const dsf of [2, 1]) {
  const vp = { width: 1440, height: 900 }
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { document.querySelectorAll('*').forEach(e => { (e.getAnimations ? e.getAnimations() : []).forEach(a => a.pause()) }) })
  const geo = await page.evaluate(() => {
    const fg = document.querySelector('.hero-fg').getBoundingClientRect()
    const dash = document.querySelector('.dash')
    const side = document.querySelector('.dash-side')
    const cta = [...document.querySelectorAll('a')].find(e => /Launch Platform/.test(e.textContent) && e.getBoundingClientRect().top > 600)
    return { fgTop: fg.top, dash: dash && dash.getBoundingClientRect().toJSON(), side: side && side.getBoundingClientRect().toJSON(), cta: cta && cta.getBoundingClientRect().toJSON() }
  })
  console.log('desktop dsf' + dsf + ' geo', JSON.stringify(geo))
  const seamY = Math.round(geo.fgTop), clipY = seamY - 40, clipH = 80
  const on = await page.screenshot({ path: `${OUT}/desktop-dsf${dsf}-seam-fgon.png`, clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
  await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = 'hidden' })
  await page.waitForTimeout(200)
  const off = await page.screenshot({ path: `${OUT}/desktop-dsf${dsf}-seam-fgoff.png`, clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
  await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = '' })
  const regions = [['leftHills', 0, 190], ['sidebarBgOnly', 215, 232], ['sidebar', 215, 430], ['brightPanel', 440, 1210], ['ctaPill', 560, 1100], ['rightHills', 1240, 1440]]
  console.log('desktop dsf' + dsf + ' regionDiff', JSON.stringify(await regionDiff(page, on, off, dsf, clipY, seamY, regions), null, 1))
  await ctx.close()
}

// MOBILE: scrolled states
{
  const dsf = 3, vp = { width: 375, height: 812 }
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  for (const sy of [0, 150, 300, 450, 600]) {
    await page.evaluate(y => window.scrollTo(0, y), sy)
    await page.waitForTimeout(800)
    const g = await page.evaluate(() => {
      const fg = document.querySelector('.hero-fg').getBoundingClientRect()
      const dash = document.querySelector('.dash')
      const d = dash && dash.getBoundingClientRect()
      return { scrollY, fgTop: +fg.top.toFixed(1), dashTop: d && +d.top.toFixed(1), dashBottom: d && +d.bottom.toFixed(1) }
    })
    console.log('mobile scroll', sy, JSON.stringify(g))
    if (g.fgTop > 45 && g.fgTop < 770) {
      const seamY = Math.round(g.fgTop), clipY = seamY - 40, clipH = 80
      const on = await page.screenshot({ path: `${OUT}/mobile-s${sy}-seam-fgon.png`, clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
      await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = 'hidden' })
      await page.waitForTimeout(200)
      const off = await page.screenshot({ path: `${OUT}/mobile-s${sy}-seam-fgoff.png`, clip: { x: 0, y: clipY, width: vp.width, height: clipH } })
      await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = '' })
      console.log('mobile regionDiff s' + sy, JSON.stringify(await regionDiff(page, on, off, dsf, clipY, seamY, [['full', 0, 375]])))
    }
    await page.screenshot({ path: `${OUT}/mobile-s${sy}-full.png` })
  }
  await ctx.close()
}
await browser.close()

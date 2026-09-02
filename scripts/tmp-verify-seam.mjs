// Adversarial verification of the "hard seam at hero-fg top" claim.
// Measures per-row luminance across the seam at DPR 1 and 2, with and without .hero-fg, plus the webp alpha/colour profile.
import { chromium } from 'playwright'
import fs from 'node:fs'
fs.mkdirSync('shots/verify-seam', { recursive: true })
const browser = await chromium.launch()

async function run(viewport, dpr, scrollY, tag) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  if (scrollY) { await page.evaluate(y => window.scrollTo(0, y), scrollY); await page.waitForTimeout(1500) }
  const fgTop = await page.evaluate(() => {
    const r = document.querySelector('.hero-fg').getBoundingClientRect()
    const img = document.querySelector('.hero-fg img').getBoundingClientRect()
    const dash = document.querySelector('.hero-content')?.getBoundingClientRect()
    return { fgTop: r.top, fgLeft: r.left, imgTop: img.top, imgH: img.height, imgW: img.width, contentBottom: dash?.bottom }
  })
  const seam = Math.round(fgTop.imgTop)
  const y0 = seam - 8, h = 16
  async function sampleColumns(label) {
    const buf = await page.screenshot({ clip: { x: 0, y: y0, width: viewport.width, height: h } })
    // decode PNG via canvas in page
    const b64 = buf.toString('base64')
    return await page.evaluate(async ({ b64, w, h, dpr }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d'); g.drawImage(img, 0, 0)
      const xs = [60, 200, 420, 520, 700, 760, 960, 1100, 1300, 1400].filter(x => x < w)
      const out = {}
      for (const x of xs) {
        const col = []
        for (let y = 0; y < h; y++) {
          const d = g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data
          col.push([d[0], d[1], d[2]])
        }
        out['x' + x] = col.map(p => p.join(',')).join(' | ')
      }
      return out
    }, { b64, w: viewport.width, h, dpr })
  }
  const withFg = await sampleColumns('fg')
  await page.screenshot({ path: `shots/verify-seam/${tag}-full.png` })
  await page.screenshot({ path: `shots/verify-seam/${tag}-crop.png`, clip: { x: 0, y: Math.max(0, seam - 60), width: viewport.width, height: 120 } })
  await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = 'hidden' })
  await page.waitForTimeout(300)
  const noFg = await sampleColumns('nofg')
  await page.screenshot({ path: `shots/verify-seam/${tag}-crop-nofg.png`, clip: { x: 0, y: Math.max(0, seam - 60), width: viewport.width, height: 120 } })
  console.log(`\n=== ${tag} viewport ${viewport.width}x${viewport.height} dpr ${dpr} scroll ${scrollY} ===`)
  console.log('geometry', JSON.stringify(fgTop))
  console.log(`rows sampled y=${y0}..${y0 + h - 1}, seam expected at row index 8 (y=${seam})`)
  for (const k of Object.keys(withFg)) {
    console.log(k, '\n   with fg :', withFg[k], '\n   no fg   :', noFg[k])
  }
  await ctx.close()
}

// webp alpha + colour profile in top region (unpremultiplied rgb of veil)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  const prof = await page.evaluate(async () => {
    const img = new Image(); img.src = '/assets/foliage.webp'; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const out = { w: img.naturalWidth, h: img.naturalHeight, rows: {} }
    for (const y of [0, 5, 50, 100, 150, 200, 250, 300]) {
      const d = g.getImageData(0, y, c.width, 1).data
      let a = 0, amax = 0, amin = 255, r = 0, gg = 0, b = 0, n = 0, hist = {}
      for (let i = 0; i < d.length; i += 4) {
        const al = d[i + 3]; a += al; amax = Math.max(amax, al); amin = Math.min(amin, al); hist[al] = (hist[al] || 0) + 1
        if (al > 0 && al < 40) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++ }
      }
      out.rows['y' + y] = { meanA: +(a / (d.length / 4)).toFixed(2), minA: amin, maxA: amax, veilRGBmean: n ? [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] : null, nLowAlpha: n, hist: Object.entries(hist).slice(0, 12) }
    }
    // first row where any alpha > 40 (true foliage start) per column band
    let firstOpaqueRow = null
    for (let y = 0; y < c.height; y += 2) {
      const d = g.getImageData(0, y, c.width, 1).data
      let found = false
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { found = true; break }
      if (found) { firstOpaqueRow = y; break }
    }
    out.firstOpaqueRow = firstOpaqueRow
    return out
  })
  console.log('\n=== foliage.webp profile ===\n' + JSON.stringify(prof, null, 1))
  await ctx.close()
}

const only = process.env.ONLY || 'all'
if (only === 'all' || only === 'desktop') {
  await run({ width: 1440, height: 900 }, 1, 0, 'desktop-dpr1')
  await run({ width: 1440, height: 900 }, 2, 0, 'desktop-dpr2')
  await run({ width: 1440, height: 900 }, 1, 200, 'desktop-dpr1-scroll200')
}
if (only === 'all' || only === 'mobile') {
  await run({ width: 375, height: 812 }, 3, 150, 'mobile-dpr3-scroll150')
  await run({ width: 375, height: 812 }, 3, 300, 'mobile-dpr3-scroll300')
  await run({ width: 375, height: 812 }, 2, 450, 'mobile-dpr2-scroll450')
}
await browser.close()

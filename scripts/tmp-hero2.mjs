import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 })
const page = await ctx.newPage()
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
// alpha profile of foliage.webp and hills.webp top rows
const prof = await page.evaluate(async () => {
  async function profile(src) {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const rows = {}
    for (const y of [0, 20, 60, 100, 140, 180, 220, 300, 400, 500, 700, img.naturalHeight - 1]) {
      const d = g.getImageData(0, y, c.width, 1).data
      let a = 0, aMax = 0, r = 0, gg = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { a += d[i + 3]; aMax = Math.max(aMax, d[i + 3]); if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++ } }
      rows[`row${y}`] = { meanAlpha: Math.round(a / (d.length / 4)), maxAlpha: aMax, opaqueRGB: n ? `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})` : null }
    }
    return { w: img.naturalWidth, h: img.naturalHeight, rows }
  }
  return { foliage: await profile('/assets/foliage.webp'), hills: await profile('/assets/hills.webp') }
})
console.log(JSON.stringify(prof, null, 1))
await page.screenshot({ path: 'shots/hero/zoom-seam-left.png', clip: { x: 0, y: 740, width: 700, height: 100 } })
await page.screenshot({ path: 'shots/hero/zoom-seam-right.png', clip: { x: 900, y: 740, width: 540, height: 100 } })
await page.screenshot({ path: 'shots/hero/zoom-hill-right-edge.png', clip: { x: 1180, y: 500, width: 260, height: 200 } })
await page.screenshot({ path: 'shots/hero/zoom-foliage-rest.png', clip: { x: 0, y: 840, width: 720, height: 60 } })
// toggle hero-fg off to confirm seam origin
await page.evaluate(() => { document.querySelector('.hero-fg').style.visibility = 'hidden' })
await page.waitForTimeout(300)
await page.screenshot({ path: 'shots/hero/zoom-seam-left-nofg.png', clip: { x: 0, y: 740, width: 700, height: 100 } })
await ctx.close(); await browser.close()

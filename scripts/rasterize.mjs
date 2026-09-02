// Rasterizes the filter-heavy hero SVGs (hills, foliage) to transparent WebP at 2x so browsers
// don't re-run feTurbulence/feDisplacementMap on every paint. Sources live in assets-src/.
import { chromium } from 'playwright'
import fs from 'node:fs'

const JOBS = [
  { src: 'assets-src/hills.svg', out: 'public/assets/hills.webp', w: 2880, h: 1520 },
  { src: 'assets-src/foliage.svg', out: 'public/assets/foliage.webp', w: 2880, h: 840 },
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
for (const j of JOBS) {
  const svg = fs.readFileSync(j.src, 'utf8')
  const dataUrl = await page.evaluate(async ({ svg, w, h }) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.decoding = 'sync'
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/webp', 0.9)
  }, { svg: svg, w: j.w, h: j.h })
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
  fs.writeFileSync(j.out, buf)
  console.log(`${j.out} ${(buf.length / 1024).toFixed(0)} KB (${j.w}x${j.h})`)
}
await browser.close()

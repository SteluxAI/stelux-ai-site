import { chromium } from 'playwright'
import fs from 'node:fs'
const b64 = fs.readFileSync('public/assets/foliage.webp').toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage()
const res = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/webp;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0,0,c.width,c.height).data
  const rows = []
  for (let y = 0; y < c.height; y += Math.max(1, Math.floor(c.height/60))) {
    let sumA = 0, minA = 255, maxA = 0, sumL = 0
    for (let x = 0; x < c.width; x++) { const i = (y*c.width + x)*4; const a = d[i+3]; sumA += a; minA = Math.min(minA,a); maxA = Math.max(maxA,a); sumL += (d[i]+d[i+1]+d[i+2])/3 }
    rows.push({ y, avgA: Math.round(sumA/c.width), minA, maxA, avgL: Math.round(sumL/c.width) })
  }
  // first row where all pixels fully opaque
  let solidFrom = -1
  for (let y = 0; y < c.height; y++) { let ok = true; for (let x = 0; x < c.width; x += 4) { if (d[(y*c.width+x)*4+3] < 250) { ok = false; break } } if (ok) { solidFrom = y; break } }
  let firstAlpha = -1
  for (let y = 0; y < c.height; y++) { let any = false; for (let x = 0; x < c.width; x += 4) { if (d[(y*c.width+x)*4+3] > 5) { any = true; break } } if (any) { firstAlpha = y; break } }
  return { w: c.width, h: c.height, firstAlpha, solidFrom, rows }
}, b64)
console.log(JSON.stringify({ w: res.w, h: res.h, firstAlpha: res.firstAlpha, solidFrom: res.solidFrom }))
for (const r of res.rows) console.log(`row ${r.y}: avgA=${r.avgA} min=${r.minA} max=${r.maxA} avgL=${r.avgL}`)
await browser.close()

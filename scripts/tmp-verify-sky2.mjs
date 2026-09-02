// Verifier probe 2: fine-sample the horizon band on fora.so (two captures 12s apart to detect
// sky animation) and on the local build; report HSL so saturation/warmth can be compared.
import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = 'shots/verify-sky'
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const browser = await chromium.launch()

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}
async function samplePng(png, points) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p.setContent('<canvas id=c></canvas>')
  const res = await p.evaluate(async ({ src, points }) => {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.getElementById('c'); c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    return points.map(([x, y]) => {
      let r = 0, g = 0, b = 0, n = 0
      const d = ctx.getImageData(x * 2 - 4, y * 2 - 4, 9, 9).data
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
      return [x, y, Math.round(r / n), Math.round(g / n), Math.round(b / n)]
    })
  }, { src: 'data:image/png;base64,' + png.toString('base64'), points })
  await p.close()
  return res
}
const fmt = (rows) => rows.map(([x, y, r, g, b]) => { const { h, s, l } = hsl(r, g, b); return `  (${x},${y}) rgb(${r},${g},${b})  hsl(${h},${s}%,${l}%)` }).join('\n')

// horizon band: x=60 (far-left gutter, above hills) and x=720 centre (above dashboard top)
const pts = []
for (let y = 540; y <= 780; y += 20) { pts.push([60, y]); pts.push([720, y]) }

// ---- fora, two captures ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  try { await page.goto('https://fora.so/', { waitUntil: 'networkidle', timeout: 45000 }) } catch (e) { console.log('goto:', e.message) }
  await page.waitForTimeout(2500)
  // dismiss the cookie banner if present so it doesn't overlap the left gutter (probe-only)
  try { await page.getByRole('button', { name: /okay/i }).click({ timeout: 2000 }) } catch {}
  await page.waitForTimeout(500)
  const a = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
  fs.writeFileSync(`${OUT}/fora-hero-t0.png`, a)
  console.log('=== FORA t0 horizon band ===\n' + fmt(await samplePng(a, pts)))
  // what is the sky made of?
  const skyInfo = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('section, div, video, canvas, img, picture')).slice(0, 4000)
    const hits = []
    for (const e of els) {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
      if (r.width < 800 || r.height < 300 || r.top > 200) continue
      const bg = cs.backgroundImage
      if (e.tagName === 'VIDEO' || e.tagName === 'CANVAS' || (e.tagName === 'IMG') || (bg && bg !== 'none')) {
        hits.push({ tag: e.tagName, cls: (e.className && e.className.toString().slice(0, 80)) || '', src: (e.currentSrc || e.src || '').slice(0, 120), bg: bg.slice(0, 200), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) })
      }
    }
    return hits.slice(0, 12)
  })
  console.log('fora sky elements:', JSON.stringify(skyInfo, null, 1))
  await page.waitForTimeout(12000)
  const b = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
  fs.writeFileSync(`${OUT}/fora-hero-t12.png`, b)
  console.log('=== FORA t12 horizon band ===\n' + fmt(await samplePng(b, pts)))
  await page.close()
}

// ---- local ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const a = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
  console.log('=== LOCAL horizon band ===\n' + fmt(await samplePng(a, pts)))
  await page.close()
}
await browser.close()

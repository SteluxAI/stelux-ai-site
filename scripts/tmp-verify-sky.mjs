// Verifier probe: sample sky colours from fora.so and from the local build at the same
// viewport, from the COMPOSITED screenshot (what a viewer sees), and compare HSL.
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
    // average a 9x9 block to smooth grain/noise
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

const fmt = (rows) => rows.map(([x, y, r, g, b]) => {
  const { h, s, l } = hsl(r, g, b)
  return `  (${x},${y}) rgb(${r},${g},${b})  hsl(${h},${s}%,${l}%)`
}).join('\n')

// points: left gutter and right gutter columns (avoid centered copy), plus centre near top
const ys = [5, 40, 80, 120, 180, 250, 320, 400, 450, 500, 540]
const pts = []
for (const y of ys) { pts.push([120, y]); pts.push([1320, y]) }

// ---- local build ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
  fs.writeFileSync(`${OUT}/local-hero.png`, png)
  const rows = await samplePng(png, pts)
  console.log('=== LOCAL (composited screenshot) ===\n' + fmt(rows))
  // hero geometry so we know where the hill crest / horizon is
  const geo = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } }
    return { hills: r('.hills'), hillsWrap: r('.hills-wrap'), dash: r('#terminal'), copy: r('.hero-copy'), bodyBg: getComputedStyle(document.body).backgroundColor }
  })
  console.log('local geometry', JSON.stringify(geo))
  await page.close()
}

// ---- fora.so ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  try {
    await page.goto('https://fora.so/', { waitUntil: 'networkidle', timeout: 45000 })
  } catch (e) { console.log('fora goto (networkidle) failed, continuing:', e.message) }
  await page.waitForTimeout(3000)
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
  fs.writeFileSync(`${OUT}/fora-hero.png`, png)
  const rows = await samplePng(png, pts)
  console.log('=== FORA (composited screenshot) ===\n' + fmt(rows))
  const geo = await page.evaluate(() => ({ title: document.title, bodyBg: getComputedStyle(document.body).backgroundColor, h1: document.querySelector('h1')?.getBoundingClientRect().toJSON() }))
  console.log('fora geometry', JSON.stringify(geo))
  await page.close()
}

await browser.close()

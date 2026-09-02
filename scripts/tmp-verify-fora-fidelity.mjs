// Probe: reproduce "ghost hill" claim. Crops the right-hill region from the live page,
// renders hills.svg standalone plus isolation variants (no crest ellipses / no hz haze),
// and samples pixel colours down a vertical line through the right far hill.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'shots/verify-fora-fidelity'
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'

const browser = await chromium.launch()

// ---- 1. live page, desktop 1440x900, hero at top ----
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const geo = await page.evaluate(() => {
  const w = document.querySelector('.hills-wrap').getBoundingClientRect()
  const img = document.querySelector('.hills').getBoundingClientRect()
  const dash = document.querySelector('.hero-content')?.getBoundingClientRect()
  return { wrap: { top: w.top, height: w.height }, img: { top: img.top, left: img.left, width: img.width, height: img.height }, dashRight: dash?.right }
})
console.log('geometry', JSON.stringify(geo))
await page.screenshot({ path: `${OUT}/live-right-hill-2x.png`, clip: { x: 1000, y: 300, width: 440, height: 400 } })
await page.screenshot({ path: `${OUT}/live-left-hill-2x.png`, clip: { x: 0, y: 300, width: 440, height: 400 } })
await page.screenshot({ path: `${OUT}/live-hero-full.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } })

// hide the dashboard & foliage so only bg layer shows (probe only, not a page edit)
await page.addStyleTag({ content: '.hero-content,.hero-fg{visibility:hidden!important}' })
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/live-bg-only.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } })

// sample colours down x=1300 and x=1420 from the live page
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })
await page.close()

// use a canvas in a fresh page to read pixels of the screenshot
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await p2.setContent(`<canvas id=c></canvas>`)
const dataUrl = 'data:image/png;base64,' + png.toString('base64')
const samples = await p2.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode()
  const c = document.getElementById('c'); c.width = img.width; c.height = img.height
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
  const out = {}
  for (const x of [1200, 1300, 1420]) {
    const col = []
    for (let y = 300; y <= 700; y += 10) {
      const d = ctx.getImageData(x * 2, y * 2, 1, 1).data
      col.push(`${y}:${d[0]},${d[1]},${d[2]}`)
    }
    out[x] = col
  }
  return out
}, dataUrl)
for (const [x, col] of Object.entries(samples)) console.log(`x=${x}\n  ` + col.join('\n  '))
await p2.close()

// ---- 2. standalone SVG renders on a fora-like dusk background ----
const svg = fs.readFileSync('assets-src/hills.svg', 'utf8')
const variants = {
  'svg-asis': svg,
  'svg-no-crest': svg.replace(/<ellipse[^>]*fill="url\(#crest\)"[^>]*\/>/g, ''),
  'svg-no-hz': svg.replace(/<rect x="0" y="180" width="1440" height="420" fill="url\(#hz\)"\/>/, ''),
  'svg-no-crest-no-hz': svg.replace(/<ellipse[^>]*fill="url\(#crest\)"[^>]*\/>/g, '').replace(/<rect x="0" y="180" width="1440" height="420" fill="url\(#hz\)"\/>/, ''),
}
for (const [name, body] of Object.entries(variants)) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 1 })
  await p.setContent(`<style>html,body{margin:0;background:linear-gradient(#5a4a52,#8c7078 40%,#a68a90 70%,#b09499)}svg{display:block;width:1440px;height:760px}</style>${body}`)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${OUT}/${name}.png` })
  await p.screenshot({ path: `${OUT}/${name}-right-crop.png`, clip: { x: 960, y: 300, width: 480, height: 300 } })
  await p.close()
}
await browser.close()
console.log('done')

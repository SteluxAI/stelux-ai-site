import { chromium } from 'playwright'
import fs from 'node:fs'
const OUT = 'shots/verify-fora-fidelity'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const decoder = await browser.newPage()
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  let s = 0
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min) }
  return { s: Math.round(s * 100), l: Math.round(l * 100) }
}
async function samplePng(png, points) {
  const dataUrl = 'data:image/png;base64,' + png.toString('base64')
  return decoder.evaluate(async ({ dataUrl, points }) => {
    const img = new Image(); img.src = dataUrl; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    return points.map(([x, y]) => {
      const d = g.getImageData(x - 4, y - 4, 9, 9).data
      let r = 0, gg = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++ }
      return { x, y, rgb: [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] }
    })
  }, { dataUrl, points })
}
const XS = [100, 400, 720, 1040, 1340]
const YS = [200, 300, 400, 450, 500, 530, 560, 580, 600, 620]
const grid = []; for (const y of YS) for (const x of XS) grid.push([x, y])
function table(tag, samples) {
  console.log(`\n=== ${tag} ===   cells: r,g,b S%/L%`)
  console.log('  y\x ' + XS.map(x => String(x).padStart(24)).join(''))
  for (const y of YS) {
    const row = samples.filter(s => s.y === y).map(s => { const [r, g, b] = s.rgb; const c = hsl(r, g, b); return `${r},${g},${b} S${c.s}/L${c.l}`.padStart(24) })
    console.log(String(y).padStart(5) + '  ' + row.join(''))
  }
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' })
  const page = await ctx.newPage()
  await page.goto('https://fora.so/', { waitUntil: 'load', timeout: 45000 })
  await page.waitForTimeout(3000)
  const dom = await page.evaluate(() => {
    const desc = (e) => { const c = getComputedStyle(e); return { tag: e.tagName, id: e.id, cls: (e.className || '').toString().slice(0, 80), src: (e.currentSrc || e.src || null), bg: c.backgroundImage.slice(0, 200), bgc: c.backgroundColor, opacity: c.opacity, blend: c.mixBlendMode, z: c.zIndex } }
    const at = (x, y) => document.elementsFromPoint(x, y).slice(0, 8).map(desc)
    const videos = Array.from(document.querySelectorAll('video')).map(v => ({ src: v.currentSrc, dur: v.duration, t: v.currentTime, paused: v.paused, loop: v.loop, rect: v.getBoundingClientRect().toJSON() }))
    const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({ w: c.width, h: c.height, rect: c.getBoundingClientRect().toJSON() }))
    return { at350: at(720, 350), at560: at(100, 560), videos, canvases }
  })
  console.log('FORA DOM:', JSON.stringify(dom, null, 1))
  for (let i = 0; i < 3; i++) {
    const png = await page.screenshot({ path: `${OUT}/fora-frame${i}.png` })
    table(`FORA frame ${i} (t+${i * 4}s)`, await samplePng(png, grid))
    await page.waitForTimeout(4000)
  }
  await page.screenshot({ path: `${OUT}/fora-band.png`, clip: { x: 0, y: 420, width: 1440, height: 220 } })
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const png = await page.screenshot()
  table('STELUX', await samplePng(png, grid))
  await page.screenshot({ path: `${OUT}/stelux-band.png`, clip: { x: 0, y: 360, width: 1440, height: 220 } })
  await ctx.close()
}
await browser.close()

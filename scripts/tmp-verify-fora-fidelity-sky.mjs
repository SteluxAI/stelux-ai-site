import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-fora-fidelity'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0, h = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) }
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

const decoder = await browser.newPage()
async function samplePng(png, points) {
  const dataUrl = 'data:image/png;base64,' + png.toString('base64')
  return decoder.evaluate(async ({ dataUrl, points }) => {
    const img = new Image(); img.src = dataUrl; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    return points.map(([x, y]) => {
      // 9x9 box average to avoid noise
      const d = g.getImageData(x - 4, y - 4, 9, 9).data
      let r = 0, gg = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++ }
      return { x, y, rgb: [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] }
    })
  }, { dataUrl, points })
}
function report(tag, samples) {
  console.log(`\n=== ${tag} rendered pixels (9x9 avg) ===`)
  for (const s of samples) {
    const [r, g, b] = s.rgb
    const c = hsl(r, g, b)
    console.log(`(${s.x},${s.y})  rgb(${r},${g},${b})  ${hex(s.rgb)}  H${c.h} S${c.s}% L${c.l}%`)
  }
}

const YS = [5, 40, 80, 120, 180, 250, 350, 450, 500, 550, 600, 650]
const pts = (W) => [...YS.map(y => [Math.round(W / 2), y]), [60, 400], [W - 60, 400], [200, 550], [W - 200, 550]]

// ---- local site ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const png = await page.screenshot({ path: `${OUT}/sky-desktop-0.png` })
  await page.screenshot({ path: `${OUT}/sky-desktop-top700.png`, clip: { x: 0, y: 0, width: 1440, height: 700 } })
  report('STELUX', await samplePng(png, pts(1440)))
  // what composites over the canvas at a mid-sky point + canvas backing store sample
  const info = await page.evaluate(() => {
    const cv = document.querySelector('#aurora')
    const g = cv.getContext('2d')
    const cs = (e) => { const c = getComputedStyle(e); return { tag: e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : ''), bg: c.backgroundImage !== 'none' ? c.backgroundImage.slice(0, 120) : c.backgroundColor, opacity: c.opacity, blend: c.mixBlendMode, filter: c.filter, z: c.zIndex } }
    const stack = document.elementsFromPoint(720, 400).map(cs)
    const canvasSample = (x, y) => { const d = g.getImageData(Math.round(x * cv.width / cv.clientWidth), Math.round(y * cv.height / cv.clientHeight), 1, 1).data; return [d[0], d[1], d[2]] }
    const cvs = {}
    for (const y of [5, 120, 250, 350, 450, 550, 650]) cvs['y' + y] = canvasSample(720, y)
    const bodyBg = getComputedStyle(document.body).backgroundColor
    const htmlBg = getComputedStyle(document.documentElement).backgroundColor
    const cvcs = getComputedStyle(cv)
    return { stack, canvasBacking: cvs, canvasSize: { w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight }, canvasCss: { opacity: cvcs.opacity, filter: cvcs.filter, blend: cvcs.mixBlendMode }, bodyBg, htmlBg, hillsTop: document.querySelector('.hills-wrap')?.getBoundingClientRect().top }
  })
  console.log('\nSTELUX stack at (720,400):', JSON.stringify(info.stack, null, 1))
  console.log('STELUX canvas backing store samples:', JSON.stringify(info.canvasBacking))
  console.log('STELUX canvas:', JSON.stringify({ size: info.canvasSize, css: info.canvasCss, bodyBg: info.bodyBg, htmlBg: info.htmlBg, hillsTop: info.hillsTop }))
  await ctx.close()
}

// ---- fora.so reference ----
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' })
  const page = await ctx.newPage()
  await page.goto('https://fora.so/', { waitUntil: 'load', timeout: 45000 })
  await page.waitForTimeout(4000)
  const png = await page.screenshot({ path: `${OUT}/fora-desktop-0.png` })
  await page.screenshot({ path: `${OUT}/fora-desktop-top700.png`, clip: { x: 0, y: 0, width: 1440, height: 700 } })
  report('FORA', await samplePng(png, pts(1440)))
  const title = await page.title()
  console.log('FORA title:', title, 'url:', page.url())
  await ctx.close()
} catch (e) {
  console.log('FORA fetch failed:', e.message)
}

await browser.close()

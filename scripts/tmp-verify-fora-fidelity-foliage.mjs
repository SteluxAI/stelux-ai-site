import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-fora-fidelity/foliage'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function probe(vp, tag) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vp.width < 768, hasTouch: vp.width < 768, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true, force: true, lock: true }); window.scrollTo(0, 0) })
  await page.waitForTimeout(800)
  const info = await page.evaluate(async () => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), left: Math.round(b.left), w: Math.round(b.width) } }
    const W = innerWidth, H = innerHeight
    const crestOf = (sel) => {
      const img = document.querySelector(sel)
      const box = img.getBoundingClientRect()
      const c = document.createElement('canvas')
      const nw = img.naturalWidth, nh = img.naturalHeight
      c.width = nw; c.height = nh
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, nw, nh).data
      const scale = box.width / nw
      const colTops = []
      for (let x = 0; x < nw; x += Math.max(1, Math.floor(nw / 200))) {
        const sx = box.left + x * scale
        if (sx < 0 || sx > W) continue
        for (let y = 0; y < nh; y++) { if (d[(y * nw + x) * 4 + 3] > 40) { colTops.push(y); break } }
      }
      const minRow = Math.min(...colTops), maxRow = Math.max(...colTops), avgRow = colTops.reduce((a, b) => a + b, 0) / colTops.length
      return { min: Math.round(box.top + minRow * scale), avg: Math.round(box.top + avgRow * scale), max: Math.round(box.top + maxRow * scale), natural: { nw, nh }, box: { top: Math.round(box.top), h: Math.round(box.height) } }
    }
    const tf = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).transform : null }
    const term = r('#terminal')
    return {
      vw: W, vh: H, scrollY: Math.round(scrollY),
      hero: r('#hero'), heroFg: r('.hero-fg'), folCrest: crestOf('.hero-fg img'),
      hillsWrap: r('.hills-wrap'), hillsCrest: crestOf('.hills'),
      terminal: term, dashMain: r('.dash-main'), dashCta: r('.dash-cta'), copy: r('.hero-copy'), fade: r('.hero-fade'),
      transforms: { bg: tf('.hero-bg'), fg: tf('.hero-fg'), copy: tf('.hero-copy') },
      visibleDashboardPx: Math.max(0, Math.min(H, term.bottom) - Math.max(0, term.top)),
    }
  })
  info.fracs = { folCrestMin_vh: +(info.folCrest.min / info.vh).toFixed(3), folCrestAvg_vh: +(info.folCrest.avg / info.vh).toFixed(3), terminalBottom_vh: +(info.terminal.bottom / info.vh).toFixed(3), heroFgTop_vh: +(info.heroFg.top / info.vh).toFixed(3), hero_vh: +(info.hero.h / info.vh).toFixed(3) }
  console.log(`\n=== ${tag} @rest ===`)
  console.log(JSON.stringify(info, null, 1))
  await page.screenshot({ path: `${OUT}/${tag}-rest.png` })
  await page.screenshot({ path: `${OUT}/${tag}-hero-full.png`, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(info.hero.h + 40, 4000) } })
  await page.screenshot({ path: `${OUT}/${tag}-rest-bottom.png`, clip: { x: 0, y: Math.max(0, vp.height - 160), width: vp.width, height: 160 } })
  await ctx.close()
}

await probe({ width: 1440, height: 900 }, 'desktop')
await probe({ width: 375, height: 812 }, 'mobile')
await browser.close()

import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/hero'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function probe(vp, tag) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: vp.width < 768, hasTouch: vp.width < 768 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) } }
    const cs = (s, props) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return Object.fromEntries(props.map(p => [p, c[p]])) }
    const cv = document.querySelector('#aurora')
    const g = cv.getContext('2d')
    const sample = (x, y) => { const d = g.getImageData(Math.round(x * cv.width / cv.clientWidth), Math.round(y * cv.height / cv.clientHeight), 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})` }
    const W = innerWidth, H = innerHeight
    const sky = {}
    for (const y of [5, 40, 80, 120, 180, 250, 350, 450, 550]) sky[`y${y}`] = sample(W / 2, y)
    sky.left400 = sample(60, 400); sky.right400 = sample(W - 60, 400)
    const h1 = document.querySelector('.hero-h1')
    const h1lines = (() => { const rg = document.createRange(); rg.selectNodeContents(h1); const rects = Array.from(rg.getClientRects()).map(r => Math.round(r.top)); return [...new Set(rects)] })()
    return {
      vw: W, vh: H, scrollH: document.documentElement.scrollHeight,
      canvas: { w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight },
      hero: r('#hero'), heroBg: r('.hero-bg'), hillsWrap: r('.hills-wrap'), hills: r('.hills'),
      heroFg: r('.hero-fg'), fol: r('.hero-fg img'), terminal: r('#terminal'), dashMain: r('.dash-main'), dashSide: r('.dash-side'),
      copy: r('.hero-copy'), h1: r('.hero-h1'), h1lines, pill: r('.pill'), sub: r('.hero-copy p'), btnLight: r('.btn-light'), btnGhost: r('.hero-copy .btn-ghost'),
      dashCta: r('.dash-cta'), avatar: r('.dash-avatar'), products: r('#products'), fade: r('.hero-fade'),
      h1cs: cs('.hero-h1', ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']),
      subcs: cs('.hero-copy p', ['fontSize', 'color', 'lineHeight']),
      pillcs: cs('.pill', ['fontSize', 'color', 'backgroundColor', 'borderColor']),
      btncs: cs('.btn-light', ['backgroundColor', 'color', 'fontSize', 'borderRadius']),
      ctacs: cs('.dash-cta', ['backgroundColor', 'color', 'fontSize', 'borderRadius', 'height']),
      sky,
      hillsNatural: (() => { const i = document.querySelector('.hills'); return { nw: i.naturalWidth, nh: i.naturalHeight, complete: i.complete } })(),
      folNatural: (() => { const i = document.querySelector('.hero-fg img'); return { nw: i.naturalWidth, nh: i.naturalHeight, complete: i.complete } })(),
      root: cs(':root', ['--horizon', '--crest', '--hills-h', '--fol-h', '--fg-h', '--overlap']),
    }
  })
  console.log(`\n=== ${tag} ===`)
  console.log(JSON.stringify(info, null, 1))
  const clips = vp.width >= 768
    ? [
      ['top-sky', { x: 0, y: 0, width: 1440, height: 260 }],
      ['hills-left', { x: 0, y: 480, width: 520, height: 420 }],
      ['hills-right', { x: 920, y: 480, width: 520, height: 420 }],
      ['dash', { x: 200, y: 540, width: 1040, height: 360 }],
      ['bottom', { x: 0, y: 780, width: 1440, height: 120 }],
      ['headline', { x: 300, y: 130, width: 840, height: 260 }],
    ]
    : [
      ['m-headline', { x: 0, y: 110, width: 375, height: 240 }],
      ['m-bottom', { x: 0, y: 540, width: 375, height: 272 }],
    ]
  for (const [n, clip] of clips) await page.screenshot({ path: `${OUT}/crop-${tag}-${n}.png`, clip })
  // scrolled
  for (const y of vp.width >= 768 ? [200, 375, 600] : [300, 623]) {
    await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
    await page.waitForTimeout(1500)
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } }
      return { scrollY: Math.round(scrollY), hills: r('.hills'), hillsWrap: r('.hills-wrap'), fol: r('.hero-fg img'), heroFg: r('.hero-fg'), hero: r('#hero'), terminal: r('#terminal'), products: r('#products'), copy: r('.hero-copy') }
    })
    console.log(`scroll ${y}:`, JSON.stringify(m))
    await page.screenshot({ path: `${OUT}/crop-${tag}-scroll${y}.png` })
  }
  await ctx.close()
}

await probe({ width: 1440, height: 900 }, 'desktop')
await probe({ width: 375, height: 812 }, 'mobile')
await browser.close()

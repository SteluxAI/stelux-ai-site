import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-fg'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

async function probe(vp, tag, ys) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vp.width < 768, hasTouch: vp.width < 768 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  console.log(`\n=== ${tag} ${vp.width}x${vp.height} ===`)
  for (const y of ys) {
    await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
    await page.waitForTimeout(900)
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)] }
      return { sy: Math.round(scrollY), hero: r('#hero'), copy: r('.hero-copy'), h1: r('.hero-h1'), btn: r('.btn-light'), term: r('#terminal'), cta: r('.dash-cta'), hills: r('.hills'), fol: r('.hero-fg img'), fg: r('.hero-fg'), fade: r('.hero-fade') }
    })
    // find first foliage crest row: scan screenshot for the foliage layer? approximate: sample pixels down the center & sides for dark foliage color below the dashboard
    console.log(`y=${String(y).padStart(4)} hero=${m.hero} copy=${m.copy} h1=${m.h1} btn=${m.btn} term=${m.term} cta=${m.cta} fol=${m.fol} fade=${m.fade}`)
    await page.screenshot({ path: `${OUT}/${tag}-y${y}.png` })
  }
  await ctx.close()
}

await probe({ width: 1440, height: 900 }, 'd', [0, 60, 120, 180, 240, 300])
await probe({ width: 375, height: 812 }, 'm', [0, 100, 200, 300, 400, 500])
await probe({ width: 1440, height: 1080 }, 'd1080', [0])
await probe({ width: 1920, height: 1080 }, 'd1920', [0])
await probe({ width: 1280, height: 720 }, 'd720', [0])
await browser.close()

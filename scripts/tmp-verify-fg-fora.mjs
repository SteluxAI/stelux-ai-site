import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = 'shots/verify-fg'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

async function probe(vp, tag, ys) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vp.width < 768, hasTouch: vp.width < 768 })
  const page = await ctx.newPage()
  await page.goto('https://fora.so', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto', e.message))
  await page.waitForTimeout(2500)
  console.log(`\n=== fora ${tag} ${vp.width}x${vp.height} ===`)
  for (const y of ys) {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await page.mouse.wheel(0, 0)
    await page.waitForTimeout(1500)
    const m = await page.evaluate(() => {
      const rr = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.left), Math.round(b.width)] }
      const h1 = document.querySelector('h1')
      const imgs = [...document.querySelectorAll('img')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 300 && b.top < 1600 }).map(e => ({ src: (e.currentSrc || e.src || '').slice(-40), b: rr(e) }))
      return { sy: Math.round(scrollY), vh: innerHeight, h1: h1 ? rr(h1) : null, imgs }
    })
    console.log(`y=${y}`, JSON.stringify(m))
    await page.screenshot({ path: `${OUT}/fora-${tag}-y${y}.png` })
  }
  await ctx.close()
}

await probe({ width: 1440, height: 900 }, 'd', [0, 300, 600])
await probe({ width: 375, height: 812 }, 'm', [0, 300, 600])
await browser.close()

import { chromium } from 'playwright'
const BASE = 'http://localhost:4173/'
const browser = await chromium.launch()
for (const vp of [{ name:'desktop', width:1440, height:900 }, { name:'mobile', width:375, height:812, isMobile:true, hasTouch:true }]) {
  const ctx = await browser.newContext({ viewport:{width:vp.width,height:vp.height}, deviceScaleFactor:1, isMobile:!!vp.isMobile, hasTouch:!!vp.hasTouch })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil:'networkidle' }); await page.waitForTimeout(1200)
  const info = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top+scrollY), h: Math.round(b.height) } }
    return { docH: document.documentElement.scrollHeight, hero: r('.hero'), heroContent: r('.hero-content'), fg: r('.hero-fg'), fgImg: r('.hero-fg img'), products: r('#products'), eyebrow: r('#products .eyebrow'), terminal: r('#terminal'), fade: r('.hero-fade') }
  })
  console.log(vp.name, JSON.stringify(info))
  const max = info.docH - vp.height
  const steps = vp.name==='desktop' ? [200,300,375,450,525,600,675,750,825,900,1000,1100] : [150,250,300,350,400,450,500,550,623,700,800,900]
  for (const y of steps) {
    await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate:true, force:true, lock:true }); window.scrollTo(0,y) }, y)
    await page.waitForTimeout(700)
    const m = await page.evaluate(() => {
      const b = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] }
      return { fg: b('.hero-fg'), img: b('.hero-fg img'), heroBottom: b('.hero')[1], products: b('#products'), eyebrow: b('#products .eyebrow'), fade: b('.hero-fade') }
    })
    const file = `shots/verify-void/${vp.name}-y${y}.png`
    await page.screenshot({ path:file })
    console.log(`${vp.name} y=${y} (${(y/max*100).toFixed(1)}%) fg=${m.fg} img=${m.img} heroBottom=${m.heroBottom} products=${m.products} eyebrow=${m.eyebrow} fade=${m.fade}`)
  }
  await ctx.close()
}
await browser.close()

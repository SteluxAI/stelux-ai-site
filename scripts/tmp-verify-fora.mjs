import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{ width:1440, height:900 }, deviceScaleFactor:1 })
const page = await ctx.newPage()
await page.goto('https://fora.so', { waitUntil:'networkidle', timeout: 60000 }); await page.waitForTimeout(2500)
// dismiss cookie banner if present (decline)
try { const b = page.getByRole('button', { name: /decline|reject|no thanks/i }).first(); if (await b.isVisible({timeout:1500})) await b.click() } catch {}
for (const y of [0, 375, 600, 750, 950, 1100, 1269]) {
  await page.evaluate((y) => window.scrollTo(0, y), y)
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('section')).slice(0,2).map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })
    const imgs = Array.from(document.querySelectorAll('img')).filter(i => i.getBoundingClientRect().width > 600).slice(0,4).map(i => { const r = i.getBoundingClientRect(); return { src: (i.currentSrc||i.src).slice(-30), top: Math.round(r.top), bottom: Math.round(r.bottom), z: getComputedStyle(i.parentElement).zIndex } })
    // first text element in section 2
    const s2 = document.querySelectorAll('section')[1]
    let firstText = null
    if (s2) { for (const el of s2.querySelectorAll('h1,h2,h3,p,a,button')) { const r = el.getBoundingClientRect(); if (r.height > 10 && el.textContent.trim()) { firstText = { txt: el.textContent.trim().slice(0,40), top: Math.round(r.top) }; break } } }
    return { scrollY, secs, imgs, firstText }
  })
  await page.screenshot({ path: `shots/verify-void/fora-y${y}.png` })
  console.log(`fora y=${y}`, JSON.stringify(m))
}
await browser.close()

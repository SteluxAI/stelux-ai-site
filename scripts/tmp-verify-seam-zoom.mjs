import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
// 1x capture of sidebar + hills around seam, then also hills alone
await page.screenshot({ path: 'shots/verify-seam/zoom1x-sidebar.png', clip: { x: 0, y: 740, width: 460, height: 100 } })
await page.screenshot({ path: 'shots/verify-seam/zoom1x-panel.png', clip: { x: 440, y: 740, width: 800, height: 100 } })
// scroll 120 so the seam crosses the orchestrator title / agent card
await page.evaluate(() => window.scrollTo(0, 120)); await page.waitForTimeout(1500)
const t = await page.evaluate(() => document.querySelector('.hero-fg img').getBoundingClientRect().top)
console.log('scroll120 seam at', t)
await page.screenshot({ path: 'shots/verify-seam/zoom1x-scroll120.png', clip: { x: 200, y: Math.round(t) - 50, width: 1040, height: 100 } })
await browser.close()

// Renders the Open Graph card (1200x630) from the live hero.
import { chromium } from 'playwright'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.addStyleTag({ content: 'header{display:none!important} .hero-content{padding-top:150px!important}' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
await browser.close()
console.log('wrote public/og.png')

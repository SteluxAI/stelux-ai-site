import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
// Freeze the live simulation by stopping timers so two snapshots are comparable
await page.evaluate(() => { const id = setTimeout(() => {}, 0); for (let i = 0; i <= id; i++) { clearTimeout(i); clearInterval(i) } })
const grab = () => page.evaluate(() => document.querySelector('.dash-main').innerHTML)
const a = await grab()
await page.click('.dash-nav[data-view="products"]')
await page.waitForTimeout(600)
const b = await grab()
// compute char-level diff regions
let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++
console.log('prefix common:', i, 'suffix common:', j)
console.log('A differing slice:', JSON.stringify(a.slice(i, a.length - j)))
console.log('B differing slice:', JSON.stringify(b.slice(i, b.length - j)))
await browser.close()

// Standalone Chromium test: does a sticky card's margin-bottom shorten its pin? Do spacer siblings / container padding hold the stack?
import { chromium } from 'playwright'
const html = (variant) => `<!doctype html><style>
body{margin:0;background:#000;color:#fff;font:14px sans-serif}
.spacer{height:800px}
.stack{position:relative}
.card{position:sticky;height:500px;border:1px solid #fff;box-sizing:border-box}
${variant === 'margin' ? '.card{margin-bottom:100px}.card:last-child{margin-bottom:0}' : ''}
${variant === 'spacer' ? '.gap{height:100px}' : ''}
${variant === 'spacer-pad' ? '.gap{height:100px}.stack{padding-bottom:400px}' : ''}
${variant === 'spacer-tail' ? '.gap{height:100px}.tail{height:400px}' : ''}
</style><div class="spacer"></div><div class="stack">
<div class="card" style="top:88px">A</div>${variant.startsWith('spacer') ? '<div class="gap"></div>' : ''}
<div class="card" style="top:106px">B</div>${variant.startsWith('spacer') ? '<div class="gap"></div>' : ''}
<div class="card" style="top:124px">C</div>${variant === 'spacer-tail' ? '<div class="tail"></div>' : ''}
</div><div class="spacer"></div><div class="spacer"></div>`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 900 } })
for (const v of ['margin', 'spacer', 'spacer-pad', 'spacer-tail']) {
  await page.setContent(html(v))
  const cTop = await page.evaluate(() => document.querySelectorAll('.card')[2].getBoundingClientRect().top + scrollY)
  const yPin = cTop - 124
  const res = []
  for (const y of [yPin - 200, yPin, yPin + 100, yPin + 300]) {
    await page.evaluate((y) => scrollTo(0, y), y)
    await page.waitForTimeout(50)
    res.push({ y: y - yPin, tops: await page.evaluate(() => Array.from(document.querySelectorAll('.card')).map((c) => Math.round(c.getBoundingClientRect().top))) })
  }
  console.log(v.padEnd(12), JSON.stringify(res))
}
await browser.close()

// Verifier: simulate the proposed headline fix WITH correct whitespace and measure line balance at several mobile widths.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-fora-fidelity'
fs.mkdirSync(OUT, { recursive: true })

function measureLines() {
  const h1 = document.querySelector('.hero-h1')
  const hr = h1.getBoundingClientRect()
  const words = []
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const text = n.textContent
    const re = /\S+/g
    let m
    while ((m = re.exec(text))) {
      const range = document.createRange()
      range.setStart(n, m.index)
      range.setEnd(n, m.index + m[0].length)
      const r = range.getBoundingClientRect()
      words.push({ w: m[0], top: Math.round(r.top), left: r.left, right: r.right })
    }
  }
  const lines = []
  for (const w of words) {
    const L = lines.find((l) => Math.abs(l.top - w.top) < 2)
    if (L) { L.words.push(w.w); L.left = Math.min(L.left, w.left); L.right = Math.max(L.right, w.right) }
    else lines.push({ top: w.top, words: [w.w], left: w.left, right: w.right })
  }
  return lines.map((l) => `${l.words.join(' ')} [${Math.round(l.right - l.left)}px / ${Math.round(((l.right - l.left) / hr.width) * 100)}%]`)
}

const browser = await chromium.launch()
for (const w of [360, 375, 390, 414]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
  const base = await page.evaluate(measureLines)
  // Proposed fix, done right: keep a space around the br, hide the br below sm
  await page.evaluate(() => {
    const h1 = document.querySelector('.hero-h1')
    h1.innerHTML = 'Orchestrate intelligence <br class="hidden sm:inline">at enterprise scale.'
  })
  await page.addStyleTag({ content: '.hero-h1 br.hidden { display: none !important; }' })
  await page.waitForTimeout(200)
  const fixed42 = await page.evaluate(measureLines)
  if (w === 375) {
    const box = await page.locator('.hero-h1').boundingBox()
    await page.screenshot({ path: `${OUT}/mobile-h1-crop-fix-correct-42px.png`, clip: { x: 0, y: Math.max(0, box.y - 40), width: 375, height: box.height + 80 } })
  }
  await page.addStyleTag({ content: '.hero-h1 { font-size: 40px !important; }' })
  await page.waitForTimeout(200)
  const fixed40 = await page.evaluate(measureLines)
  console.log(`\n=== ${w}px ===`)
  console.log('  baseline (hard <br>):', JSON.stringify(base))
  console.log('  fix, 42px, balance  :', JSON.stringify(fixed42))
  console.log('  fix, 40px, balance  :', JSON.stringify(fixed40))
  await ctx.close()
}
await browser.close()

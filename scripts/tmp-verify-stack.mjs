// Verifier probe: fine scroll sweep across the stacking-cards section, before/after runtime-injected fix.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-stack'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}
async function setScroll(page, y) {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(120)
}
const tops = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const b = c.getBoundingClientRect(); const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); return { top: Math.round(b.top), bottom: Math.round(b.bottom), scale: +m.a.toFixed(3) } }))

async function sweep(page, label, vp) {
  const meta = await page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => ({ id: c.id, docTop: Math.round(c.getBoundingClientRect().top + scrollY), h: Math.round(c.offsetHeight), stickyTop: parseFloat(getComputedStyle(c).top), mb: getComputedStyle(c).marginBottom })))
  const nav = await page.evaluate(() => { const b = document.querySelector('#nav').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } })
  const contBottom = await page.evaluate(() => Math.round(document.querySelector('.stack-cards').getBoundingClientRect().bottom + scrollY))
  const y0 = meta[0].docTop - meta[0].stickyTop
  const yEnd = contBottom - 100
  const rows = []
  for (let y = y0 - 50; y <= yEnd + 200; y += 10) {
    await setScroll(page, y)
    rows.push({ y, t: await tops(page) })
  }
  // derive facts
  const card3PinRow = rows.find((r) => r.t[2].top <= 124)
  const fullStackRows = rows.filter((r) => r.t[0].top === 88 && r.t[1].top === 106 && r.t[2].top === 124)
  const card1FirstMoves = rows.find((r) => r.y > y0 && r.t[0].top < 88)
  const card2Pinned = rows.find((r) => r.t[1].top <= 106)
  const card2FirstMoves = rows.find((r) => card2Pinned && r.y > card2Pinned.y && r.t[1].top < 106)
  const holdRange = (() => { const pinned = rows.filter((r) => r.t[2].top === 124); return pinned.length ? { from: pinned[0].y, to: pinned[pinned.length - 1].y, px: pinned[pinned.length - 1].y - pinned[0].y } : null })()
  const r = { vp, meta, nav, contBottom, card3PinRow, card1FirstMoves: card1FirstMoves && { y: card1FirstMoves.y, dyBeforeCard3Pin: card3PinRow ? card3PinRow.y - card1FirstMoves.y : null, card3TopThen: card1FirstMoves.t[2].top }, card2FirstMoves: card2FirstMoves && { y: card2FirstMoves.y, card3TopThen: card2FirstMoves.t[2].top }, fullStackRowsCount: fullStackRows.length, card3HoldRange: holdRange, sample: rows.filter((_, i) => i % 5 === 0) }
  out[label] = r
  if (card3PinRow) {
    await setScroll(page, card3PinRow.y)
    await page.screenshot({ path: `${OUT}/${label}-card3pin.png` })
    await setScroll(page, card3PinRow.y - 120)
    await page.screenshot({ path: `${OUT}/${label}-card3pin-minus120.png` })
    await setScroll(page, card3PinRow.y + 150)
    await page.screenshot({ path: `${OUT}/${label}-card3pin-plus150.png` })
  }
  return r
}

for (const vp of [{ w: 1440, h: 900, n: 'desk' }, { w: 1280, h: 720, n: 'laptop' }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await sweep(page, vp.n + '-current', vp)

  // runtime-only experiment: apply the proposed fix in-page (no file edits)
  await page.evaluate(() => {
    const st = document.createElement('style')
    st.textContent = '.stack-card{margin-bottom:0!important}.stack-gap{height:12vh}.stack-tail{height:40vh}'
    document.head.appendChild(st)
    const wrap = document.querySelector('.stack-cards')
    const cards = Array.from(wrap.querySelectorAll('.stack-card'))
    cards.forEach((c, i) => { if (i < cards.length - 1) { const g = document.createElement('div'); g.className = 'stack-gap'; c.after(g) } })
    const tail = document.createElement('div'); tail.className = 'stack-tail'; wrap.appendChild(tail)
    window.ScrollTrigger && window.ScrollTrigger.refresh()
  })
  await page.waitForTimeout(500)
  await sweep(page, vp.n + '-fixed', vp)
  await ctx.close()
}
fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(out, null, 2))
for (const [k, v] of Object.entries(out)) {
  console.log('==', k, 'meta', JSON.stringify(v.meta), 'nav', JSON.stringify(v.nav), 'contBottom', v.contBottom)
  console.log('   card3PinRow', JSON.stringify(v.card3PinRow))
  console.log('   card1FirstMoves', JSON.stringify(v.card1FirstMoves), 'card2FirstMoves', JSON.stringify(v.card2FirstMoves))
  console.log('   fullStackRows', v.fullStackRowsCount, 'card3HoldRange', JSON.stringify(v.card3HoldRange))
}
await browser.close()

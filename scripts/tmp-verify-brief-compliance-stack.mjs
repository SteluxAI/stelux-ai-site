// Independent reproduction: sticky stacking cards - do cards 1/2 get pushed up before card 3 arrives, and does card 3 ever pin?
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/verify-brief-compliance'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const out = {}
async function setScroll(page, y) {
  await page.evaluate((y) => { if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); window.scrollTo(0, y) }, y)
  await page.waitForTimeout(250)
}
const tops = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.stack-card')).map((c) => { const b = c.getBoundingClientRect(); const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); return { top: Math.round(b.top), bottom: Math.round(b.bottom), scale: +m.a.toFixed(3), pos: getComputedStyle(c).position, mb: getComputedStyle(c).marginBottom } }))
for (const vp of [{ w: 1440, h: 900, n: 'desk' }, { w: 1024, h: 768, n: 'tab-land' }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const meta = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('.stack-card')).map((c) => ({ id: c.id, docTop: Math.round(c.getBoundingClientRect().top + scrollY), h: Math.round(c.offsetHeight), stickyTop: parseFloat(getComputedStyle(c).top), mb: getComputedStyle(c).marginBottom, pos: getComputedStyle(c).position }))
    const s = document.querySelector('.stack-cards').getBoundingClientRect()
    const nav = document.querySelector('header, nav, .nav, [class*="nav"]')
    const nb = nav ? nav.getBoundingClientRect() : null
    return { cards: cs, container: { docTop: Math.round(s.top + scrollY), docBottom: Math.round(s.bottom + scrollY), pb: getComputedStyle(document.querySelector('.stack-cards')).paddingBottom }, nav: nb ? { sel: nav.tagName + '.' + nav.className, top: Math.round(nb.top), bottom: Math.round(nb.bottom), pos: getComputedStyle(nav).position } : null, lenis: !!window.__lenis, vh: innerHeight }
  })
  const res = { vp, meta }
  const y3 = meta.cards[2].docTop - meta.cards[2].stickyTop // scrollY where card 3's natural top would sit at its sticky top
  // sweep from 400px before card3 pin to 600px after in 20px steps
  const sweep = []
  for (let y = y3 - 400; y <= y3 + 600; y += 20) {
    await setScroll(page, y)
    sweep.push({ y, dy: y - y3, t: (await tops(page)).map((c) => c.top) })
  }
  res.sweep = sweep
  // find first y (in sweep) where card1.top < 88 or card2.top < 106 (pushed up)
  res.firstPushCard1 = sweep.find((s) => s.t[0] < 87)
  res.firstPushCard2 = sweep.find((s) => s.t[1] < 105)
  // does the state 88/106/124 (+-2) ever appear?
  res.stackedStateSeen = sweep.filter((s) => Math.abs(s.t[0] - 88) <= 2 && Math.abs(s.t[1] - 106) <= 2 && Math.abs(s.t[2] - 124) <= 2).map((s) => s.y)
  // does card3 ever hold at 124 across 2 consecutive samples?
  res.card3HoldSamples = sweep.filter((s) => Math.abs(s.t[2] - 124) <= 2).map((s) => s.y)
  // screenshots
  for (const [label, y] of [['before-200', y3 - 200], ['before-100', y3 - 100], ['card3-at-124', y3], ['after-40', y3 + 40], ['after-120', y3 + 120]]) {
    await setScroll(page, y)
    res['tops_' + label] = await tops(page)
    await page.screenshot({ path: `${OUT}/${vp.n}-${label}.png` })
  }
  out[vp.n] = res
  await ctx.close()
}
await browser.close()
fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(out, null, 2))
for (const k of Object.keys(out)) {
  const r = out[k]
  console.log('==', k, JSON.stringify(r.meta))
  console.log('firstPushCard1', JSON.stringify(r.firstPushCard1), 'firstPushCard2', JSON.stringify(r.firstPushCard2))
  console.log('stackedStateSeen', JSON.stringify(r.stackedStateSeen), 'card3HoldSamples', JSON.stringify(r.card3HoldSamples))
  console.log('sweep', r.sweep.map((s) => `${s.dy}:${s.t.join('/')}`).join('  '))
  for (const l of ['before-200', 'before-100', 'card3-at-124', 'after-40', 'after-120']) console.log(l, JSON.stringify(r['tops_' + l].map((c) => [c.top, c.bottom, c.scale, c.pos, c.mb])))
}

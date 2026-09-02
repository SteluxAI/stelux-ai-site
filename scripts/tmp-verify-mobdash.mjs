import { chromium } from 'playwright'
import fs from 'node:fs'
const OUT = 'shots/verify-mobdash'
const browser = await chromium.launch()

// 1) local site @375: measure panel contents and ticker truncation over several sim ticks
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const r = await page.evaluate(() => {
    const bb = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top + scrollY), b: Math.round(b.bottom + scrollY), w: Math.round(b.width), h: Math.round(b.height) } }
    const t = document.querySelector('#dash-ticker')
    return {
      main: bb('.dash-main'), avatar: bb('.dash-avatar'), title: bb('#dash-title'), sub: bb('#dash-sub'), ticker: bb('#dash-ticker'), cta: bb('.dash-cta'),
      tickerText: t.textContent, tickerTruncated: t.scrollWidth > t.clientWidth, tickerSW: t.scrollWidth, tickerCW: t.clientWidth,
      side: getComputedStyle(document.querySelector('.dash-side')).display,
      widgets: [...document.querySelectorAll('.dash-widget')].map(e => getComputedStyle(e).display),
      heroH: document.querySelector('#hero').getBoundingClientRect().height,
      interactiveInPanel: [...document.querySelectorAll('.dash-main a, .dash-main button')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.textContent.trim()),
    }
  })
  // sample ticker over time
  const samples = []
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1650)
    samples.push(await page.evaluate(() => { const t = document.querySelector('#dash-ticker'); return { text: t.textContent, trunc: t.scrollWidth > t.clientWidth, live: document.querySelector('#term-live').textContent } }))
  }
  r.samples = samples
  r.emptyBelowCta = r.main.b - r.cta.b
  r.emptyAboveAvatar = r.avatar.t - r.main.t
  console.log('LOCAL', JSON.stringify(r, null, 1))
  // screenshot with the panel centered in view
  await page.evaluate((y) => scrollTo(0, y), r.main.t - 120)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/local-m-panel.png` })
  await page.close()
}

// 2) fora.so reference at 375 and 1440
for (const vp of [{ name: 'fora-m', width: 375, height: 812, isMobile: true, hasTouch: true }, { name: 'fora-d', width: 1440, height: 900 }]) {
  try {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 2 })
    await page.goto('https://fora.so/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `${OUT}/${vp.name}-0.png` })
    const info = await page.evaluate(() => ({ title: document.title, h: document.documentElement.scrollHeight }))
    console.log(vp.name, JSON.stringify(info))
    if (vp.isMobile) {
      for (const y of [400, 700, 1000]) {
        await page.evaluate((y) => scrollTo(0, y), y)
        await page.waitForTimeout(600)
        await page.screenshot({ path: `${OUT}/${vp.name}-${y}.png` })
      }
    }
    await page.close()
  } catch (e) { console.log(vp.name, 'ERR', e.message) }
}
await browser.close()

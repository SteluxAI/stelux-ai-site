// Content lens: collect all a[href], verify # targets exist, dump text of key sections, check counts/copy.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e))
page.on('console', (m) => { if (m.type() === 'error' || m.type()==='warning') errors.push(m.type()+': ' + m.text()) })
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const res = await page.evaluate(() => {
  const out = { anchors: [], missing: [], ids: [], dupIds: [], buttonsNoLabel: [], imgs: [], headings: [] }
  const seen = new Set()
  document.querySelectorAll('[id]').forEach((el) => { if (seen.has(el.id)) out.dupIds.push(el.id); seen.add(el.id); out.ids.push(el.id) })
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    const where = a.closest('header') ? 'nav' : a.closest('#mobile-menu') ? 'mobile-menu' : a.closest('footer') ? 'footer' : a.closest('section')?.id || 'body'
    const text = (a.getAttribute('aria-label') || a.textContent).trim().replace(/\s+/g, ' ')
    const rec = { where, text, href, target: a.target || '', rel: a.rel || '' }
    if (href.startsWith('#')) {
      const id = href.slice(1)
      rec.resolves = id === '' || !!document.getElementById(id)
      if (!rec.resolves) out.missing.push(rec)
    }
    out.anchors.push(rec)
  })
  document.querySelectorAll('button').forEach((b) => { if (!(b.getAttribute('aria-label') || b.textContent.trim())) out.buttonsNoLabel.push(b.outerHTML.slice(0, 120)) })
  document.querySelectorAll('img').forEach((i) => out.imgs.push({ src: i.getAttribute('src'), alt: i.getAttribute('alt'), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight }))
  document.querySelectorAll('h1,h2,h3').forEach((h) => out.headings.push(h.tagName + ' ' + h.textContent.trim().replace(/\s+/g, ' ')))
  out.products = [...document.querySelectorAll('#products .product')].map((p) => ({
    tag: p.tagName, href: p.getAttribute('href'), target: p.getAttribute('target'), rel: p.getAttribute('rel'),
    status: p.querySelector('.status-live,.status-soon')?.textContent.trim().replace(/\s+/g, ' '),
    h3: p.querySelector('h3')?.textContent.trim(), p: p.querySelector('p')?.textContent.trim().replace(/\s+/g, ' '),
    cta: p.querySelector('.product-cta')?.textContent.trim().replace(/\s+/g, ' '),
  }))
  out.stats = [...document.querySelectorAll('#products .about-stat')].map((s) => s.textContent.trim().replace(/\s+/g, ' '))
  out.footerLegal = document.querySelector('footer .mt-12')?.textContent.trim().replace(/\s+/g, ' ')
  out.status = document.querySelector('footer .live-dot')?.parentElement.textContent.trim()
  out.dashLive = document.querySelector('#term-live')?.textContent
  out.dashTitle = document.querySelector('#dash-title')?.textContent + ' / ' + document.querySelector('#dash-sub-text')?.textContent
  out.docTitle = document.title
  return out
})
console.log('== document.title:', res.docTitle)
console.log('== ids:', res.ids.join(', '))
console.log('== duplicate ids:', res.dupIds)
console.log('== anchors (' + res.anchors.length + ')')
for (const a of res.anchors) console.log(`  [${a.where}] "${a.text}" -> ${a.href}${a.href.startsWith('#') ? (a.resolves ? '  OK' : '  MISSING') : ''}${a.target ? ' target=' + a.target : ''}${a.rel ? ' rel=' + a.rel : ''}`)
console.log('== missing # targets:', res.missing)
console.log('== buttons without label:', res.buttonsNoLabel)
console.log('== imgs:', res.imgs)
console.log('== headings:'); res.headings.forEach((h) => console.log('  ' + h))
console.log('== products:'); res.products.forEach((p) => console.log(JSON.stringify(p)))
console.log('== stats:', res.stats)
console.log('== footer legal:', res.footerLegal)
console.log('== status badge:', res.status)
console.log('== dash:', res.dashLive, '|', res.dashTitle)
console.log('== errors:', errors)
fs.mkdirSync('shots/content', { recursive: true })
for (const id of ['products', 'showcase', 'telemetry', 'pricing', 'contact']) {
  const el = await page.$('#' + id)
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500)
  await el.screenshot({ path: `shots/content/section-${id}.png` })
}
// dashboard views
await page.evaluate(() => { if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true, force: true, lock: true }); window.scrollTo(0, 0) })
await page.waitForTimeout(800)
const views = {}
for (const v of ['overview', 'agents', 'tasks', 'data', 'compute', 'logs', 'products']) {
  await page.click(`.dash-nav[data-view="${v}"]`); await page.waitForTimeout(450)
  views[v] = await page.evaluate(() => document.querySelector('#dash-title').textContent + ' | ' + document.querySelector('#dash-sub').textContent.trim().replace(/\s+/g, ' '))
}
console.log('== dashboard views:', views)
await page.click('.dash-nav[data-view="overview"]')
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/content/hero-top.png' })
await page.$('#terminal').then((t) => t.screenshot({ path: 'shots/content/hero-dashboard.png' }))
// OG candidate render for comparison with public/og.png (does NOT touch public/)
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await og.goto(BASE, { waitUntil: 'networkidle' })
await og.addStyleTag({ content: 'header{display:none!important} .hero-content{padding-top:150px!important}' })
await og.waitForTimeout(1500)
await og.screenshot({ path: 'shots/content/og-candidate-1200x630.png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
await browser.close()
console.log('done')

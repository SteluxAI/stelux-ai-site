// READ-ONLY probe for the a11y/perf review lens. Writes only to shots/a11y-perf/.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = 'shots/a11y-perf'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const log = (...a) => console.log(...a)

const perfInit = () => {
  window.__m = { fcp: null, lcp: null, lcpEl: null, cls: 0, shifts: [], longTasks: [] }
  const nm = (n) => n ? n.tagName + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '') : '?'
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime })).observe({ type: 'paint', buffered: true })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__m.lcp = e.startTime; window.__m.lcpEl = nm(e.element) + (e.url ? ' ' + e.url.split('/').pop() : '') })).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) { window.__m.cls += e.value; window.__m.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources || []).map((s) => nm(s.node)).slice(0, 3) }) } })).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__m.longTasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true })
}

async function runLoad({ name, viewport, mobile, throttle, cpu, reduced }) {
  const ctx = await browser.newContext({ viewport, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 3 : 1, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  if (throttle) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: throttle.latency, downloadThroughput: throttle.down, uploadThroughput: throttle.up })
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  const reqs = new Map()
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, type: e.type, bytes: 0, start: e.timestamp }))
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp } })
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) r.failed = e.errorText })
  await page.addInitScript(perfInit)
  await page.goto(BASE, { waitUntil: 'load' })
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ttfb: Math.round(n.responseStart) } })
  await page.waitForTimeout(3500)
  const m = await page.evaluate(() => window.__m)
  const fonts = await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`))
  const list = Array.from(reqs.values())
  const total = list.reduce((s, r) => s + (r.bytes || 0), 0)
  const byType = {}
  list.forEach((r) => { const k = r.type || '?'; byType[k] = byType[k] || { n: 0, bytes: 0 }; byType[k].n++; byType[k].bytes += r.bytes || 0 })
  log(`\n=== LOAD [${name}] ===`)
  log(`requests=${list.length} totalTransfer=${(total / 1024).toFixed(0)} KB  ttfb=${nav.ttfb} DCL=${nav.dcl} load=${nav.load} FCP=${m.fcp && Math.round(m.fcp)} LCP=${m.lcp && Math.round(m.lcp)} (${m.lcpEl}) CLS=${m.cls.toFixed(4)} longTasks=${m.longTasks.length} (${m.longTasks.map((t) => t.d + 'ms@' + t.t).join(', ')})`)
  log('byType:', JSON.stringify(byType))
  list.sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 14).forEach((r) => log(`  ${String((r.bytes / 1024).toFixed(0)).padStart(6)} KB ${String(r.type).padEnd(10)} ${r.url.replace(BASE, '/').slice(0, 90)}${r.failed ? ' FAILED ' + r.failed : ''}${r.end ? ' done@' + Math.round((r.end - r.start) * 1000) + 'ms' : ''}`))
  log('fonts loaded:', fonts.join(' | '))
  if (m.shifts.length) log('shifts:', JSON.stringify(m.shifts.slice(0, 6)))
  await ctx.close()
}

await runLoad({ name: 'desktop 1440 unthrottled', viewport: { width: 1440, height: 900 } })
await runLoad({ name: 'mobile 375 @3x, 1.6Mbps/150ms, CPU 4x', viewport: { width: 375, height: 812 }, mobile: true, throttle: { latency: 150, down: 1.6 * 1024 * 1024 / 8, up: 750 * 1024 / 8 }, cpu: 4 })
await runLoad({ name: 'desktop 1440, 4Mbps/100ms', viewport: { width: 1440, height: 900 }, throttle: { latency: 100, down: 4 * 1024 * 1024 / 8, up: 1024 * 1024 / 8 } })

/* ---------- main-thread work while idle ---------- */
async function idleWork({ name, viewport, mobile, cpu, reduced, scrollTo, style }) {
  const ctx = await browser.newContext({ viewport, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 3 : 1, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await cdp.send('Performance.enable')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  if (style) await page.addStyleTag({ content: style })
  if (scrollTo) await page.evaluate((sel) => { const y = document.querySelector(sel).getBoundingClientRect().top + scrollY - 100; if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true }); scrollTo(0, y) }, scrollTo)
  await page.waitForTimeout(2500)
  const get = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const a = await get()
  const rafN = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n) }; requestAnimationFrame(f) }))
  const b = await get()
  const dt = b.Timestamp - a.Timestamp
  const pct = (k) => ((b[k] - a[k]) / dt * 100).toFixed(1) + '%'
  log(`[idle ${name}] over ${dt.toFixed(1)}s: task=${pct('TaskDuration')} script=${pct('ScriptDuration')} layout=${pct('LayoutDuration')} style=${pct('RecalcStyleDuration')} layouts/s=${((b.LayoutCount - a.LayoutCount) / dt).toFixed(1)} styleRecalcs/s=${((b.RecalcStyleCount - a.RecalcStyleCount) / dt).toFixed(1)} rAF/s=${(rafN / 4).toFixed(0)}`)
  await ctx.close()
}
await idleWork({ name: 'desktop hero in view', viewport: { width: 1440, height: 900 } })
await idleWork({ name: 'desktop hero in view, reduced-motion', viewport: { width: 1440, height: 900 }, reduced: true })
await idleWork({ name: 'desktop at #telemetry', viewport: { width: 1440, height: 900 }, scrollTo: '#telemetry' })
await idleWork({ name: 'mobile hero in view CPU4x', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4 })
await idleWork({ name: 'mobile hero CPU4x, no backdrop-filter', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4, style: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' })
await idleWork({ name: 'mobile hero CPU4x, no grain blend', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4, style: '.grain::after{display:none!important}' })
await idleWork({ name: 'mobile hero CPU4x, sky canvas hidden', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4, style: '#aurora{display:none!important}' })

/* ---------- scroll frame timing ---------- */
async function scrollFrames({ name, viewport, mobile, cpu, style }) {
  const ctx = await browser.newContext({ viewport, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 3 : 1 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  if (style) await page.addStyleTag({ content: style })
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => new Promise((res) => {
    const max = document.documentElement.scrollHeight - innerHeight
    const frames = []; let last = performance.now(); const t0 = last
    const D = 6000
    const f = () => {
      const now = performance.now(); frames.push(now - last); last = now
      const p = (now - t0) / D
      const y = max * p
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y)
      if (p < 1) requestAnimationFrame(f); else res(frames.slice(2))
    }
    requestAnimationFrame(f)
  }))
  const avg = r.reduce((a, b) => a + b, 0) / r.length
  const slow = r.filter((d) => d > 33).length
  const p95 = r.slice().sort((a, b) => a - b)[Math.floor(r.length * 0.95)]
  log(`[scroll ${name}] frames=${r.length} avg=${avg.toFixed(1)}ms (${(1000 / avg).toFixed(0)} fps) p95=${p95.toFixed(1)}ms max=${Math.max(...r).toFixed(0)}ms frames>33ms=${slow} (${(slow / r.length * 100).toFixed(0)}%)`)
  await ctx.close()
}
await scrollFrames({ name: 'desktop 1440', viewport: { width: 1440, height: 900 } })
await scrollFrames({ name: 'mobile 375 CPU4x', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4 })
await scrollFrames({ name: 'mobile 375 CPU4x no backdrop-filter', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4, style: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' })
await scrollFrames({ name: 'mobile 375 CPU4x no grain', viewport: { width: 375, height: 812 }, mobile: true, cpu: 4, style: '.grain::after{display:none!important}' })

/* ---------- a11y tree audit ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const a = await page.evaluate(() => {
    const out = {}
    const nm = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]
    out.headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => h.tagName + ': ' + h.textContent.trim().replace(/\s+/g, ' ').slice(0, 50))
    out.h1count = document.querySelectorAll('h1').length
    out.imgsNoAlt = Array.from(document.images).filter((i) => !i.hasAttribute('alt')).map((i) => i.src)
    out.imgDims = Array.from(document.images).map((i) => ({ src: i.src.split('/').pop(), attrW: i.getAttribute('width'), attrH: i.getAttribute('height'), natural: i.naturalWidth + 'x' + i.naturalHeight, rendered: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height), loading: i.loading, fetchpriority: i.getAttribute('fetchpriority'), srcset: i.srcset || null }))
    out.buttonsNoName = Array.from(document.querySelectorAll('button')).filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).map((b) => b.outerHTML.slice(0, 80))
    out.liveRegions = Array.from(document.querySelectorAll('[aria-live]')).map((e) => e.id + ' ' + e.getAttribute('aria-live'))
    out.tabs = Array.from(document.querySelectorAll('.code-tab, .dash-nav')).map((b) => ({ cls: b.className, role: b.getAttribute('role'), sel: b.getAttribute('aria-selected'), pressed: b.getAttribute('aria-pressed'), current: b.getAttribute('aria-current') }))
    out.tabRoles = { tablist: document.querySelectorAll('[role=tablist]').length, tab: document.querySelectorAll('[role=tab]').length, tabpanel: document.querySelectorAll('[role=tabpanel]').length }
    out.svgNoHidden = Array.from(document.querySelectorAll('svg')).filter((s) => !s.closest('[aria-hidden="true"]') && s.getAttribute('aria-hidden') !== 'true' && !s.querySelector('title')).map((s) => nm(s.parentElement)).slice(0, 8)
    out.svgNoHiddenCount = Array.from(document.querySelectorAll('svg')).filter((s) => !s.closest('[aria-hidden="true"]') && s.getAttribute('aria-hidden') !== 'true' && !s.querySelector('title')).length
    out.svgTotal = document.querySelectorAll('svg').length
    out.titleOnly = Array.from(document.querySelectorAll('[title]')).map((e) => nm(e) + ' title=' + e.title).slice(0, 6)
    out.skipLink = !!document.querySelector('a[href="#main"], a[href="#top"].skip, .skip-link')
    out.landmarks = { main: document.querySelectorAll('main').length, nav: document.querySelectorAll('nav').length, footer: document.querySelectorAll('footer').length, header: document.querySelectorAll('header').length }
    out.backdrop = Array.from(document.querySelectorAll('*')).filter((e) => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') }).map(nm)
    out.willChange = Array.from(document.querySelectorAll('*')).filter((e) => getComputedStyle(e).willChange !== 'auto').map((e) => nm(e) + ' [' + getComputedStyle(e).willChange + '] ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))
    out.smil = { animateMotion: document.querySelectorAll('animateMotion').length, animate: document.querySelectorAll('animate').length }
    out.smallText = [...new Set(Array.from(document.querySelectorAll('body *')).filter((e) => { const s = getComputedStyle(e); const fs = parseFloat(s.fontSize); return fs > 0 && fs < 10 && Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 0 }).map((e) => `${nm(e)} ${getComputedStyle(e).fontSize} "${e.textContent.trim().slice(0, 18)}"`))].slice(0, 12)
    const alphaUse = {}
    Array.from(document.querySelectorAll('body *')).forEach((e) => {
      if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return
      if (e.closest('[hidden]')) return
      const c = getComputedStyle(e).color
      const m = c.match(/rgba\(255, 255, 255, ([\d.]+)\)/)
      if (m && +m[1] <= 0.5) { const k = m[1]; alphaUse[k] = alphaUse[k] || { n: 0, ex: [] }; alphaUse[k].n++; if (alphaUse[k].ex.length < 5) alphaUse[k].ex.push(getComputedStyle(e).fontSize + ' "' + e.textContent.trim().replace(/\s+/g, ' ').slice(0, 34) + '"') }
    })
    out.alphaUse = alphaUse
    out.menuBtn = document.getElementById('menu-btn').outerHTML.slice(0, 160)
    out.menuInert = document.getElementById('mobile-menu').hasAttribute('inert') || !!document.querySelector('main[inert]')
    return out
  })
  log('\n=== A11Y AUDIT ===')
  for (const [k, v] of Object.entries(a)) log(k + ':', JSON.stringify(v))
  const ticks = await page.evaluate(() => new Promise((res) => { let n = 0; const t = document.getElementById('dash-ticker'); new MutationObserver(() => n++).observe(t, { childList: true, characterData: true, subtree: true }); setTimeout(() => res(n), 10000) }))
  log(`aria-live #dash-ticker DOM mutations in 10s: ${ticks}`)
  // keyboard: tab order & focus visibility
  await page.keyboard.press('Tab')
  const seq = []
  for (let i = 0; i < 26; i++) {
    const d = await page.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { d: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] + ' "' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 22)) + '"', vis: r.width > 0 && s.visibility !== 'hidden', outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor, y: Math.round(r.top + scrollY) } })
    seq.push(d)
    if (d.d.includes('dash-cta')) await page.screenshot({ path: `${OUT}/focus-dash-cta.png` })
    if (d.d.includes('dash-nav') && !seq.slice(0, -1).some((s) => s.d.includes('dash-nav'))) await page.screenshot({ path: `${OUT}/focus-dash-nav.png` })
    if (d.d.includes('nav-link') && !seq.slice(0, -1).some((s) => s.d.includes('nav-link'))) await page.screenshot({ path: `${OUT}/focus-nav-link.png`, clip: { x: 300, y: 0, width: 840, height: 90 } })
    await page.keyboard.press('Tab')
  }
  log('tab order:\n  ' + seq.map((s) => s.d + (s.vis ? '' : ' [INVISIBLE]') + ' ' + s.outline).join('\n  '))
  await ctx.close()
}

/* ---------- mobile menu keyboard/focus behaviour ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.click('#menu-btn')
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => ({ active: document.activeElement.id || document.activeElement.tagName, menuHidden: document.getElementById('mobile-menu').hidden, mainInert: document.querySelector('main').inert, ariaExpanded: document.getElementById('menu-btn').getAttribute('aria-expanded') }))
  // tab 3 times and see where focus lands
  const seq = []
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => { const e = document.activeElement; return (e.closest('#mobile-menu') ? '[menu] ' : '[behind] ') + e.tagName.toLowerCase() + ' "' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20)) + '"' })) }
  log('\n=== MOBILE MENU ===', JSON.stringify(r), '\n  tab after open:', seq.join(' -> '))
  await page.screenshot({ path: `${OUT}/mobile-menu-open.png` })
  await ctx.close()
}

/* ---------- reduced motion behaviour ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const r = await page.evaluate(async () => {
    const out = {}
    out.lenis = !!window.__lenis
    const c = document.querySelector('#agents animateMotion').parentElement
    const p1 = c.getBoundingClientRect(); await new Promise((r) => setTimeout(r, 600)); const p2 = c.getBoundingClientRect()
    out.smilMoving = Math.abs(p1.left - p2.left) + Math.abs(p1.top - p2.top) > 1
    out.svgPaused = document.querySelector('#agents svg').animationsPaused()
    const cv = document.getElementById('aurora'); const d1 = cv.toDataURL(); await new Promise((r) => setTimeout(r, 700)); out.skyChanging = cv.toDataURL() !== d1
    out.cssAnimations = document.getAnimations().length
    out.running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.animationName || a.constructor.name) + ' ' + a.effect.getTiming().duration + 'ms x' + a.effect.getTiming().iterations).slice(0, 8)
    const t = document.getElementById('dash-ticker'); const t1 = t.textContent; await new Promise((r) => setTimeout(r, 2000)); out.tickerChanged = t.textContent !== t1
    return out
  })
  log('\n=== REDUCED MOTION ===', JSON.stringify(r))
  await page.evaluate(() => scrollTo(0, document.getElementById('telemetry').offsetTop - 100))
  await page.waitForTimeout(800)
  const counters = await page.evaluate(() => Array.from(document.querySelectorAll('[data-count]')).map((e) => e.textContent))
  log('reduced-motion counters:', counters.join(' | '))
  await ctx.close()
}

/* ---------- contrast sampling ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.addStyleTag({ content: '.dash-gradient::after{animation:none!important;transform:translate(0,0)!important} .live-dot{animation:none!important} .grain::after{display:none!important} *{transition:none!important}' })
  const targets = [
    ['#dash-title', 'dash title'], ['#dash-sub-text', 'dash sub'], ['#term-live', 'dash live'], ['#dash-ticker', 'dash ticker'],
    ['.dash-cta', 'dash cta'], ['.dash-widget-title span:first-child', 'widget title white45'], ['.dash-widget .text-white\\/45 span:first-child', 'widget burst caption'],
    ['.dash-side .text-white\\/35 div', 'sidebar ws'], ['.pill', 'hero pill'], ['.hero-copy p', 'hero sub'], ['.stat-label', 'stat label white45'],
    ['.product-cta.muted', 'in development white40'], ['.card-index', 'card index white35'], ['#telemetry .text-white\\/30', 'demo telemetry note white30'],
    ['.step .meta', 'step meta white30'], ['footer .text-white\\/40', 'footer heading white40'], ['.foot-link', 'footer link white50'], ['.chip', 'chip white45'],
    ['.about-stat p', 'about stat p white55'], ['.code-tab:not(.active)', 'code tab white50'], ['.nav-link', 'nav link white65'], ['#run-status', 'run status'],
    ['.product-p', 'product p white60'], ['.lead', 'lead white60'], ['.code .c', 'code comment white35'], ['.status-soon', 'coming soon badge white45'], ['footer .border-t div', 'copyright white40'],
  ]
  const rows = []
  for (const [sel, label] of targets) {
    const info = await page.evaluate((sel) => {
      const e = document.querySelector(sel); if (!e) return null
      e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const s = getComputedStyle(e)
      return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, color: s.color, fs: s.fontSize, fw: s.fontWeight, text: e.textContent.trim().slice(0, 30) }
    }, sel)
    if (!info || info.w < 2) { rows.push({ label, err: 'not found' }); continue }
    await page.evaluate((sel) => { const e = document.querySelector(sel); e.style.color = 'transparent'; e.style.textShadow = 'none'; e.querySelectorAll('*').forEach((c) => (c.style.color = 'transparent')) }, sel)
    await page.waitForTimeout(150)
    const buf = await page.screenshot({ fullPage: true, clip: { x: Math.max(0, info.x), y: info.y, width: Math.max(1, Math.min(info.w, 1440 - info.x)), height: Math.max(1, info.h) } })
    const file = `${OUT}/bg-${label.replace(/[^a-z0-9]+/gi, '_')}.png`
    fs.writeFileSync(file, buf)
    await page.evaluate((sel) => { const e = document.querySelector(sel); e.style.color = ''; e.style.textShadow = ''; e.querySelectorAll('*').forEach((c) => (c.style.color = '')) }, sel)
    rows.push({ label, file, color: info.color, fs: info.fs, fw: info.fw, text: info.text })
  }
  fs.writeFileSync(`${OUT}/contrast-targets.json`, JSON.stringify(rows, null, 1))
  log('\ncontrast targets written:', rows.length)
  // focus ring on dash-cta: sample bg around it
  await page.evaluate(() => { const e = document.querySelector('.dash-cta'); e.scrollIntoView({ block: 'center' }) })
  const cta = await page.evaluate(() => { const r = document.querySelector('.dash-cta').getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height } })
  fs.writeFileSync(`${OUT}/bg-focus-ring-area.png`, await page.screenshot({ fullPage: true, clip: { x: cta.x - 8, y: cta.y - 8, width: cta.w + 16, height: 8 } }))
  await ctx.close()
}
await browser.close()

// Visual verification loop: screenshots at 1440px and 375px across 0/25/50/75/100% scroll depth,
// plus an automated audit for horizontal overflow, clipped text and text collisions.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.SHOT_URL || 'http://localhost:4173/'
const OUT = process.env.SHOT_DIR || 'shots'
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812, isMobile: true, hasTouch: true },
]
const DEPTHS = process.env.SHOT_DEPTHS ? process.env.SHOT_DEPTHS.split(',').map(Number) : [0, 0.25, 0.5, 0.75, 1]

fs.mkdirSync(OUT, { recursive: true })

function auditPage() {
  const vw = innerWidth, vh = innerHeight
  const doc = document.documentElement
  const out = {
    docScrollWidth: doc.scrollWidth,
    hOverflow: doc.scrollWidth > vw + 1,
    offenders: [],
    textClips: [],
    collisions: [],
  }
  const cs = (el) => getComputedStyle(el)
  const visible = (el) => {
    const s = cs(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05
  }
  const desc = (el) => {
    const id = el.id ? '#' + el.id : ''
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ''}`
  }
  const inViewport = (r) => r.bottom > 0 && r.top < vh
  const all = Array.from(document.querySelectorAll('body *'))
  const textish = []
  for (const el of all) {
    if (el.closest('[data-allow-overflow], svg, canvas')) continue
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || !inViewport(r)) continue
    if (r.right > vw + 2 || r.left < -2) {
      out.offenders.push({ el: desc(el), left: Math.round(r.left), right: Math.round(r.right), vw })
    }
    const tag = el.tagName
    if (/^(H1|H2|H3|H4|P|A|BUTTON|SPAN|LI|DT|DD|CODE|LABEL|SMALL|STRONG|EM|DIV)$/.test(tag) && el.textContent.trim()) {
      const hasTextNode = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
      if (hasTextNode) {
        const s = cs(el)
        if (el.scrollWidth > el.clientWidth + 3 && s.display !== 'inline' && !/auto|scroll/.test(s.overflowX) && s.textOverflow !== 'ellipsis') {
          out.textClips.push({ el: desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })
        }
        if (/^(H1|H2|H3|H4|P|A|BUTTON|LI|LABEL)$/.test(tag)) textish.push({ el, r })
      }
    }
  }
  // pairwise collision check for text-bearing elements that are not ancestors of each other
  const stackOf = (el) => el.closest('.stack-card')
  for (let i = 0; i < textish.length && i < 400; i++) {
    for (let j = i + 1; j < textish.length && j < 400; j++) {
      const a = textish[i], b = textish[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      if (a.el.closest('header, #mobile-menu') || b.el.closest('header, #mobile-menu')) continue
      const sa = stackOf(a.el), sb = stackOf(b.el)
      if (sa && sb && sa !== sb) continue
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (ox > 6 && oy > 6) {
        out.collisions.push({ a: desc(a.el), b: desc(b.el), ox: Math.round(ox), oy: Math.round(oy) })
        if (out.collisions.length > 25) break
      }
    }
  }
  return out
}

const browser = await chromium.launch()
const report = []
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
    reducedMotion: 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()))
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  for (const d of DEPTHS) {
    const y = await page.evaluate((d) => {
      const max = document.documentElement.scrollHeight - innerHeight
      const y = Math.round(max * d)
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true, lock: true })
      window.scrollTo(0, y)
      return y
    }, d)
    await page.waitForTimeout(1500)
    const audit = await page.evaluate(auditPage)
    const file = path.join(OUT, `${vp.name}-${Math.round(d * 100)}.png`)
    await page.screenshot({ path: file })
    report.push({ vp: vp.name, depth: d, y, file, ...audit })
    const flag = audit.hOverflow || audit.offenders.length || audit.textClips.length || audit.collisions.length ? '!!' : 'ok'
    console.log(`[${flag}] ${vp.name} ${Math.round(d * 100)}% y=${y} overflow=${audit.hOverflow} offenders=${audit.offenders.length} clips=${audit.textClips.length} collisions=${audit.collisions.length}`)
  }
  report.push({ vp: vp.name, errors })
  if (errors.length) console.log(`[errors] ${vp.name}:\n  ` + errors.join('\n  '))
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
const issues = report.filter((r) => r.depth !== undefined && (r.hOverflow || r.offenders?.length || r.textClips?.length || r.collisions?.length))
if (issues.length) {
  console.log('\nISSUE DETAILS:')
  for (const r of issues) {
    console.log(`- ${r.vp} ${Math.round(r.depth * 100)}%`)
    if (r.hOverflow) console.log(`  hOverflow: scrollWidth=${r.docScrollWidth}`)
    r.offenders.slice(0, 8).forEach((o) => console.log(`  offender: ${o.el} [${o.left}..${o.right}] vw=${o.vw}`))
    r.textClips.slice(0, 8).forEach((o) => console.log(`  clip: ${o.el} ${o.scrollWidth}>${o.clientWidth}`))
    r.collisions.slice(0, 8).forEach((o) => console.log(`  collision: ${o.a} <> ${o.b} (${o.ox}x${o.oy})`))
  }
}
console.log(`\nDone. ${report.length - VIEWPORTS.length} screenshots in ${OUT}/`)

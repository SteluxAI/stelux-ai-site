import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import heroProfiles from './data/hero-foreground-profiles.json'

gsap.registerPlugin(ScrollTrigger)
ScrollTrigger.config({ ignoreMobileResize: true })

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches
const isMobile = () => innerWidth < 768
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))
const rand = (a, b) => a + Math.random() * (b - a)
const randi = (a, b) => Math.floor(rand(a, b + 1))
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const cssNum = (name, fallback) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback

if (reduceMotion) $$('svg').forEach((s) => s.pauseAnimations && s.pauseAnimations())

/* ---------------- smooth scroll ---------------- */
let lenis = null
if (!reduceMotion) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.095, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  window.__lenis = lenis
}
const cards = $$('.stack-card')
function naturalTop(el) {
  // sticky cards report their pinned position; rebuild the in-flow position from the container instead
  if (el.classList.contains('stack-card')) {
    const wrap = el.parentElement
    const idx = cards.indexOf(el)
    const gap = parseFloat(getComputedStyle(wrap).rowGap) || 0
    let y = wrap.getBoundingClientRect().top + scrollY
    for (let i = 0; i < idx; i++) y += cards[i].offsetHeight + gap
    return y
  }
  return el.getBoundingClientRect().top + scrollY
}
function scrollToTarget(target) {
  const isCard = target.classList.contains('stack-card')
  const offset = isCard && innerWidth >= 1024 ? cssNum('--stack-top', 88) + 18 * (+target.style.getPropertyValue('--i') || 0) : 96
  const y = Math.max(0, naturalTop(target) - offset)
  if (lenis) lenis.scrollTo(y, { duration: 1.1 })
  else window.scrollTo({ top: y, behavior: 'auto' })
}
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target.closest('a[href^="#"]')
  if (!a) return
  const id = a.getAttribute('href').slice(1)
  const target = id ? document.getElementById(id) : document.body
  if (!target) return
  e.preventDefault()
  closeMenu()
  scrollToTarget(target)
  history.replaceState(null, '', '#' + id)
})

/* ---------------- nav + mobile menu ---------------- */
const nav = $('#nav')
const menuBtn = $('#menu-btn')
const menu = $('#mobile-menu')
const mainEl = $('main'), footEl = $('footer')
function syncNav() { nav.classList.toggle('scrolled', scrollY > 24) }
addEventListener('scroll', syncNav, { passive: true })
syncNav()
function openMenu() {
  menu.hidden = false
  menuBtn.setAttribute('aria-expanded', 'true')
  menuBtn.setAttribute('aria-label', 'Close menu')
  mainEl.inert = true; footEl.inert = true
  lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
  menu.querySelector('a')?.focus({ preventScroll: true })
}
function closeMenu() {
  if (menu.hidden) return
  menu.hidden = true
  menuBtn.setAttribute('aria-expanded', 'false')
  menuBtn.setAttribute('aria-label', 'Open menu')
  mainEl.inert = false; footEl.inert = false
  lenis?.start()
  document.documentElement.style.overflow = ''
  menuBtn.focus({ preventScroll: true })
}
menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()))
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu() })
addEventListener('resize', () => { if (!isMobile()) closeMenu() })

/* ---------------- hero v4 scene ----------------
   Measured on fora.so (1440x900, scrollY 0 -> 720): extra downward shift per scrolled px is
   far 0.31, near hills 0.17, panel 0.20, foreground 0. Each track owns its own transform.
   The panel lag is capped so the foreground keeps CTA_CLEARANCE px clear of the CTA, using the
   foreground alpha profile (first visible row per column) over the CTA's x-range. */
const hero = $('#hero')
const sceneTracks = $$('[data-scene-rate]')
const panelTrack = $('.hero-panel-track')
const foregroundImg = $('.hero-layer-foreground img')
const panelCTA = $('.dash-cta')
const CTA_CLEARANCE = 24
let heroTop = 0, heroHeight = 0, panelMaxLag = Infinity, panelShiftNow = 0
function measureScene() {
  heroTop = hero.getBoundingClientRect().top + scrollY
  heroHeight = hero.offsetHeight
  const variant = /foreground-mobile\./i.test(foregroundImg.currentSrc || foregroundImg.src) ? 'mobile' : 'desktop'
  const profile = heroProfiles[variant]
  const fb = foregroundImg.getBoundingClientRect(), cb = panelCTA.getBoundingClientRect()
  panelMaxLag = Infinity
  if (profile && fb.width > 0 && fb.height > 0 && cb.width > 0) {
    const left = Math.max(cb.left, fb.left), right = Math.min(cb.right, fb.right)
    let minCrest = Infinity
    if (right > left) {
      const c0 = Math.max(0, Math.floor((left - fb.left) / fb.width * profile.width))
      const c1 = Math.min(profile.width - 1, Math.ceil((right - fb.left) / fb.width * profile.width) - 1)
      for (let x = c0; x <= c1; x++) {
        const row = profile.firstVisibleRow[x]
        if (Number.isFinite(row) && row < profile.height) minCrest = Math.min(minCrest, fb.top + row / profile.height * fb.height)
      }
    }
    // both screen coordinates carry the same -scrollY; subtract our own panel shift so the cap does not feed back
    if (Number.isFinite(minCrest)) panelMaxLag = Math.max(0, minCrest - (cb.bottom - panelShiftNow) - CTA_CLEARANCE)
  }
  window.__heroScene = { heroTop, heroHeight, panelMaxLag, variant }
  drawScene()
}
function drawScene() {
  if (reduceMotion) return
  const s = Math.max(0, Math.min(heroHeight, scrollY - heroTop))
  for (const track of sceneTracks) {
    const rate = Number(track.dataset.sceneRate)
    let shift = s * rate
    if (track === panelTrack) { shift = Math.min(shift, panelMaxLag); panelShiftNow = shift }
    track.style.transform = shift ? `translate3d(0, ${shift.toFixed(2)}px, 0)` : ''
  }
}
if (!reduceMotion) {
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: drawScene, onRefresh: measureScene })
  addEventListener('scroll', drawScene, { passive: true })
  new ResizeObserver(() => measureScene()).observe(hero)
  $$('.hero-layer img').forEach((img) => { if (img.complete) measureScene(); else img.addEventListener('load', measureScene, { once: true }) })
  document.fonts?.ready.then(measureScene)
  addEventListener('load', measureScene)
  addEventListener('orientationchange', () => setTimeout(measureScene, 300))
  gsap.to('.hero-copy', { y: -70, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '55% top', scrub: true } })

  // entrance (fora: layers rise into place, staggered by depth; copy and panel fade in). Inner elements only,
  // so the scroll tracks above and the hover tilt on .terminal-inner keep exclusive ownership of their transforms.
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
  intro.from('.hero-layer-far picture', { y: 70, duration: 1.2, clearProps: 'transform' }, 0)
    .from('.hero-layer-hills picture', { y: 47, duration: 1.2, clearProps: 'transform' }, 0)
    .from('.hero-layer-foreground picture', { y: 35, duration: 1.2, clearProps: 'transform' }, 0)
    .from('.hero-copy > *', { y: 18, opacity: 0, duration: 0.9, stagger: 0.08, clearProps: 'transform,opacity' }, 0.05)
    .from('#terminal', { y: 40, opacity: 0, duration: 1.1, clearProps: 'transform,opacity' }, 0.25)
}

/* ---------------- dashboard: tilt, views, live simulation ---------------- */
const termInner = $('.terminal-inner')
if (canHover && !reduceMotion) {
  const term = $('#terminal')
  term.addEventListener('mousemove', (e) => {
    const r = term.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    termInner.style.transform = `rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 4).toFixed(2)}deg)`
  })
  term.addEventListener('mouseleave', () => { termInner.style.transform = '' })
}

const VIEWS = {
  overview: { title: 'Stelux Orchestrator', sub: 'research-desk' },
  agents: { title: 'Swarm · research-desk', sub: 'planner · analyst ×4 · critic' },
  tasks: { title: 'Task queue', sub: '23 queued · 4 checkpoints pending' },
  data: { title: 'Lakebase · finance/filings', sub: '1,204 tables · 38 streams' },
  compute: { title: 'Compute pool', sub: '8× H100 local · 4× A100 burst' },
  logs: { title: 'Event stream', sub: 'tail -f · 9 sources' },
  products: { title: 'Stelux products', sub: '2 live · 2 in development' },
}
const dashMain = $('#dash-main'), dashTitle = $('#dash-title'), dashSubText = $('#dash-sub-text')
$$('.dash-nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view
    const v = VIEWS[view] || VIEWS.overview
    $$('.dash-nav').forEach((b) => b.classList.toggle('active', b === btn))
    dashMain.dataset.view = view
    dashTitle.textContent = v.title
    dashSubText.textContent = v.sub
    if (!reduceMotion) gsap.fromTo([dashTitle, dashSubText], { opacity: 0.2, y: 4 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'all' })
    if (!reduceMotion) measureScene()
  })
})

const AGENTS = [
  { id: 'PL', name: 'planner', tasks: ['Decomposing goal', 'Assigning subtasks', 'Re-prioritizing', 'Merging outputs'], p: 100, s: 'running' },
  { id: 'A1', name: 'analyst-1', tasks: ['Reading 10-K filings', 'Extracting risk factors', 'Scoring exposures'], p: 62, s: 'running' },
  { id: 'A2', name: 'analyst-2', tasks: ['Parsing earnings calls', 'Clustering sentiment', 'Tagging guidance'], p: 41, s: 'running' },
  { id: 'CR', name: 'critic', tasks: ['Verifying analyst-1', 'Flagging low confidence', 'Approving batch #42'], p: 74, s: 'verifying' },
]
const agentList = $('#agent-list')
AGENTS.forEach((a) => {
  a.ti = 0
  const row = document.createElement('div')
  row.className = 'agent-row'
  row.title = a.tasks[0]
  row.innerHTML = `
    <span class="avatar">${a.id}</span>
    <span class="min-w-0"><span class="block truncate font-mono text-[10.5px] text-[#1b191e]">${a.name}</span><span class="bar mt-1"><i style="width:${a.p}%"></i></span></span>
    <span class="status" data-s="${a.s}">${a.s}</span>`
  agentList.appendChild(row)
  a.el = { row, bar: row.querySelector('.bar > i'), status: row.querySelector('.status') }
})
const TICKER = [
  () => `[planner] decomposed goal into ${randi(4, 9)} subtasks`,
  () => `[analyst-${randi(1, 4)}] fetched ${fmt(randi(400, 2400))} rows from lakebase://finance/filings`,
  () => `[scheduler] placed job on local:h100-0${randi(1, 8)} · util ${randi(55, 93)}%`,
  () => `[critic] verified analyst-${randi(1, 4)} output · confidence 0.${randi(88, 98)}`,
  () => `[burst] +4× A100 on cloud (spot) · $${rand(1.6, 2.9).toFixed(2)}/h`,
  () => `[memory] wrote ${randi(12, 60)} facts → swarm memory`,
  () => `[lakebase] sync finance/filings · ${randi(1, 4)}.${randi(0, 9)}s · ${randi(0, 3)} conflicts resolved`,
  () => `[guardrails] pii scan passed · budget ${randi(48, 71)}% of daily cap`,
  () => `[planner] checkpoint requested → approved by ops@finance`,
]
const ticker = $('#dash-ticker'), dashLog = $('#dash-log')
let tick = 0
function pushTicker(instant) {
  const text = '▸ ' + TICKER[(tick++ * 7 + randi(0, 2)) % TICKER.length]()
  const li = document.createElement('li')
  li.textContent = text
  dashLog.appendChild(li)
  while (dashLog.children.length > 6) dashLog.removeChild(dashLog.firstChild)
  if (instant || reduceMotion) { ticker.textContent = text; return }
  ticker.classList.add('fade')
  setTimeout(() => { ticker.textContent = text; ticker.classList.remove('fade') }, 300)
}
for (let i = 0; i < 4; i++) pushTicker(true)

const gpuGrid = $('#gpu-grid')
const gpuCells = Array.from({ length: 8 }, (_, i) => {
  const c = document.createElement('div')
  c.className = 'gpu-cell'
  c.innerHTML = `<i style="height:${randi(35, 90)}%"></i>`
  c.title = `h100-0${i + 1}`
  gpuGrid.appendChild(c)
  return c
})

const mTasks = $('#m-tasks'), mGpu = $('#m-gpu')
let simTimer = 0
function simTick() {
  const a = AGENTS[randi(0, AGENTS.length - 1)]
  if (a.name !== 'planner') {
    a.p += randi(6, 22)
    if (a.p >= 100) {
      a.p = 0
      a.ti = (a.ti + 1) % a.tasks.length
      a.el.row.title = a.tasks[a.ti]
      a.s = a.name === 'critic' ? 'verifying' : Math.random() < 0.15 ? 'idle' : 'running'
      a.el.status.dataset.s = a.s
      a.el.status.textContent = a.s
    }
    a.el.bar.style.width = a.p + '%'
  } else {
    a.ti = (a.ti + 1) % a.tasks.length
    a.el.row.title = a.tasks[a.ti]
  }
  let util = 0
  gpuCells.forEach((c) => {
    const v = randi(30, 96)
    util += v
    c.firstElementChild.style.height = v + '%'
    c.dataset.hot = v > 92 ? '1' : '0'
  })
  mGpu.textContent = Math.round(util / gpuCells.length) + '%'
  mTasks.textContent = fmt(randi(4400, 5300)) + ' tasks/min'
  pushTicker()
}
function startSim() { if (!simTimer && !reduceMotion) simTimer = setInterval(simTick, 1600) }
function stopSim() { clearInterval(simTimer); simTimer = 0 }
let termVisible = false
new IntersectionObserver(([e]) => { termVisible = e.isIntersecting; termVisible && !document.hidden ? startSim() : stopSim() }).observe($('#terminal'))
document.addEventListener('visibilitychange', () => (document.hidden ? stopSim() : termVisible && startSim()))
addEventListener('pagehide', stopSim)

/* ---------------- stacking cards (desktop) ---------------- */
const mm = gsap.matchMedia()
mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
  const prog = new Array(cards.length).fill(0)
  const STEP = 0.05
  const apply = () => {
    cards.forEach((card, i) => {
      let s = 0
      for (let j = i + 1; j < cards.length; j++) s += prog[j]
      gsap.set(card, { scale: 1 - s * STEP, filter: `brightness(${(1 - s * 0.28).toFixed(3)})` })
    })
  }
  const triggers = cards.map((card, j) => {
    if (j === 0) return null
    return ScrollTrigger.create({
      trigger: card,
      start: 'top bottom',
      end: () => `top ${cssNum('--stack-top', 88) + 18 * j}px`,
      onUpdate: (st) => { prog[j] = st.progress; apply() },
      onRefresh: (st) => { prog[j] = st.progress; apply() },
      invalidateOnRefresh: true,
    })
  })
  apply()
  return () => {
    triggers.forEach((t) => t && t.kill())
    cards.forEach((c) => gsap.set(c, { clearProps: 'transform,filter' }))
  }
})

/* ---------------- reveal on enter ---------------- */
if (!reduceMotion) {
  $$('[data-reveal]').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 26 })
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', overwrite: true }) })
  })
}

/* ---------------- showcase: tabs, copy, run ---------------- */
const codeTabs = $$('.code-tab'), codes = $$('.code')
codeTabs.forEach((t) => t.addEventListener('click', () => {
  codeTabs.forEach((b) => { b.classList.toggle('active', b === t); b.setAttribute('aria-selected', b === t ? 'true' : 'false') })
  codes.forEach((c) => c.classList.toggle('active', c.dataset.code === t.dataset.tab))
}))
const copyBtn = $('#copy-btn')
copyBtn.addEventListener('click', async () => {
  const active = codes.find((c) => c.classList.contains('active'))
  const cmd = active.querySelector('.cmd')
  const text = (cmd ? cmd.innerText : active.innerText).replace(/^\$ /, '')
  try {
    await navigator.clipboard.writeText(text)
    copyBtn.textContent = 'Copied'
  } catch { copyBtn.textContent = 'Select to copy' }
  setTimeout(() => (copyBtn.textContent = 'Copy'), 1600)
})
const steps = $$('#run-steps .step'), runStatus = $('#run-status'), runResult = $('#run-result'), runBtn = $('#run-btn')
let runTimers = []
function runDemo() {
  runTimers.forEach(clearTimeout); runTimers = []
  steps.forEach((s) => s.classList.remove('active', 'done'))
  runResult.hidden = true
  runStatus.textContent = 'running…'
  runStatus.className = 'text-cyan-200'
  const dur = reduceMotion ? 0 : 850
  steps.forEach((s, i) => {
    runTimers.push(setTimeout(() => {
      if (i > 0) steps[i - 1].classList.replace('active', 'done')
      s.classList.add('active')
    }, 300 + i * dur))
  })
  runTimers.push(setTimeout(() => {
    steps[steps.length - 1].classList.replace('active', 'done')
    runResult.hidden = false
    runStatus.textContent = 'live · rd-8f2'
    runStatus.className = 'text-emerald-300'
    if (!reduceMotion) gsap.from(runResult, { opacity: 0, y: 10, duration: 0.5, ease: 'power3.out' })
  }, 300 + steps.length * dur + 200))
}
runBtn.addEventListener('click', runDemo)
ScrollTrigger.create({ trigger: '#run-steps', start: 'top 80%', once: true, onEnter: runDemo })

/* ---------------- telemetry counters + sparklines ---------------- */
function sparkline(canvas, seed, { min, max, color }) {
  const ctx = canvas.getContext('2d')
  const N = 42
  const data = Array.from({ length: N }, (_, i) => seed(i))
  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const r = canvas.getBoundingClientRect()
    if (r.width === 0) return
    canvas.width = r.width * dpr; canvas.height = r.height * dpr
    ctx.scale(dpr, dpr)
    const W = r.width, H = r.height
    ctx.clearRect(0, 0, W, H)
    const pts = data.map((v, i) => [i / (N - 1) * W, H - 3 - ((v - min) / (max - min)) * (H - 6)])
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, color.replace('A', '0.35')); g.addColorStop(1, color.replace('A', '0'))
    ctx.beginPath(); ctx.moveTo(pts[0][0], H)
    pts.forEach((p) => ctx.lineTo(p[0], p[1]))
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill()
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.strokeStyle = color.replace('A', '0.9'); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke()
  }
  draw()
  addEventListener('resize', draw)
  return (v) => { data.push(v); data.shift(); draw() }
}
const sparks = {
  tasks: sparkline($('#spark-tasks'), (i) => 50 + Math.sin(i / 4) * 18 + rand(-8, 8), { min: 0, max: 100, color: 'rgba(52,211,153,A)' }),
  latency: sparkline($('#spark-latency'), () => rand(34, 44), { min: 28, max: 50, color: 'rgba(103,232,249,A)' }),
  uptime: sparkline($('#spark-uptime'), () => rand(99.97, 100), { min: 99.9, max: 100, color: 'rgba(52,211,153,A)' }),
  gpus: sparkline($('#spark-gpus'), (i) => 60 + i * 0.6 + rand(-6, 6), { min: 40, max: 100, color: 'rgba(103,232,249,A)' }),
}
const liveTickers = []   // { fn, ms } started/stopped with the telemetry section's visibility
const liveTimers = []
function startLive() { if (liveTimers.length || reduceMotion) return; liveTickers.forEach((t) => liveTimers.push(setInterval(t.fn, t.ms))) }
function stopLive() { liveTimers.splice(0).forEach(clearInterval) }
let telemetryVisible = false
new IntersectionObserver(([e]) => { telemetryVisible = e.isIntersecting; telemetryVisible && !document.hidden ? startLive() : stopLive() }).observe($('#telemetry'))
document.addEventListener('visibilitychange', () => (document.hidden ? stopLive() : telemetryVisible && startLive()))
addEventListener('pagehide', stopLive)
$$('[data-count]').forEach((el) => {
  const target = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0)
  const obj = { v: 0 }
  ScrollTrigger.create({
    trigger: el, start: 'top 90%', once: true,
    onEnter: () => {
      if (reduceMotion) { el.textContent = fmt(target, dec); return }
      gsap.to(obj, {
        v: target, duration: 2.2, ease: 'power3.out',
        onUpdate: () => (el.textContent = fmt(obj.v, dec)),
        onComplete: () => {
          if (target > 100000) liveTickers.push({ ms: 1400, fn: () => { obj.v += randi(3, 41); el.textContent = fmt(obj.v, dec); sparks.tasks(50 + rand(-25, 25)) } })
          if (el.dataset.live === 'latency') liveTickers.push({ ms: 2100, fn: () => { const v = randi(34, 43); el.textContent = fmt(v); sparks.latency(v) } })
          if (telemetryVisible) { stopLive(); startLive() }
        },
      })
    },
  })
})

/* ---------------- refresh after assets/fonts ---------------- */
const refresh = () => ScrollTrigger.refresh()
document.fonts?.ready.then(refresh)
addEventListener('load', refresh)
$$('.hero-layer img').forEach((img) => { if (!img.complete) img.addEventListener('load', refresh, { once: true }) })

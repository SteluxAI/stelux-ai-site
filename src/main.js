import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

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

/* ---------------- smooth scroll ---------------- */
let lenis = null
if (!reduceMotion) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.095, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  window.__lenis = lenis
}
function scrollToTarget(target, offset = -96) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.1 })
  else target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]')
  if (!a) return
  const id = a.getAttribute('href').slice(1)
  const target = id ? document.getElementById(id) : document.body
  if (!target) return
  e.preventDefault()
  closeMenu()
  const inStack = target.classList.contains('stack-card')
  const stackTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-top')) || 88
  scrollToTarget(target, inStack && !isMobile() ? -(stackTop + 18 * (+target.style.getPropertyValue('--i') || 0)) : -96)
  history.replaceState(null, '', '#' + id)
})

/* ---------------- nav ---------------- */
const nav = $('#nav')
const menuBtn = $('#menu-btn')
const menu = $('#mobile-menu')
function syncNav() { nav.classList.toggle('scrolled', scrollY > 24) }
addEventListener('scroll', syncNav, { passive: true })
syncNav()
function openMenu() {
  menu.hidden = false
  menuBtn.setAttribute('aria-expanded', 'true')
  menuBtn.setAttribute('aria-label', 'Close menu')
  lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
}
function closeMenu() {
  if (menu.hidden) return
  menu.hidden = true
  menuBtn.setAttribute('aria-expanded', 'false')
  menuBtn.setAttribute('aria-label', 'Open menu')
  lenis?.start()
  document.documentElement.style.overflow = ''
}
menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()))
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu() })
addEventListener('resize', () => { if (!isMobile()) closeMenu() })

/* ---------------- dusk sky shader (canvas) ---------------- */
function initSky(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false })
  // vertical dusk ramp: black at the top, warm mauve at the horizon
  const RAMP = [
    [0.00, '#050506'], [0.10, '#141214'], [0.26, '#2f2a2c'], [0.44, '#514648'],
    [0.60, '#6f5f62'], [0.74, '#8a7578'], [0.86, '#9b8488'], [1.00, '#a68e92'],
  ]
  const blobs = [
    { x: 0.30, y: 0.30, r: 0.40, c: '214,168,176', a: 0.14, sx: 0.00009, sy: 0.00007, p: 0.0 },
    { x: 0.76, y: 0.26, r: 0.36, c: '176,160,190', a: 0.12, sx: 0.00007, sy: 0.00010, p: 2.1 },
    { x: 0.52, y: 0.40, r: 0.42, c: '226,200,196', a: 0.10, sx: 0.00006, sy: 0.00008, p: 4.2 },
    { x: 0.12, y: 0.06, r: 0.34, c: '10,9,11', a: 0.45, sx: 0.00008, sy: 0.00006, p: 1.3 },
    { x: 0.90, y: 0.05, r: 0.30, c: '12,10,13', a: 0.40, sx: 0.00007, sy: 0.00009, p: 3.4 },
  ]
  const SCALE = 0.16
  let w = 2, h = 2, running = true, raf = 0
  function resize() {
    const r = canvas.getBoundingClientRect()
    w = canvas.width = Math.max(2, Math.round(r.width * SCALE))
    h = canvas.height = Math.max(2, Math.round(r.height * SCALE))
    draw(performance.now())
  }
  const hills = document.querySelector('.hills-wrap')
  function horizon() {
    // fraction of the canvas height where the hill crests sit (the sky ramp ends there)
    const ch = canvas.clientHeight || 1
    const crest = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crest')) || 0
    const crestPx = crest / 100 * innerWidth
    const top = hills ? hills.offsetTop + crestPx : ch * 0.6
    return Math.min(0.98, Math.max(0.2, top / ch))
  }
  function draw(t) {
    ctx.globalCompositeOperation = 'source-over'
    const hz = horizon()
    const g = ctx.createLinearGradient(0, 0, 0, h)
    RAMP.forEach(([o, c]) => g.addColorStop(o * hz, c))
    g.addColorStop(1, RAMP[RAMP.length - 1][1])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const m = Math.max(w, h)
    for (const b of blobs) {
      const cx = (b.x + Math.sin(t * b.sx + b.p) * 0.10) * w
      const cy = (b.y + Math.cos(t * b.sy + b.p) * 0.06) * h
      const rad = b.r * m
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      rg.addColorStop(0, `rgba(${b.c},${b.a})`)
      rg.addColorStop(0.5, `rgba(${b.c},${b.a * 0.4})`)
      rg.addColorStop(1, `rgba(${b.c},0)`)
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, w, h)
    }
  }
  function frame(t) {
    if (!running) return
    draw(t)
    raf = requestAnimationFrame(frame)
  }
  resize()
  addEventListener('resize', resize)
  if (reduceMotion) return
  raf = requestAnimationFrame(frame)
  new IntersectionObserver(([e]) => {
    const was = running
    running = e.isIntersecting && !document.hidden
    if (running && !was) raf = requestAnimationFrame(frame)
  }, { threshold: 0 }).observe(canvas)
  document.addEventListener('visibilitychange', () => {
    const was = running
    running = !document.hidden
    if (running && !was) raf = requestAnimationFrame(frame)
  })
}
initSky($('#aurora'))

/* ---------------- hero parallax: 0.3x / 1.0x / 1.4x ---------------- */
const hero = $('#hero')
if (!reduceMotion) {
  const st = () => ({ trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true })
  gsap.to('.hero-bg', { y: () => hero.offsetHeight * 0.7, ease: 'none', scrollTrigger: st() })
  gsap.to('.hero-fg', { y: () => -hero.offsetHeight * 0.4, ease: 'none', scrollTrigger: st() })
  gsap.to('.hero-copy', {
    y: -70, opacity: 0.15, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: '55% top', scrub: true },
  })
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
const dashTitle = $('#dash-title'), dashSubText = $('#dash-sub-text')
$$('.dash-nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    const v = VIEWS[btn.dataset.view] || VIEWS.overview
    $$('.dash-nav').forEach((b) => b.classList.toggle('active', b === btn))
    dashTitle.textContent = v.title
    dashSubText.textContent = v.sub
    if (!reduceMotion) gsap.fromTo([dashTitle, dashSubText], { opacity: 0.2, y: 4 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'all' })
  })
})

const AGENTS = [
  { id: 'PL', name: 'planner', tasks: ['Decomposing goal', 'Assigning subtasks', 'Re-prioritizing', 'Merging outputs'], p: 100, s: 'running' },
  { id: 'A1', name: 'analyst-1', tasks: ['Reading 10-K filings', 'Extracting risk factors', 'Scoring exposures'], p: 62, s: 'running' },
  { id: 'CR', name: 'critic', tasks: ['Verifying analyst-1', 'Flagging low confidence', 'Approving batch #42'], p: 74, s: 'verifying' },
]
const agentList = $('#agent-list')
AGENTS.forEach((a) => {
  a.ti = 0
  const row = document.createElement('div')
  row.className = 'agent-row'
  row.innerHTML = `
    <span class="avatar">${a.id}</span>
    <span class="min-w-0" title="${a.tasks[0]}"><span class="block truncate font-mono text-[10.5px] text-white/85">${a.name}</span><span class="bar mt-1"><i style="width:${a.p}%"></i></span></span>
    <span class="status" data-s="${a.s}">${a.s}</span>`
  agentList.appendChild(row)
  a.el = { task: row.querySelector('.min-w-0'), bar: row.querySelector('.bar > i'), status: row.querySelector('.status') }
})
const TICKER = [
  () => `[planner] decomposed goal into ${randi(4, 9)} subtasks`,
  () => `[analyst-${randi(1, 3)}] fetched ${fmt(randi(400, 2400))} rows from lakebase://finance/filings`,
  () => `[scheduler] placed job on local:h100-0${randi(1, 8)} · util ${randi(55, 93)}%`,
  () => `[critic] verified analyst-${randi(1, 3)} output · confidence 0.${randi(88, 98)}`,
  () => `[burst] +${randi(2, 6)}× A100 on cloud (spot) · $${rand(1.6, 2.9).toFixed(2)}/h`,
  () => `[memory] wrote ${randi(12, 60)} facts → swarm memory`,
  () => `[lakebase] sync finance/filings · ${randi(1, 4)}.${randi(0, 9)}s · ${randi(0, 3)} conflicts resolved`,
  () => `[guardrails] pii scan passed · budget ${randi(48, 71)}% of daily cap`,
  () => `[planner] checkpoint requested → approved by ops@finance`,
]
const ticker = $('#dash-ticker')
let tick = 0
function pushTicker(instant) {
  const text = '▸ ' + TICKER[(tick++ * 7 + randi(0, 2)) % TICKER.length]()
  if (instant || reduceMotion) { ticker.textContent = text; return }
  ticker.classList.add('fade')
  setTimeout(() => { ticker.textContent = text; ticker.classList.remove('fade') }, 300)
}
pushTicker(true)

const gpuGrid = $('#gpu-grid')
const gpuCells = Array.from({ length: 8 }, (_, i) => {
  const c = document.createElement('div')
  c.className = 'gpu-cell'
  c.innerHTML = `<i style="height:${randi(35, 90)}%"></i>`
  c.title = `h100-0${i + 1}`
  gpuGrid.appendChild(c)
  return c
})

const mTasks = $('#m-tasks'), mGpu = $('#m-gpu'), termLive = $('#term-live')
let simTimer = 0
function simTick() {
  const a = AGENTS[randi(0, AGENTS.length - 1)]
  if (a.name !== 'planner') {
    a.p += randi(6, 22)
    if (a.p >= 100) {
      a.p = 0
      a.ti = (a.ti + 1) % a.tasks.length
      a.el.task.title = a.tasks[a.ti]
      a.s = a.name === 'critic' ? 'verifying' : Math.random() < 0.15 ? 'idle' : 'running'
      a.el.status.dataset.s = a.s
      a.el.status.textContent = a.s
    }
    a.el.bar.style.width = a.p + '%'
  } else {
    a.ti = (a.ti + 1) % a.tasks.length
    a.el.task.title = a.tasks[a.ti]
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
  if (Math.random() < 0.3) termLive.textContent = `${randi(11, 14)} agents live`
  pushTicker()
}
function startSim() { if (!simTimer && !reduceMotion) simTimer = setInterval(simTick, 1600) }
function stopSim() { clearInterval(simTimer); simTimer = 0 }
new IntersectionObserver(([e]) => (e.isIntersecting ? startSim() : stopSim())).observe($('#terminal'))

/* ---------------- stacking cards (desktop) ---------------- */
const cards = $$('.stack-card')
const mm = gsap.matchMedia()
mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
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
    const top = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-top')) || 88) + 18 * j
    return ScrollTrigger.create({
      trigger: card,
      start: 'top bottom',
      end: () => `top ${top()}px`,
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
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', overwrite: true }),
    })
  })
}

/* ---------------- showcase: tabs, copy, run ---------------- */
const codeTabs = $$('.code-tab'), codes = $$('.code')
codeTabs.forEach((t) => t.addEventListener('click', () => {
  codeTabs.forEach((b) => b.classList.toggle('active', b === t))
  codes.forEach((c) => c.classList.toggle('active', c.dataset.code === t.dataset.tab))
}))
const copyBtn = $('#copy-btn')
copyBtn.addEventListener('click', async () => {
  const active = codes.find((c) => c.classList.contains('active'))
  try {
    await navigator.clipboard.writeText(active.innerText)
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
          if (target > 100000) setInterval(() => { obj.v += randi(3, 41); el.textContent = fmt(obj.v, dec); sparks.tasks(50 + rand(-25, 25)) }, 1400)
          if (el.dataset.live === 'latency') setInterval(() => { const v = randi(34, 43); el.textContent = fmt(v); sparks.latency(v) }, 2100)
        },
      })
    },
  })
})

/* ---------------- refresh after assets/fonts ---------------- */
const refresh = () => ScrollTrigger.refresh()
document.fonts?.ready.then(refresh)
addEventListener('load', refresh)

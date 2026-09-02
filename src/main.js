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
  scrollToTarget(target, inStack && !isMobile() ? -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-top')) + 18 * (+target.style.getPropertyValue('--i') || 0)) : -96)
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

/* ---------------- aurora shader (canvas) ---------------- */
function initAurora(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const blobs = [
    { x: 0.22, y: 0.32, r: 0.62, c: '16,185,129', a: 0.40, sx: 0.00011, sy: 0.00009, p: 0.0 },
    { x: 0.80, y: 0.22, r: 0.55, c: '34,211,238', a: 0.30, sx: 0.00009, sy: 0.00013, p: 2.1 },
    { x: 0.55, y: 0.72, r: 0.70, c: '13,148,136', a: 0.34, sx: 0.00007, sy: 0.00008, p: 4.2 },
    { x: 0.08, y: 0.85, r: 0.50, c: '5,150,105', a: 0.26, sx: 0.00010, sy: 0.00006, p: 1.3 },
    { x: 0.92, y: 0.70, r: 0.45, c: '8,145,178', a: 0.22, sx: 0.00008, sy: 0.00011, p: 3.4 },
  ]
  const SCALE = 0.16
  let w = 2, h = 2, running = true, raf = 0
  function resize() {
    const r = canvas.getBoundingClientRect()
    w = canvas.width = Math.max(2, Math.round(r.width * SCALE))
    h = canvas.height = Math.max(2, Math.round(r.height * SCALE))
    draw(performance.now())
  }
  function draw(t) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#08080a'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    const m = Math.max(w, h)
    for (const b of blobs) {
      const cx = (b.x + Math.sin(t * b.sx + b.p) * 0.10) * w
      const cy = (b.y + Math.cos(t * b.sy + b.p) * 0.08) * h
      const rad = b.r * m
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      g.addColorStop(0, `rgba(${b.c},${b.a})`)
      g.addColorStop(0.45, `rgba(${b.c},${b.a * 0.35})`)
      g.addColorStop(1, `rgba(${b.c},0)`)
      ctx.fillStyle = g
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
initAurora($('#aurora'))

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

/* ---------------- terminal: tilt + live simulation ---------------- */
const termInner = $('.terminal-inner')
if (canHover && !reduceMotion) {
  const term = $('#terminal')
  term.addEventListener('mousemove', (e) => {
    const r = term.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    termInner.style.transform = `rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`
  })
  term.addEventListener('mouseleave', () => { termInner.style.transform = '' })
}

const termMain = $('#term-main')
$$('.term-nav, .term-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view
    termMain.dataset.view = view
    $$('.term-nav').forEach((b) => b.classList.toggle('active', b.dataset.view === view))
    $$('.term-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view))
  })
})
if (isMobile()) termMain.dataset.view = 'agents'

const AGENTS = [
  { id: 'PL', name: 'planner', tasks: ['Decomposing goal', 'Assigning subtasks', 'Re-prioritizing queue', 'Merging analyst outputs'], p: 100, s: 'running' },
  { id: 'A1', name: 'analyst-1', tasks: ['Reading 10-K filings', 'Extracting risk factors', 'Scoring exposures'], p: 62, s: 'running' },
  { id: 'A2', name: 'analyst-2', tasks: ['Parsing earnings calls', 'Clustering sentiment', 'Tagging guidance changes'], p: 41, s: 'running' },
  { id: 'A3', name: 'analyst-3', tasks: ['Joining Lakebase tables', 'Backfilling Q2 deltas', 'Validating schema'], p: 18, s: 'running' },
  { id: 'CR', name: 'critic', tasks: ['Verifying analyst-1', 'Flagging low-confidence claims', 'Approving batch #42'], p: 74, s: 'verifying' },
  { id: 'ME', name: 'memory', tasks: ['Indexing 38 facts', 'Deduplicating claims', 'Compacting context'], p: 88, s: 'idle' },
]
const agentList = $('#agent-list')
AGENTS.forEach((a) => {
  a.ti = 0
  const row = document.createElement('div')
  row.className = 'agent-row'
  row.innerHTML = `
    <span class="avatar">${a.id}</span>
    <span class="truncate font-mono text-[11.5px] text-white/85">${a.name}</span>
    <span class="agent-task min-w-0"><span class="block truncate text-[11px] text-white/45">${a.tasks[0]}</span><span class="bar mt-1"><i style="width:${a.p}%"></i></span></span>
    <span class="status" data-s="${a.s}">${a.s}</span>`
  agentList.appendChild(row)
  a.el = { task: row.querySelector('.agent-task > span'), bar: row.querySelector('.bar > i'), status: row.querySelector('.status') }
})
const LOG_POOL = [
  () => `<span class="k">[planner]</span> decomposed goal into ${randi(4, 9)} subtasks`,
  () => `<span class="c">[analyst-${randi(1, 3)}]</span> fetched ${fmt(randi(400, 2400))} rows from lakebase://finance/filings`,
  () => `<span class="k">[scheduler]</span> placed job on local:h100-0${randi(1, 8)} (util ${randi(55, 93)}%)`,
  () => `<span class="c">[critic]</span> verified analyst-${randi(1, 3)} output · confidence 0.${randi(88, 98)}`,
  () => `<span class="w">[burst]</span> +${randi(2, 6)}× A100 on cloud (spot) · $${rand(1.6, 2.9).toFixed(2)}/h`,
  () => `<span class="k">[memory]</span> wrote ${randi(12, 60)} facts → swarm memory`,
  () => `<span class="c">[lakebase]</span> sync finance/filings · ${randi(1, 4)}.${randi(0, 9)}s · ${randi(0, 3)} conflicts resolved`,
  () => `<span class="k">[guardrails]</span> pii scan passed · budget ${randi(48, 71)}% of daily cap`,
  () => `<span class="c">[planner]</span> checkpoint requested → approved by ops@finance`,
]
const log = $('#term-log')
let logTick = 0
function pushLog() {
  const li = document.createElement('li')
  const t = new Date()
  const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
  li.innerHTML = `<span class="t">${ts}</span> ${LOG_POOL[(logTick++ * 7 + randi(0, 2)) % LOG_POOL.length]()}`
  log.appendChild(li)
  while (log.children.length > 6) log.removeChild(log.firstChild)
}
for (let i = 0; i < 4; i++) pushLog()

const gpuGrid = $('#gpu-grid')
const gpuCells = Array.from({ length: 8 }, (_, i) => {
  const c = document.createElement('div')
  c.className = 'gpu-cell'
  c.innerHTML = `<i style="height:${randi(35, 90)}%"></i>`
  c.title = `h100-0${i + 1}`
  gpuGrid.appendChild(c)
  return c
})

const mTasks = $('#m-tasks'), mGpu = $('#m-gpu'), mQueue = $('#m-queue'), mCost = $('#m-cost'), termLive = $('#term-live')
let simTimer = 0
function simTick() {
  const a = AGENTS[randi(0, AGENTS.length - 1)]
  if (a.name !== 'planner') {
    a.p += randi(6, 22)
    if (a.p >= 100) {
      a.p = 0
      a.ti = (a.ti + 1) % a.tasks.length
      a.el.task.textContent = a.tasks[a.ti]
      a.s = a.name === 'critic' ? 'verifying' : Math.random() < 0.15 ? 'idle' : 'running'
      a.el.status.dataset.s = a.s
      a.el.status.textContent = a.s
    }
    a.el.bar.style.width = a.p + '%'
  } else {
    a.ti = (a.ti + 1) % a.tasks.length
    a.el.task.textContent = a.tasks[a.ti]
  }
  let util = 0
  gpuCells.forEach((c) => {
    const v = randi(30, 96)
    util += v
    c.firstElementChild.style.height = v + '%'
    c.dataset.hot = v > 92 ? '1' : '0'
  })
  mGpu.textContent = Math.round(util / gpuCells.length) + '%'
  mTasks.textContent = fmt(randi(4400, 5300))
  mQueue.textContent = randi(8, 41)
  mCost.textContent = `$${rand(1.8, 2.6).toFixed(2)}/h`
  if (Math.random() < 0.3) termLive.textContent = `${randi(11, 14)} agents live`
  pushLog()
}
function startSim() { if (!simTimer && !reduceMotion) simTimer = setInterval(simTick, 1500) }
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
    const top = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-top')) + 18 * j
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

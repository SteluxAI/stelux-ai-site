import { t, currentLang, onLangChange } from './i18n.js'

/* Arena preview: the same public, read-only paper-trading snapshot the Arena page reads.
   Fetched when the card nears the viewport and refreshed while it stays on screen; on any
   failure the card keeps its decorative curve and simply links to the live board. */
const FEED = 'https://steluxai.github.io/arena-live/data/'
const REFRESH_MS = 90_000

const pct = (bp) => {
  const v = (bp || 0) / 100
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`
}
const tone = (bp) => (bp > 0 ? 'is-up' : bp < 0 ? 'is-dn' : 'is-flat')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function pathFor(values, w, h, pad = 6, extra = []) {
  if (values.length < 2) return null
  const all = values.concat(extra.filter(Number.isFinite))
  let min = Math.min(...all), max = Math.max(...all)
  if (max === min) { max += 1; min -= 1 }
  const y = (v) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, y(v)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return { line, area: `${line} L${w},${h} L0,${h} Z`, last: pts[pts.length - 1], pts, y }
}

/* Marks a preview .is-on while at least a third of it is visible; calls on(true|false) on changes. */
function whileVisible(el, on) {
  let vis = false
  const set = (v) => { if (v === vis) return; vis = v; el.classList.toggle('is-on', v); on?.(v) }
  new IntersectionObserver(([e]) => set(e.isIntersecting && !document.hidden), { threshold: 0.33 }).observe(el)
  document.addEventListener('visibilitychange', () => { if (document.hidden) set(false) })
  return () => vis
}

function initArena(reduceMotion) {
  const root = document.querySelector('[data-arena-preview]')
  if (!root) return
  const el = (k) => root.querySelector(`[data-a="${k}"]`)
  let snap = null, exp = null, shown = null, refreshTimer = 0

  const money = (cents) => '$' + Math.round(cents / 100).toLocaleString('en-US')
  const hue = (sym) => [...String(sym)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  const fmtTime = (iso, opts) => { try { return new Intl.DateTimeFormat(currentLang(), { timeZone: 'America/New_York', ...opts }).format(new Date(iso)) } catch { return '' } }

  function setEquity(cents) {
    const node = el('equity')
    if (!Number.isFinite(cents)) { node.textContent = '—'; return }
    if (shown == null && !reduceMotion) {
      const t0 = performance.now()
      const roll = (now) => {
        const k = Math.min(1, (now - t0) / 1400)
        node.textContent = money(cents * (1 - Math.pow(1 - k, 3)))
        if (k < 1) requestAnimationFrame(roll)
      }
      requestAnimationFrame(roll)
    } else node.textContent = money(cents)
    shown = cents
  }

  function render() {
    if (!snap) return
    const sys = snap.system || {}
    const ex = snap.experiment || {}
    const day = ex.day_index ?? exp?.day_index, total = ex.n_days ?? exp?.n_days
    el('day').textContent = day ? (total ? t('arenaPvDayOf', { d: day, n: total }) : `${t('arenaPvDay')} ${day}`) : ''
    el('slots').textContent = sys.n_slots ? t('arenaPvSlots', { n: sys.n_slots }) : ''

    setEquity(sys.live_equity_status === 'known' ? sys.live_equity_cents : sys.ledger_equity_cents)
    el('change').innerHTML = `<b class="${tone(sys.live_day_return_bp)}">${pct(sys.live_day_return_bp)}</b>${esc(t('arenaPvToday'))}` +
      `<span class="a3-sep">·</span><span>${pct(sys.live_return_bp)} ${esc(t('arenaPvAll'))}</span>`

    // chart: the day's equity on the same scale as the previous close (a faint dashed line)
    const curve = (sys.curve || []).map((p) => p[1]).filter(Number.isFinite)
    const prev = sys.prev_close_equity_cents
    const p = pathFor(curve, 400, 120, 10, [prev])
    if (p) {
      const color = curve[curve.length - 1] >= (Number.isFinite(prev) ? prev : curve[0]) ? '#4ade80' : '#7cc0ff'
      root.style.setProperty('--a3', color)
      const line = el('line')
      line.setAttribute('d', p.line)
      el('area').setAttribute('d', p.area)
      if (Number.isFinite(prev)) { const ry = p.y(prev); el('ref').setAttribute('y1', ry); el('ref').setAttribute('y2', ry) }
      const dot = el('dot')
      dot.style.left = `${(p.last[0] / 400) * 100}%`
      dot.style.top = `${(p.last[1] / 120) * 100}%`
      dot.hidden = false
      if (!reduceMotion && !line.dataset.drawn) {
        // reveal the chart left to right (dash tricks break with non-scaling strokes in Chromium)
        line.dataset.drawn = '1'
        line.closest('svg').animate([{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0% -10% 0)' }], { duration: 1600, easing: 'cubic-bezier(.16,1,.3,1)' })
        dot.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 1200, fill: 'backwards' })
      }
    }

    // leaders: the best strategy per stock held, so ties on one stock read as one line
    const groups = new Map()
    for (const s of snap.slots || []) {
      if (!Number.isFinite(s.live_return_bp)) continue
      const sym = (s.positions || []).map((x) => x.symbol).find(Boolean) || s.factor_target || '—'
      const g = groups.get(sym)
      if (!g) groups.set(sym, { sym, best: s.live_return_bp, n: 1 })
      else { g.n++; g.best = Math.max(g.best, s.live_return_bp) }
    }
    const leaders = [...groups.values()].sort((a, b) => b.best - a.best).slice(0, 3)
    const rows = el('rows')
    rows.textContent = ''
    leaders.forEach((g, i) => {
      const li = document.createElement('li')
      li.className = 'row'
      li.style.setProperty('--i', i)
      li.innerHTML = `<span class="a3-rank">${i + 1}</span>` +
        `<span class="a3-av" style="--h:${hue(g.sym)}">${esc(String(g.sym).slice(0, 4))}</span>` +
        `<span class="a3-name"><b>${esc(g.sym)}</b><span>${esc(g.n === 1 ? t('arenaPvGroup1') : t('arenaPvGroup', { n: g.n }))}</span></span>` +
        `<span class="a3-ret ${tone(g.best)}">${pct(g.best)}</span>`
      rows.appendChild(li)
    })

    // the latest simulated fill
    const x = ((snap.trades || {}).recent || []).find((r) => r && r.symbol && r.side)
    const trade = el('trade')
    if (x) {
      const buy = String(x.side).toUpperCase() === 'BUY', price = Number(x.price)
      trade.innerHTML = `<span>${esc(t('arenaPvLatest'))}</span><b class="${buy ? 'buy' : 'sell'}">${buy ? 'BUY' : 'SELL'}</b>` +
        `<b>${esc(x.symbol)}</b><span>${x.qty ? `×${esc(x.qty)} ` : ''}${Number.isFinite(price) ? `@ $${price.toFixed(2)}` : ''}</span>` +
        `<span class="when">${esc(fmtTime(x.confirmed_ny || x.bar_start_ny, { month: 'short', day: 'numeric' }))}</span>`
      trade.hidden = false
    } else trade.hidden = true

    const when = fmtTime(snap.published_utc || snap.ts_utc, { hour: 'numeric', minute: '2-digit' })
    el('foot').textContent = t('arenaPvNote') + (when ? ' · ' + t('arenaPvUpdated', { time: when }) : '')
  }

  function fail() {
    root.classList.add('is-offline')
    el('equity').textContent = t('arenaPvOffline') + ' →'
  }

  const ok = (r) => { if (!r.ok) throw new Error(r.status); return r.json() }
  async function fetchSnap() {
    snap = await fetch(`${FEED}${encodeURIComponent(exp.experiment_id)}/snapshot.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-cache' }).then(ok)
    if (!snap.system) throw new Error('no system')
  }
  async function load() {
    try {
      const idx = await fetch(FEED + 'index.json', { cache: 'no-cache' }).then(ok)
      const list = idx.experiments || []
      exp = list.find((x) => x.experiment_id === idx.default && x.asset_class === 'stock') || list.find((x) => x.asset_class === 'stock' && x.is_live) || list.find((x) => x.experiment_id === idx.default)
      if (!exp) throw new Error('no experiment')
      await fetchSnap()
      render()
    } catch { fail() }
  }

  onLangChange(() => { if (snap) render(); else if (root.classList.contains('is-offline')) fail() })
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load() } }, { rootMargin: '600px 0px' })
  io.observe(root)
  whileVisible(root, (on) => {
    clearInterval(refreshTimer)
    if (on) refreshTimer = setInterval(async () => { if (!exp) return; try { await fetchSnap(); render() } catch {} }, REFRESH_MS)
  })
}

/* Counts the number inside an element's text up from zero, keeping its prefix, suffix and format. */
function countUp(node, delay, duration = 1100) {
  const text = node.dataset.final || (node.dataset.final = node.textContent)
  const m = text.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/)
  if (!m) return
  const [, pre, num, post] = m
  const target = parseFloat(num.replace(/,/g, '')), dec = (num.split('.')[1] || '').length, commas = num.includes(',')
  const fmt = (v) => { const s = v.toFixed(dec); return commas ? Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s }
  node.textContent = pre + fmt(0) + post
  const start = performance.now() + delay
  const step = (now) => {
    const k = Math.min(1, Math.max(0, (now - start) / duration))
    node.textContent = pre + fmt(target * (1 - Math.pow(1 - k, 3))) + post
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/* Michigan: the 8 AM report "arrives" each time the card comes into view, and again every 12 s. */
function initMichigan(reduceMotion) {
  const pv = document.querySelector('.mi-pv')
  if (!pv || reduceMotion) return
  const nums = [...pv.querySelectorAll('[data-countup]')]
  let timer = 0
  const play = () => {
    pv.classList.remove('is-play'); void pv.offsetWidth; pv.classList.add('is-play')
    nums.forEach((n, i) => countUp(n, i === 0 ? 450 : 700 + i * 90))
  }
  whileVisible(pv, (on) => {
    clearInterval(timer)
    if (on) { play(); timer = setInterval(play, 12_000) }
  })
}

/* Market Signal Pro: the gauge sweeps and the bars fill, then both drift gently while visible. */
function initMarketSignal(reduceMotion) {
  const pv = document.querySelector('.ms-pv')
  if (!pv) return
  const val = pv.querySelector('.ms-gauge-val'), num = pv.querySelector('.ms-gauge-num'), bars = [...pv.querySelectorAll('.ms-bar b')]
  const base = bars.map((b) => parseFloat(b.style.getPropertyValue('--w')))
  if (reduceMotion) { pv.classList.add('is-ready'); return }
  let timer = 0
  const setGauge = (v) => { val.style.strokeDasharray = `${v} 100`; num.textContent = Math.round(v) }
  whileVisible(pv, (on) => {
    clearInterval(timer)
    if (!on) return
    if (!pv.classList.contains('is-ready')) {
      requestAnimationFrame(() => pv.classList.add('is-ready'))
      const t0 = performance.now()
      const tick = (now) => { const k = Math.min(1, (now - t0) / 1400); num.textContent = Math.round(68 * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    }
    timer = setInterval(() => {
      setGauge(62 + Math.random() * 12)
      bars.forEach((b, i) => b.style.setProperty('--w', `${Math.max(8, Math.min(96, base[i] + (Math.random() * 12 - 6))).toFixed(0)}%`))
    }, 2600)
  })
}

/* Lux: the question, a typing indicator, then the answer line by line — looping while visible. */
function initLux(reduceMotion) {
  const pv = document.querySelector('.lux-pv')
  if (!pv || reduceMotion) return
  const STEPS = [['s1', 300], ['s2', 1100], ['s3', 2500], ['s4', 2900], ['s5', 3300], ['s6', 3700]]
  pv.classList.add('is-seq', ...STEPS.map((s) => s[0])) // the finished conversation until the loop starts
  let timers = []
  const clear = () => { timers.forEach(clearTimeout); timers = [] }
  const reset = () => pv.classList.remove(...STEPS.map((s) => s[0]))
  const run = () => {
    clear(); reset()
    STEPS.forEach(([c, at]) => timers.push(setTimeout(() => pv.classList.add(c), at)))
    timers.push(setTimeout(reset, 9200))
    timers.push(setTimeout(run, 9800))
  }
  whileVisible(pv, (on) => { if (on) run(); else { clear(); STEPS.forEach(([c]) => pv.classList.add(c)) } })
}

/* Stelux Equipment: an auto-playing showcase. One machine at a time slides in with its number,
   category and description; the thumbnail rail's progress bar shows when the next one comes.
   Plays only while visible and pauses on hover; reduced motion keeps the first machine still. */
function initEquipment(reduceMotion) {
  const pv = document.querySelector('.eq-pv')
  if (!pv) return
  const slides = [...pv.querySelectorAll('.eq-slide')], thumbs = [...pv.querySelectorAll('.eq-thumb')]
  if (reduceMotion || slides.length < 2) return
  // the slide time lives here and is handed to CSS (the progress bar), not read back: minifiers rewrite 3600ms as 3.6s
  const ms = 3600
  pv.querySelector('.eq-show').style.setProperty('--eq-ms', ms + 'ms')
  let at = 0, timer = 0, left = ms, started = 0, on = false, hover = false

  const show = (i) => {
    const prev = at
    at = (i + slides.length) % slides.length
    slides.forEach((el, n) => {
      el.classList.toggle('is-active', n === at)
      el.classList.toggle('is-leaving', n === prev && n !== at)
    })
    thumbs.forEach((el, n) => {
      el.classList.toggle('is-active', n === at)
      el.classList.toggle('is-done', n < at)
      // restart the progress bar animation on the new active thumb
      const bar = el.querySelector('i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''
    })
  }
  const schedule = (wait) => {
    clearTimeout(timer)
    started = performance.now(); left = wait
    timer = setTimeout(() => { show(at + 1); schedule(ms) }, wait)
  }
  // a brief flicker out of view (or a quick hover) must never skip a slide: resume waits at least 900 ms
  const pause = () => { if (started) left = Math.max(0, left - (performance.now() - started)); clearTimeout(timer); started = 0; pv.classList.add('is-paused') }
  const resume = () => { pv.classList.remove('is-paused'); schedule(Math.max(900, left)) }

  whileVisible(pv, (v) => {
    on = v
    if (v && !hover) resume()
    else pause()
  })
  pv.addEventListener('pointerenter', () => { hover = true; if (on) pause() })
  pv.addEventListener('pointerleave', () => { hover = false; if (on) resume() })
}

/* Cheek Beat preview: the 15-second teaser loads only when its card is on screen. It plays on its
   own on wide screens; phones and Save-Data visitors start it with the play button. */
function initCheekBeat(reduceMotion) {
  const pv = document.querySelector('.cb-pv')
  if (!pv) return
  const video = pv.querySelector('video'), btn = pv.querySelector('.cb-play')
  const auto = !reduceMotion && !navigator.connection?.saveData && matchMedia('(min-width: 768px)').matches
  let wanted = false, visible = false
  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    near.disconnect()
    if (video.dataset.poster) video.poster = video.dataset.poster
  }, { rootMargin: '600px 0px' })
  near.observe(pv)
  whileVisible(pv)
  const play = () => {
    if (!video.getAttribute('src')) video.src = video.dataset.src
    wanted = true
    video.play().then(() => pv.classList.add('is-playing')).catch(() => pv.classList.remove('is-playing'))
  }
  btn.addEventListener('click', play)
  video.addEventListener('pause', () => pv.classList.remove('is-playing'))
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible && (auto || wanted)) play()
    else if (!visible && !video.paused) video.pause()
  }, { threshold: 0.35 }).observe(pv)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause()
    else if (visible && wanted) play()
  })
}

export function initProducts({ reduceMotion }) {
  initArena(reduceMotion)
  initCheekBeat(reduceMotion)
  initMichigan(reduceMotion)
  initEquipment(reduceMotion)
  initMarketSignal(reduceMotion)
  initLux(reduceMotion)
}

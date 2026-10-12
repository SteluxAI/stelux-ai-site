import { t, currentLang, onLangChange } from './i18n.js'

/* Arena preview: the same public, read-only paper-trading snapshot the Arena page reads.
   Fetched when the card nears the viewport and refreshed while it stays on screen; on any
   failure the card keeps its decorative curve and simply links to the live board. */
const FEED = 'https://steluxai.github.io/arena-live/data/'
const REFRESH_MS = 90_000
const TAPE_MS = 2600

const pct = (bp) => {
  const v = (bp || 0) / 100
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`
}
const tone = (bp) => (bp > 0 ? 'is-up' : bp < 0 ? 'is-dn' : 'is-flat')
const usd = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  let snap = null, exp = null, lastEquity = null, trades = [], tapeAt = 0, tapeTimer = 0, refreshTimer = 0
  let pts = [], pulseRaf = 0, counted = false

  function render() {
    if (!snap) return
    const sys = snap.system || {}
    const equity = sys.live_equity_status === 'known' ? sys.live_equity_cents : sys.ledger_equity_cents
    const eqEl = el('equity')
    if (Number.isFinite(equity) && !counted && !reduceMotion) {
      counted = true
      const t0 = performance.now()
      const roll = (now) => { const k = Math.min(1, (now - t0) / 1600); eqEl.textContent = usd(Math.round(equity * (1 - Math.pow(1 - k, 3)))); if (k < 1 && lastEquity === equity) requestAnimationFrame(roll); else eqEl.textContent = usd(lastEquity) }
      requestAnimationFrame(roll)
    } else eqEl.textContent = Number.isFinite(equity) ? usd(equity) : '—'
    if (lastEquity != null && equity !== lastEquity && !reduceMotion) { eqEl.classList.remove('bump'); void eqEl.offsetWidth; eqEl.classList.add('bump') }
    lastEquity = equity
    el('total').innerHTML = `<b class="${tone(sys.live_return_bp)}">${pct(sys.live_return_bp)}</b> ${t('arenaPvAll')}`
    el('day').innerHTML = `<b class="${tone(sys.live_day_return_bp)}">${pct(sys.live_day_return_bp)}</b> ${t('arenaPvToday')}`

    const ex = snap.experiment || {}
    const day = ex.day_index ?? exp?.day_index, total = ex.n_days ?? exp?.n_days
    el('meta').innerHTML = day ? `<b>${day}${total ? `<span class="text-white/35">/${total}</span>` : ''}</b>${t('arenaPvDay')}` : ''
    el('slots').textContent = sys.n_slots ? t('arenaPvSlots', { n: sys.n_slots }) : ''

    const curve = (sys.curve || []).map((p) => p[1]).filter(Number.isFinite)
    const prev = sys.prev_close_equity_cents
    const p = pathFor(curve, 400, 110, 8, [prev])
    if (p) {
      pts = p.pts
      const ref = el('ref'), refLabel = el('refLabel')
      if (Number.isFinite(prev)) {
        const ry = p.y(prev)
        ref.setAttribute('y1', ry); ref.setAttribute('y2', ry)
        refLabel.style.top = `${(ry / 110) * 100}%`
        refLabel.textContent = t('arenaPvPrev')
        refLabel.hidden = false
      }
      const line = el('line')
      line.setAttribute('d', p.line)
      el('area').setAttribute('d', p.area)
      const color = curve[curve.length - 1] >= curve[0] ? '#30d158' : '#7cc0ff'
      line.setAttribute('stroke', color)
      const dot = el('dot')
      dot.style.left = `${(p.last[0] / 400) * 100}%`
      dot.style.top = `${(p.last[1] / 110) * 100}%`
      root.style.setProperty('--dot', color)
      dot.hidden = false
      if (!reduceMotion && !line.dataset.drawn) {
        line.dataset.drawn = '1'
        line.setAttribute('pathLength', '1')
        line.style.strokeDasharray = '1'
        line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1400, easing: 'cubic-bezier(.2,.8,.2,1)' })
        dot.animate([{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], { duration: 1500 })
      }
    }

    const slots = (snap.slots || []).filter((s) => Number.isFinite(s.live_return_bp))
      .sort((a, b) => b.live_return_bp - a.live_return_bp || String(a.slot_id).localeCompare(String(b.slot_id)))
      .slice(0, 5)
    const rows = el('rows')
    const top = Math.max(1, ...slots.map((s) => Math.abs(s.live_return_bp)))
    const fresh = !rows.dataset.filled
    rows.dataset.filled = '1'
    rows.textContent = ''
    slots.forEach((s, i) => {
      const li = document.createElement('li')
      const syms = (s.positions || []).map((x) => x.symbol).filter(Boolean)
      const sym = syms.length ? syms[0] + (syms.length > 1 ? ` +${syms.length - 1}` : '') : s.factor_target || '—'
      const w = Math.max(4, Math.round((Math.abs(s.live_return_bp) / top) * 100))
      li.innerHTML = `<span class="r">${i + 1}</span><span>${esc(s.slot_id)}</span><span class="sym"></span>` +
        `<span class="bar${s.live_return_bp < 0 ? ' is-neg' : ''}" aria-hidden="true"><i></i></span>` +
        `<span class="ret ${tone(s.live_return_bp)}">${pct(s.live_return_bp)}</span>`
      const bar = li.querySelector('.bar > i')
      if (reduceMotion) bar.style.width = w + '%'
      else requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = w + '%' }))
      li.querySelector('.sym').textContent = sym
      if (fresh && !reduceMotion) li.style.setProperty('--i', i); else li.style.animation = 'none'
      rows.appendChild(li)
    })

    trades = ((snap.trades || {}).recent || []).filter((x) => x && x.symbol && x.side).slice(0, 12)
    showTrade()

    let when = ''
    try {
      when = new Intl.DateTimeFormat(currentLang(), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(snap.published_utc || snap.ts_utc))
    } catch {}
    el('foot').textContent = t('arenaPvFoot') + (when ? ' · ' + t('arenaPvUpdated', { time: when }) : '')
  }

  /* the trade tape: the latest simulated fills, one at a time */
  function showTrade() {
    const tape = el('tape')
    if (!trades.length) { tape.hidden = true; return }
    const x = trades[tapeAt % trades.length]
    const buy = String(x.side).toUpperCase() === 'BUY'
    let when = ''
    try { when = new Intl.DateTimeFormat(currentLang(), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(x.confirmed_ny || x.bar_start_ny)) } catch {}
    const price = Number(x.price)
    const html = `<span>▸ ${esc(x.slot_id || '')} <b class="${buy ? 'buy' : 'sell'}">${buy ? 'BUY' : 'SELL'}</b> <span class="sym">${esc(x.symbol)}</span>${x.qty ? ` ×${esc(x.qty)}` : ''}${Number.isFinite(price) ? ` @ $${price.toFixed(2)}` : ''}</span>` +
      `<span class="when">${esc(when)} ET</span>`
    const first = tape.hidden
    tape.hidden = false
    if (reduceMotion || first) { tape.innerHTML = html; return }
    tape.classList.add('fade')
    setTimeout(() => { tape.innerHTML = html; tape.classList.remove('fade') }, 300)
  }

  const pulses = [...root.querySelectorAll('.arena-pulse')]
  function pulse(now) {
    if (pts.length > 1) {
      pulses.forEach((p, n) => {
        const k = ((now / 3600) + n * 0.5) % 1
        const fi = k * (pts.length - 1), i = Math.floor(fi), r = fi - i
        const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)]
        p.style.left = `${((a[0] + (b[0] - a[0]) * r) / 400) * 100}%`
        p.style.top = `${((a[1] + (b[1] - a[1]) * r) / 110) * 100}%`
        p.style.opacity = String(Math.min(1, k / 0.08, (1 - k) / 0.12) * 0.9)
      })
    }
    pulseRaf = requestAnimationFrame(pulse)
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
  // while on screen: the tape ticks and the snapshot refreshes
  whileVisible(root, (on) => {
    clearInterval(tapeTimer); clearInterval(refreshTimer); cancelAnimationFrame(pulseRaf)
    if (!on) pulses.forEach((p) => { p.style.opacity = '0' })
    if (!on || reduceMotion) return
    pulseRaf = requestAnimationFrame(pulse)
    tapeTimer = setInterval(() => { if (trades.length > 1) { tapeAt++; showTrade() } }, TAPE_MS)
    refreshTimer = setInterval(async () => { if (!exp) return; try { await fetchSnap(); render() } catch {} }, REFRESH_MS)
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

/* Cheek Beat preview: the 15-second teaser loads only when its card is on screen. It plays on its
   own on wide screens; phones and Save-Data visitors start it with the play button. */
function initCheekBeat(reduceMotion) {
  const pv = document.querySelector('.cb-pv')
  if (!pv) return
  const video = pv.querySelector('video'), btn = pv.querySelector('.cb-play')
  const auto = !reduceMotion && !navigator.connection?.saveData && matchMedia('(min-width: 768px)').matches
  let wanted = false, visible = false
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
  initMarketSignal(reduceMotion)
  initLux(reduceMotion)
}

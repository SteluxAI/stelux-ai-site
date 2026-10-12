import { t, currentLang, onLangChange } from './i18n.js'

/* Arena preview: the same public, read-only paper-trading snapshot the Arena page reads.
   Fetched once, only when the card nears the viewport; on any failure the card keeps its
   decorative curve and simply links to the live board. */
const FEED = 'https://steluxai.github.io/arena-live/data/'

const pct = (bp) => {
  const v = (bp || 0) / 100
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`
}
const tone = (bp) => (bp > 0 ? 'is-up' : bp < 0 ? 'is-dn' : 'is-flat')
const usd = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function pathFor(values, w, h, pad = 6) {
  if (values.length < 2) return null
  let min = Math.min(...values), max = Math.max(...values)
  if (max === min) { max += 1; min -= 1 }
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, pad + (1 - (v - min) / (max - min)) * (h - pad * 2)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return { line, area: `${line} L${w},${h} L0,${h} Z` }
}

function initArena(reduceMotion) {
  const root = document.querySelector('[data-arena-preview]')
  if (!root) return
  const el = (k) => root.querySelector(`[data-a="${k}"]`)
  let snap = null, exp = null

  function render() {
    if (!snap) return
    const sys = snap.system || {}
    const equity = sys.live_equity_status === 'known' ? sys.live_equity_cents : sys.ledger_equity_cents
    el('equity').textContent = Number.isFinite(equity) ? usd(equity) : '—'
    el('total').innerHTML = `<b class="${tone(sys.live_return_bp)}">${pct(sys.live_return_bp)}</b> ${t('arenaPvAll')}`
    el('day').innerHTML = `<b class="${tone(sys.live_day_return_bp)}">${pct(sys.live_day_return_bp)}</b> ${t('arenaPvToday')}`

    const ex = snap.experiment || {}
    const day = ex.day_index ?? exp?.day_index, total = ex.n_days ?? exp?.n_days
    el('meta').innerHTML = day ? `<b>${day}${total ? `<span class="text-white/35">/${total}</span>` : ''}</b>${t('arenaPvDay')}` : ''
    el('slots').textContent = sys.n_slots ? t('arenaPvSlots', { n: sys.n_slots }) : ''

    const curve = (sys.curve || []).map((p) => p[1]).filter(Number.isFinite)
    const p = pathFor(curve, 400, 110)
    if (p) {
      const line = el('line')
      line.setAttribute('d', p.line)
      el('area').setAttribute('d', p.area)
      const up = curve[curve.length - 1] >= curve[0]
      line.setAttribute('stroke', up ? '#30d158' : '#7cc0ff')
      if (!reduceMotion && !line.dataset.drawn) {
        line.dataset.drawn = '1'
        line.setAttribute('pathLength', '1')
        line.style.strokeDasharray = '1'
        line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1400, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
    }

    const slots = (snap.slots || []).filter((s) => Number.isFinite(s.live_return_bp))
      .sort((a, b) => b.live_return_bp - a.live_return_bp || String(a.slot_id).localeCompare(String(b.slot_id)))
      .slice(0, 5)
    const rows = el('rows')
    rows.textContent = ''
    slots.forEach((s, i) => {
      const li = document.createElement('li')
      const syms = (s.positions || []).map((x) => x.symbol).filter(Boolean)
      const sym = syms.length ? syms[0] + (syms.length > 1 ? ` +${syms.length - 1}` : '') : s.factor_target || '—'
      const sp = pathFor((s.curve || []).map((x) => x[1]).filter(Number.isFinite).slice(-60), 64, 20, 2)
      const color = s.live_return_bp >= 0 ? '#30d158' : '#ff453a'
      li.innerHTML = `<span class="r">${i + 1}</span><span>${s.slot_id}</span><span class="sym"></span>` +
        (sp ? `<svg viewBox="0 0 64 20" aria-hidden="true"><path d="${sp.line}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>` : '<span></span>') +
        `<span class="ret ${tone(s.live_return_bp)}">${pct(s.live_return_bp)}</span>`
      li.querySelector('.sym').textContent = sym
      rows.appendChild(li)
    })

    let when = ''
    try {
      when = new Intl.DateTimeFormat(currentLang(), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(snap.published_utc || snap.ts_utc))
    } catch {}
    el('foot').textContent = t('arenaPvFoot') + (when ? ' · ' + t('arenaPvUpdated', { time: when }) : '')
  }

  function fail() {
    root.classList.add('is-offline')
    el('equity').textContent = t('arenaPvOffline') + ' →'
  }

  async function load() {
    try {
      const ok = (r) => { if (!r.ok) throw new Error(r.status); return r.json() }
      const idx = await fetch(FEED + 'index.json', { cache: 'no-cache' }).then(ok)
      const list = idx.experiments || []
      exp = list.find((x) => x.experiment_id === idx.default && x.asset_class === 'stock') || list.find((x) => x.asset_class === 'stock' && x.is_live) || list.find((x) => x.experiment_id === idx.default)
      if (!exp) throw new Error('no experiment')
      snap = await fetch(`${FEED}${encodeURIComponent(exp.experiment_id)}/snapshot.json`, { cache: 'no-cache' }).then(ok)
      if (!snap.system) throw new Error('no system')
      render()
    } catch { fail() }
  }

  onLangChange(() => { if (snap) render(); else if (root.classList.contains('is-offline')) fail() })
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load() } }, { rootMargin: '600px 0px' })
  io.observe(root)
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
}

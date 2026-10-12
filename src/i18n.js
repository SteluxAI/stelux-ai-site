/* Page translations.
   English is the page's own markup and the default for every visitor. Other languages live in
   public/i18n/<code>.json and are fetched only when chosen; anything a language leaves out falls
   back to English. Markup hooks:
     data-i18n="key"        text content (a "\n" in a translation becomes a line break)
     data-i18n-aria="key"   aria-label
     data-i18n-alt="key"    alt
   Strings that only exist in JavaScript are registered with their English text in JS_EN below.
   ?lang=xx picks the language for one visit; the menu remembers an explicit choice in
   localStorage under "stelux-lang", which the Cheek Beat page reads as well. */

export const LANGS = [
  ['en', 'English', 'English'],
  ['zh-CN', '简体中文', 'Chinese (Simplified)'],
  ['zh-TW', '繁體中文', 'Chinese (Traditional)'],
  ['ja', '日本語', 'Japanese'],
  ['ko', '한국어', 'Korean'],
  ['es', 'Español', 'Spanish'],
  ['pt-BR', 'Português (Brasil)', 'Portuguese'],
  ['fr', 'Français', 'French'],
  ['de', 'Deutsch', 'German'],
  ['it', 'Italiano', 'Italian'],
  ['ru', 'Русский', 'Russian'],
  ['tr', 'Türkçe', 'Turkish'],
  ['id', 'Bahasa Indonesia', 'Indonesian'],
  ['vi', 'Tiếng Việt', 'Vietnamese'],
  ['th', 'ไทย', 'Thai'],
  ['hi', 'हिन्दी', 'Hindi'],
  ['ar', 'العربية', 'Arabic'],
]
const CODES = LANGS.map((l) => l[0])
const STORE_KEY = 'stelux-lang'
const LEGACY_KEY = 'cb-lang-choice' // the Cheek Beat page's own key, shared both ways

export const JS_EN = {
  metaTitle: 'Stelux AI — Enterprise AI Agents, Orchestration & GPU Compute',
  metaDesc: 'Explore Stelux AI: Arena stock research, the Cheek Beat rhythm game, and Michigan Property Intelligence. AI tools and original games from Stelux AI.',
  langLabel: 'Language',
  menuOpen: 'Open menu',
  menuClose: 'Close menu',
  copy: 'Copy',
  copied: 'Copied',
  selectToCopy: 'Select to copy',
  runIdle: 'idle',
  runRunning: 'running…',
  runLive: 'live · rd-8f2',
  viewOverview: 'Stelux Orchestrator',
  viewAgents: 'Swarm · research-desk',
  viewTasks: 'Task queue',
  viewData: 'Lakebase · finance/filings',
  viewCompute: 'Compute pool',
  viewLogs: 'Event stream',
  viewProducts: 'Stelux products',
  viewProductsSub: '3 live · 2 in development',
  arenaPvAll: 'all-time',
  arenaPvToday: 'today',
  arenaPvDay: 'experiment day',
  arenaPvSlots: '{n} strategy slots',
  arenaPvUpdated: 'Updated {time} ET',
  arenaPvOffline: 'Open the live board',
}

export function normLang(v) {
  v = String(v || '').trim().toLowerCase().replace('_', '-')
  if (!v) return ''
  if (v === 'zh' || v === 'zh-cn' || v === 'zh-hans' || v === 'zh-sg') return 'zh-CN'
  if (v === 'zh-tw' || v === 'zh-hk' || v === 'zh-mo' || v === 'zh-hant') return 'zh-TW'
  if (v === 'pt' || v === 'pt-br' || v === 'pt-pt') return 'pt-BR'
  if (v === 'in') return 'id'
  return CODES.find((c) => c.toLowerCase() === v) || ''
}

let lang = 'en'
let dict = {}
const EN = { ...JS_EN }
const cache = { en: {} }
const listeners = new Set()

export const currentLang = () => lang
export const isRTL = (l = lang) => l === 'ar'
export function onLangChange(fn) { listeners.add(fn) }
export function t(key, vars) {
  let s = dict[key] != null ? dict[key] : EN[key] != null ? EN[key] : ''
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k])
  return s
}

/* English source text of a node: <br> counts as "\n", other whitespace collapses. */
function sourceText(el) {
  let out = ''
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.nodeValue
    else if (n.nodeName === 'BR') out += '\n'
    else out += n.textContent
  }
  return out.replace(/[ \t\r\f\v]*\n[ \t\r\f\v]*/g, '\n').replace(/[ \t\r\f\v ]+/g, ' ').trim()
}

let nodes = [], arias = [], alts = []
const originalHTML = new WeakMap()
const brClass = new WeakMap() // a responsive <br class="hidden sm:inline"> keeps its class in translations
function collect() {
  nodes = [...document.querySelectorAll('[data-i18n]')]
  arias = [...document.querySelectorAll('[data-i18n-aria]')]
  alts = [...document.querySelectorAll('[data-i18n-alt]')]
  for (const n of nodes) {
    const k = n.dataset.i18n
    originalHTML.set(n, n.innerHTML)
    const br = n.querySelector('br[class]')
    if (br) brClass.set(n, br.className)
    if (!(k in EN)) EN[k] = sourceText(n)
  }
  for (const n of arias) { const k = n.dataset.i18nAria; if (!(k in EN)) EN[k] = n.getAttribute('aria-label') || '' }
  for (const n of alts) { const k = n.dataset.i18nAlt; if (!(k in EN)) EN[k] = n.getAttribute('alt') || '' }
}

function setText(el, value) {
  el.textContent = ''
  value.split('\n').forEach((part, i) => {
    if (i) { const br = document.createElement('br'); if (brClass.has(el)) br.className = brClass.get(el); el.appendChild(br) }
    el.appendChild(document.createTextNode(part))
  })
}

function apply() {
  for (const n of nodes) {
    const k = n.dataset.i18n
    if (lang === 'en' || dict[k] == null) n.innerHTML = originalHTML.get(n)
    else setText(n, dict[k])
  }
  for (const n of arias) n.setAttribute('aria-label', t(n.dataset.i18nAria))
  for (const n of alts) n.setAttribute('alt', t(n.dataset.i18nAlt))
  const root = document.documentElement
  root.lang = lang
  root.dir = isRTL() ? 'rtl' : 'ltr'
  document.title = t('metaTitle')
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('metaDesc'))
  listeners.forEach((fn) => fn(lang))
}

async function load(code) {
  if (cache[code]) return cache[code]
  const res = await fetch(`/i18n/${code}.json`)
  if (!res.ok) throw new Error(`i18n ${code}: ${res.status}`)
  return (cache[code] = await res.json())
}

export async function setLang(code, { remember = false } = {}) {
  code = normLang(code) || 'en'
  if (remember) {
    try { localStorage.setItem(STORE_KEY, code); localStorage.setItem(LEGACY_KEY, code) } catch {}
  }
  try { dict = await load(code); lang = code } catch { dict = {}; lang = 'en' }
  apply()
}

/* ---------- the Language menu ---------- */
function buildMenu(wrap) {
  const btn = wrap.querySelector('.lang-btn'), menu = wrap.querySelector('.lang-menu'), short = wrap.querySelector('.lang-short')
  const items = LANGS.map(([code, name, english]) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('role', 'menuitemradio')
    b.setAttribute('lang', code)
    b.dataset.code = code
    b.append(name)
    const sm = document.createElement('small')
    sm.setAttribute('lang', 'en'); sm.dir = 'ltr'; sm.textContent = english
    b.appendChild(sm)
    b.addEventListener('click', () => { close(true); setLang(code, { remember: true }) })
    menu.appendChild(b)
    return b
  })
  const sync = () => {
    let name = 'English'
    items.forEach((b) => {
      const on = b.dataset.code === lang
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
      if (on) name = b.firstChild.nodeValue
    })
    if (short) short.textContent = name
    btn.setAttribute('aria-label', `${t('langLabel')}: ${name}`)
  }
  onLangChange(sync)
  sync()
  const open = (focusCurrent) => {
    menu.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    if (focusCurrent) (items[CODES.indexOf(lang)] || items[0]).focus()
  }
  function close(refocus) {
    if (menu.hidden) return
    menu.hidden = true
    btn.setAttribute('aria-expanded', 'false')
    if (refocus) btn.focus()
  }
  btn.addEventListener('click', () => (menu.hidden ? open(false) : close(false)))
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true) }
  })
  menu.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement)
    const cols = getComputedStyle(menu).gridTemplateColumns.split(' ').length || 1
    let j = -1
    if (e.key === 'ArrowDown') j = i + cols
    else if (e.key === 'ArrowUp') j = i - cols
    else if (e.key === 'ArrowRight') j = i + (isRTL() ? -1 : 1)
    else if (e.key === 'ArrowLeft') j = i + (isRTL() ? 1 : -1)
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = items.length - 1
    else if (e.key === 'Escape') { e.preventDefault(); close(true); return }
    else if (e.key === 'Tab') { close(false); return }
    else return
    e.preventDefault()
    items[Math.max(0, Math.min(items.length - 1, j))].focus()
  })
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) close(false) })
  return { close }
}

export function initI18n() {
  collect()
  const menus = [...document.querySelectorAll('[data-lang-menu]')].map(buildMenu)
  let q = ''
  try { q = normLang(new URLSearchParams(location.search).get('lang')) } catch {}
  let saved = ''
  try { saved = normLang(localStorage.getItem(STORE_KEY)) || normLang(localStorage.getItem(LEGACY_KEY)) } catch {}
  const start = q || saved || 'en'
  if (start !== 'en') setLang(start)
  else apply()
  return { closeMenus: () => menus.forEach((m) => m.close(false)) }
}

/* Dev only: the English source strings, for building public/i18n/*.json. */
if (import.meta.env.DEV) window.__steluxI18nSource = () => ({ ...EN })

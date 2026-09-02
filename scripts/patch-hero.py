import io, sys

def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for old, new in pairs:
        if old not in s:
            print('MISSING in', path, ':', old[:70].replace('\n', ' '))
            sys.exit(1)
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8').write(s)
    print('patched', path)

# ---------- index.html ----------
html = open('index.html', encoding='utf-8').read()
start = html.index('<div class="relative flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-16 text-center sm:pb-32 sm:pt-24">')
end_marker = '<a href="#pricing" class="dash-cta">Launch Platform</a>'
end = html.index(end_marker) + len(end_marker)
old_identity = html[start:end]
new_identity = '''<div class="relative flex flex-col items-center px-5 pt-14 text-center sm:px-6 sm:pt-[104px]">
                  <div class="dash-avatar" aria-hidden="true">S</div>
                  <div id="dash-title" class="mt-3 text-[16px] font-semibold tracking-tight text-[#1b191e]">Stelux Orchestrator</div>
                  <div id="dash-sub" class="mt-1 flex items-center justify-center gap-2 text-[13px] text-[#4f4a57]"><span class="live-dot"></span><span id="term-live">12 agents live</span><span class="text-[#8d8794]">&middot;</span><span id="dash-sub-text">research-desk</span></div>
                  <div id="dash-ticker" class="mt-3 w-full max-w-md truncate font-mono text-[11px] text-[#5e5866]" aria-live="polite"></div>
                  <a href="#pricing" class="dash-cta mt-6">Launch Platform</a>
                </div>'''
patch('index.html', [
    ('''        <canvas id="aurora"></canvas>
        <img class="hills" src="/assets/hills.svg" alt="" decoding="async">''',
     '''        <canvas id="aurora"></canvas>
        <div class="hills-wrap"><img class="hills" src="/assets/hills.svg" alt="" decoding="async"></div>'''),
    ('<div id="terminal" class="terminal mx-auto mt-12 max-w-5xl sm:mt-16">',
     '<div id="terminal" class="terminal mx-auto mt-10 max-w-5xl sm:mt-12">'),
    ('<div class="dash-widget absolute left-4 top-4 hidden w-[232px] sm:block">\n                  <div class="dash-widget-title"><span>Swarm · research-desk</span>',
     '<div class="dash-widget absolute left-4 top-4 hidden w-[236px] sm:block">\n                  <div class="dash-widget-title"><span class="whitespace-nowrap">Swarm · research-desk</span>'),
    (old_identity, new_identity),
    ('<section id="products" class="relative py-24 sm:py-32">',
     '<section id="products" class="relative pb-24 pt-10 sm:pb-32 sm:pt-12">'),
])

# ---------- style.css ----------
patch('src/style.css', [
    ('''  --fg-h: 32vh;
}''', '''  --fg-h: 32vh;
  --horizon: 62svh;
  --crest: 27.2vw;
  --overlap: 200px;
}'''),
    ('''  top: -10%; bottom: 0;''', '''  top: 0; bottom: 0;'''),
    ('''.hills {
  position: absolute;
  left: 0; bottom: 0;
  width: 100%; height: auto;
  display: block;
}
@media (max-width: 767px) {
  .hills { width: 230%; left: -65%; }
}
.hero-content {
  padding-bottom: calc(var(--fg-h) - 96px);
}''', '''.hills-wrap {
  position: absolute;
  left: 0; right: 0;
  top: calc(var(--horizon) - var(--crest));
  bottom: 0;
  background: #0f140c;
  overflow: hidden;
}
.hills {
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: auto;
  display: block;
}
@media (max-width: 767px) {
  :root { --horizon: 76svh; --crest: 62.6vw; --overlap: 120px; }
  .hills { width: 230%; left: -65%; }
}
.hero-content {
  padding-bottom: calc(var(--fg-h) - var(--overlap));
}'''),
    ('''@media (max-width: 767px) {
  :root { --fg-h: 22vh; }
  .hero-content { padding-bottom: calc(var(--fg-h) - 40px); }
  .hero-fade { height: 16%; }
}''', '''@media (max-width: 767px) {
  :root { --fg-h: 22vh; }
  .hero-fade { height: 16%; }
}'''),
    ('''.dash-main {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  background: #f4f4f3;
}
@media (min-width: 640px) { .dash-main { min-height: 500px; } }''', '''.dash-main {
  min-height: 440px;
  display: flex;
  flex-direction: column;
  background: #f4f4f3;
}
@media (min-width: 640px) { .dash-main { min-height: 540px; } }'''),
    ('''.dash-cta {
  position: absolute;
  left: 20px; right: 20px; bottom: 56px;
  z-index: 3;
  display: flex; align-items: center; justify-content: center;
  height: 46px;''', '''.dash-cta {
  position: relative;
  z-index: 3;
  display: flex; align-items: center; justify-content: center;
  width: 100%; max-width: 560px;
  height: 46px;'''),
    ('''@media (max-width: 767px) { .dash-cta { bottom: 40px; left: 16px; right: 16px; } }
''', ''),
    ('''  grid-template-columns: 22px minmax(0, 1fr) 56px;''', '''  grid-template-columns: 22px minmax(0, 1fr) 62px;'''),
])

# ---------- main.js ----------
patch('src/main.js', [
    ('''  function draw(t) {
    ctx.globalCompositeOperation = 'source-over'
    const g = ctx.createLinearGradient(0, 0, 0, h)
    RAMP.forEach(([o, c]) => g.addColorStop(o, c))''', '''  const hills = document.querySelector('.hills-wrap')
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
    g.addColorStop(1, RAMP[RAMP.length - 1][1])'''),
    ('''    { x: 0.30, y: 0.62, r: 0.55, c: '214,168,176', a: 0.16, sx: 0.00009, sy: 0.00007, p: 0.0 },
    { x: 0.76, y: 0.52, r: 0.50, c: '176,160,190', a: 0.14, sx: 0.00007, sy: 0.00010, p: 2.1 },
    { x: 0.52, y: 0.88, r: 0.60, c: '226,200,196', a: 0.12, sx: 0.00006, sy: 0.00008, p: 4.2 },
    { x: 0.14, y: 0.22, r: 0.55, c: '22,20,24', a: 0.42, sx: 0.00008, sy: 0.00006, p: 1.3 },
    { x: 0.88, y: 0.18, r: 0.45, c: '30,26,30', a: 0.34, sx: 0.00007, sy: 0.00009, p: 3.4 },''',
     '''    { x: 0.30, y: 0.30, r: 0.40, c: '214,168,176', a: 0.14, sx: 0.00009, sy: 0.00007, p: 0.0 },
    { x: 0.76, y: 0.26, r: 0.36, c: '176,160,190', a: 0.12, sx: 0.00007, sy: 0.00010, p: 2.1 },
    { x: 0.52, y: 0.40, r: 0.42, c: '226,200,196', a: 0.10, sx: 0.00006, sy: 0.00008, p: 4.2 },
    { x: 0.12, y: 0.06, r: 0.34, c: '10,9,11', a: 0.45, sx: 0.00008, sy: 0.00006, p: 1.3 },
    { x: 0.90, y: 0.05, r: 0.30, c: '12,10,13', a: 0.40, sx: 0.00007, sy: 0.00009, p: 3.4 },'''),
    ('''    <span class="min-w-0"><span class="flex items-baseline justify-between gap-2"><span class="truncate font-mono text-[10.5px] text-white/85">${a.name}</span><span class="agent-task truncate text-[9.5px] text-white/40">${a.tasks[0]}</span></span><span class="bar mt-1"><i style="width:${a.p}%"></i></span></span>''',
     '''    <span class="min-w-0" title="${a.tasks[0]}"><span class="block truncate font-mono text-[10.5px] text-white/85">${a.name}</span><span class="bar mt-1"><i style="width:${a.p}%"></i></span></span>'''),
    ("  a.el = { task: row.querySelector('.agent-task'), bar: row.querySelector('.bar > i'), status: row.querySelector('.status') }",
     "  a.el = { task: row.querySelector('.min-w-0'), bar: row.querySelector('.bar > i'), status: row.querySelector('.status') }"),
    ("      a.el.task.textContent = a.tasks[a.ti]\n      a.s = a.name", "      a.el.task.title = a.tasks[a.ti]\n      a.s = a.name"),
    ("  } else {\n    a.ti = (a.ti + 1) % a.tasks.length\n    a.el.task.textContent = a.tasks[a.ti]\n  }",
     "  } else {\n    a.ti = (a.ti + 1) % a.tasks.length\n    a.el.task.title = a.tasks[a.ti]\n  }"),
])

# ---------- hills.svg: unify bottom edge ----------
patch('public/assets/hills.svg', [
    ('  </g>\n</svg>', '''  </g>
  <defs><linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f140c" stop-opacity="0"/><stop offset="1" stop-color="#0f140c" stop-opacity="1"/></linearGradient></defs>
  <rect x="0" y="620" width="1440" height="140" fill="url(#base)"/>
</svg>'''),
])
print('all patches applied')

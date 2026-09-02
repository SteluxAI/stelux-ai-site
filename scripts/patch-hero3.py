import sys

def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for old, new in pairs:
        if old not in s:
            print('MISSING in', path, ':', old[:80].replace('\n', ' '))
            sys.exit(1)
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8').write(s)
    print('patched', path)

patch('src/style.css', [
    ('''  --horizon: 68svh;
  --crest: 27.2vw;
  --hills-h: 52.8vw;
  --fol-h: 29.75vw;
  --overlap: 250px;''', '''  --horizon: 68svh;
  --crest: 27.2vw;
  --hills-h: 52.8vw;
  --fol-h: 29.75vw;
  --overlap: 270px;'''),
    ('''@media (max-width: 767px) {
  :root { --horizon: 76svh; --crest: 62.6vw; --hills-h: 121.4vw; --fol-h: 68.4vw; --overlap: 110px; }
  .hills { width: 230%; left: -65%; }
}''', '''@media (max-width: 767px) {
  :root { --horizon: 74svh; --crest: 46.2vw; --hills-h: 89.8vw; --fol-h: 68.4vw; --overlap: 110px; }
  .hills { width: 170%; left: -35%; }
}'''),
    ('''  @apply font-display font-medium tracking-[-0.03em] text-[42px] leading-[1.02] sm:text-[62px] lg:text-[76px] text-white;''',
     '''  @apply font-display font-medium tracking-[-0.03em] text-[42px] leading-[1.02] sm:text-[56px] lg:text-[68px] text-white;'''),
])

patch('index.html', [
    ('<div class="hero-content relative z-10 mx-auto max-w-7xl px-5 pt-32 sm:px-8 sm:pt-36 lg:pt-40"><div class="hero-copy-wrap">',
     '<div class="hero-content relative z-10 mx-auto max-w-7xl px-5 pt-32 sm:px-8 sm:pt-36"><div class="hero-copy-wrap">'),
    ('<h1 class="hero-h1 mt-6">Orchestrate intelligence<br>at enterprise scale.</h1>',
     '<h1 class="hero-h1 mt-5">Orchestrate intelligence<br>at enterprise scale.</h1>'),
    ('<p class="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-white/70 sm:text-[17px]">',
     '<p class="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-white/70 sm:text-[17px]">'),
    ('<div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">\n            <a href="#pricing" class="btn-light',
     '<div class="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">\n            <a href="#pricing" class="btn-light'),
    ('<div id="terminal" class="terminal mx-auto mt-10 max-w-5xl sm:mt-11">',
     '<div id="terminal" class="terminal mx-auto mt-10 max-w-5xl sm:mt-10">'),
    ('<div class="dash-widget-title"><span class="whitespace-nowrap">Swarm · research-desk</span><span id="m-tasks" class="text-emerald-300">4,812/min</span></div>',
     '<div class="dash-widget-title"><span class="whitespace-nowrap">Swarm</span><span id="m-tasks" class="whitespace-nowrap text-emerald-300">4,812 tasks/min</span></div>'),
    ('<div id="dash-ticker" class="mt-3 w-full max-w-md truncate font-mono text-[11px] text-[#5e5866]" aria-live="polite"></div>',
     '<div id="dash-ticker" class="mt-3 w-full max-w-md truncate font-mono text-[11px] text-[#464150]" aria-live="polite"></div>'),
    ('<div class="hills-wrap"><img class="hills" src="/assets/hills.svg" alt="" decoding="async"></div>',
     '<div class="hills-wrap"><img class="hills" src="/assets/hills.webp" alt="" decoding="async" fetchpriority="high"></div>'),
    ('<img src="/assets/foliage.svg" alt="" decoding="async">',
     '<img src="/assets/foliage.webp" alt="" decoding="async" fetchpriority="high">'),
])

patch('src/main.js', [
    ("  mTasks.textContent = fmt(randi(4400, 5300)) + '/min'", "  mTasks.textContent = fmt(randi(4400, 5300)) + ' tasks/min'"),
])

patch('scripts/screenshots.mjs', [
    ('    await page.waitForTimeout(1500)\n    const audit', '    await page.waitForTimeout(1900)\n    const audit'),
])
print('all patches applied')

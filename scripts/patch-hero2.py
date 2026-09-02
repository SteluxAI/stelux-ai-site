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
    ('''  --horizon: 62svh;
  --crest: 27.2vw;
  --overlap: 200px;
}''', '''  --horizon: 68svh;
  --crest: 27.2vw;
  --hills-h: 52.8vw;
  --fol-h: 29.75vw;
  --overlap: 250px;
}'''),
    ('''.hills-wrap {
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
}''', '''.hills-wrap {
  position: absolute;
  left: 0; right: 0;
  top: calc(var(--horizon) - var(--crest));
  bottom: 0;
  overflow: hidden;
}
.hills-wrap::after {
  content: "";
  position: absolute;
  left: 0; right: 0;
  top: calc(var(--hills-h) - 2px);
  bottom: 0;
  background: #0f140c;
}
.hills {
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: auto;
  display: block;
}
@media (max-width: 767px) {
  :root { --horizon: 76svh; --crest: 62.6vw; --hills-h: 121.4vw; --fol-h: 68.4vw; --overlap: 110px; }
  .hills { width: 230%; left: -65%; }
}'''),
    ('''.hero-fg {
  position: absolute;
  left: -1%; right: -1%;
  bottom: -2vh;
  height: calc(var(--fg-h) + 2vh);
  z-index: 20;
  pointer-events: none;
  will-change: transform;
}
.hero-fg img {
  width: 100%; height: 100%;
  display: block;
  object-fit: cover;
  object-position: center top;
}''', '''.hero-fg {
  position: absolute;
  left: -1%; right: -1%;
  top: calc(100% - var(--fg-h));
  bottom: -45%;
  z-index: 20;
  pointer-events: none;
  will-change: transform;
}
.hero-fg img {
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: auto;
  display: block;
}
.hero-fg::after {
  content: "";
  position: absolute;
  left: 0; right: 0;
  top: calc(var(--fol-h) - 2px);
  bottom: 0;
  background: #0a0908;
}
@media (max-width: 767px) {
  .hero-fg img { width: 230%; left: -65%; }
}'''),
    ('''.dash-main {
  min-height: 440px;
  display: flex;
  flex-direction: column;
  background: #f4f4f3;
}
@media (min-width: 640px) { .dash-main { min-height: 540px; } }''', '''.dash-main {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  background: #f4f4f3;
}
@media (min-width: 640px) { .dash-main { min-height: 480px; } }'''),
])

patch('index.html', [
    ('<div class="relative flex flex-col items-center px-5 pt-14 text-center sm:px-6 sm:pt-[104px]">',
     '<div class="relative flex flex-col items-center px-5 pt-12 text-center sm:px-6 sm:pt-11">'),
    ('<div id="terminal" class="terminal mx-auto mt-10 max-w-5xl sm:mt-12">',
     '<div id="terminal" class="terminal mx-auto mt-10 max-w-5xl sm:mt-11">'),
    ('<div class="hero-content relative z-10 mx-auto max-w-7xl px-5 pt-32 sm:px-8 sm:pt-40 lg:pt-44">',
     '<div class="hero-content relative z-10 mx-auto max-w-7xl px-5 pt-32 sm:px-8 sm:pt-36 lg:pt-40"><div class="hero-copy-wrap">'),
    ('''            <a href="#products" class="btn-ghost px-6 py-3 text-[15px]">Explore products</a>
          </div>
        </div>
''', '''            <a href="#products" class="btn-ghost px-6 py-3 text-[15px]">Explore products</a>
          </div>
        </div>
        </div>
'''),
])

patch('src/main.js', [
    ('''  { id: 'A2', name: 'analyst-2', tasks: ['Parsing earnings calls', 'Clustering sentiment', 'Tagging guidance'], p: 41, s: 'running' },
''', ''),
])
print('all patches applied')

"""
Procedural hero scenery renderer (no external art, deterministic).
  public/img/hills.webp    2880x1520  transparent above the crests: lit rolling hills, grass texture, atmospheric haze
  public/img/foliage.webp  2880x1000  transparent above the canopy: particle treetops with warm dusk highlights
  shots/preview-hills.png / shots/preview-foliage.png  half-size previews (transparent shown over #08080a)
"""
import math, os, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

t0 = time.time()
os.makedirs('public/img', exist_ok=True)
os.makedirs('shots', exist_ok=True)

# ----------------------------------------------------------------------------- helpers
def value_noise(w, h, scale, octaves=3, seed=0, persistence=0.5):
    """Smooth value noise in [0,1] (bicubic-upsampled random grids)."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), dtype=np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        gw, gh = w // s + 3, h // s + 3
        grid = (r.random((gh, gw)) * 65535).astype(np.uint16)
        img = Image.fromarray(grid, 'I;16').resize((gw * s, gh * s), Image.BICUBIC)
        arr = np.asarray(img, dtype=np.float32)[:h, :w] / 65535.0
        out += arr * amp
        total += amp
        amp *= persistence
    return out / total

def box_blur1d(a, r, axis):
    if r <= 0:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r, r)
    p = np.pad(a, pad, mode='edge')
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    n = a.shape[axis]
    sl_hi = [slice(None)] * a.ndim; sl_lo = [slice(None)] * a.ndim
    sl_hi[axis] = slice(2 * r + 1, 2 * r + 1 + n) if False else slice(2 * r, 2 * r + n)
    sl_lo[axis] = slice(0, n)
    # sum over window [i, i+2r] of padded == a[i-r..i+r]
    c0 = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    hi = [slice(None)] * a.ndim; lo = [slice(None)] * a.ndim
    hi[axis] = slice(2 * r + 1, 2 * r + 1 + n); lo[axis] = slice(0, n)
    return ((c0[tuple(hi)] - c0[tuple(lo)]) / (2 * r + 1)).astype(np.float32)

def blur(a, r):
    """Cheap gaussian-ish blur: 3 box passes, float, no quantisation."""
    r = int(r)
    if r <= 0:
        return a
    for _ in range(3):
        a = box_blur1d(box_blur1d(a, r, 1), r, 0)
    return a

def lerp(a, b, t):
    return a + (b - a) * t

class Canvas:
    """Premultiplied float RGBA buffer with correct 'over' compositing."""
    def __init__(self, w, h):
        self.pm = np.zeros((h, w, 3), dtype=np.float32)
        self.a = np.zeros((h, w), dtype=np.float32)
    def over(self, rgb, a):
        a = np.clip(a, 0, 1).astype(np.float32)
        self.pm = rgb * a[..., None] + self.pm * (1 - a)[..., None]
        self.a = a + self.a * (1 - a)
    def image(self):
        rgb = self.pm / np.maximum(self.a, 1e-6)[..., None]
        out = np.concatenate([np.clip(rgb, 0, 1), np.clip(self.a, 0, 1)[..., None]], axis=-1)
        return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')

def save(img, path, quality, preview):
    img.save(path, 'WEBP', quality=quality, method=6)
    bg = Image.new('RGBA', img.size, (8, 8, 10, 255))
    bg.alpha_composite(img)
    bg.convert('RGB').resize((img.width // 2, img.height // 2), Image.LANCZOS).save(preview)
    print(f'{path} {os.path.getsize(path) // 1024} KB  {time.time() - t0:.1f}s')

# ----------------------------------------------------------------------------- HILLS
W, H = 2880, 1520
xs = np.arange(W, dtype=np.float32)
ys = np.arange(H, dtype=np.float32)[:, None]

HAZE = np.array([164, 138, 144], dtype=np.float32) / 255.0     # dusk sky at the horizon
HAZE_LIGHT = np.array([196, 168, 170], dtype=np.float32) / 255.0
SUN = np.array([1.0, 0.90, 0.66], dtype=np.float32)

def mound(cx, width, height, base):
    return base - height * np.exp(-0.5 * ((xs - cx) / width) ** 2)

LAYERS = [  # far -> near
    dict(base=1000, haze=0.60, dark=(56, 64, 50), lit=(132, 138, 98), tex=0.045, soft=6,
         mounds=[(-150, 560, 200), (640, 680, 140), (1380, 600, 180), (2180, 720, 250), (2960, 640, 230)]),
    dict(base=1110, haze=0.40, dark=(40, 54, 34), lit=(120, 130, 74), tex=0.075, soft=3,
         mounds=[(170, 470, 300), (930, 560, 210), (1720, 560, 170), (2540, 720, 400), (3240, 560, 250)]),
    dict(base=1250, haze=0.20, dark=(27, 40, 23), lit=(104, 116, 58), tex=0.10, soft=2,
         mounds=[(-220, 520, 270), (560, 520, 330), (1340, 600, 190), (2180, 560, 240), (2840, 600, 360)]),
    dict(base=1410, haze=0.07, dark=(16, 26, 14), lit=(78, 90, 42), tex=0.12, soft=1,
         mounds=[(60, 660, 300), (1000, 560, 210), (1860, 680, 180), (2720, 700, 360)]),
]

cv = Canvas(W, H)
grass_fine = value_noise(W, H, 4, octaves=2, seed=11)
grass_mid = value_noise(W, H, 40, octaves=3, seed=12)
contour = value_noise(W, H, 260, octaves=2, seed=13)

# soft horizon glow above the farthest crest (analytic, no banding)
far_crest = np.min(np.stack([mound(cx, w, h, LAYERS[0]['base']) for cx, w, h in LAYERS[0]['mounds']]), axis=0)
above = far_crest[None, :] - ys                                  # >0 above the crest
glow = np.where(above > 0, np.exp(-np.clip(above, 0, None) / 150.0), 0.0).astype(np.float32) * 0.30
cv.over(np.broadcast_to(HAZE_LIGHT, (H, W, 3)), glow)

for li, L in enumerate(LAYERS):
    dark = np.array(L['dark'], dtype=np.float32) / 255.0
    lit = np.array(L['lit'], dtype=np.float32) / 255.0
    order = sorted(range(len(L['mounds'])), key=lambda i: -L['mounds'][i][2])   # tallest (farthest) first
    for mi in order:
        cx, width, height = L['mounds'][mi]
        crest = mound(cx, width, height, L['base'])
        slope = np.gradient(crest)                                      # smooth 1-D slope
        light1d = np.clip(0.55 - slope * 1.9, 0.06, 1.0)                # left-facing slopes catch the light
        fringe = crest + (value_noise(W, 1, 7, octaves=2, seed=100 + li * 10 + mi)[0] - 0.5) * (2.0 + 2.0 * (1 - L['haze']))
        depth = ys - fringe[None, :]
        mask = np.clip(depth + 0.5, 0, 1)
        if L['soft'] > 1:
            mask = blur(mask, L['soft'] // 2)
        # ambient occlusion: darken whatever sits just above this mound's crest line
        ao_above = np.clip(crest[None, :] - ys, 0, None)
        ao = np.where(ys < crest[None, :], np.exp(-ao_above / 26.0), 0.0).astype(np.float32) * 0.38
        cv.over(np.zeros((H, W, 3), dtype=np.float32) + np.array([0.04, 0.06, 0.03], dtype=np.float32), ao)
        d = np.clip(ys - crest[None, :], 0, None)
        rim = np.exp(-d / (34.0 + 26.0 * (1 - L['haze'])))              # bright crest edge
        falloff = np.exp(-d / (380.0 * (0.6 + height / 300.0)))         # darker toward the base
        dome = np.exp(-0.5 * ((xs - (cx - 0.28 * width)) / (0.9 * width)) ** 2)[None, :]   # lit dome centre
        shade = light1d[None, :] * (0.42 + 0.58 * falloff) * (0.72 + 0.28 * dome) * (0.86 + 0.28 * contour)
        shade = shade + rim * light1d[None, :] * 0.5
        rgb = lerp(dark[None, None, :], lit[None, None, :], np.clip(shade, 0, 1)[..., None])
        rgb = rgb + (rim * light1d[None, :] * 0.16)[..., None] * SUN[None, None, :]
        tex = 1 + (grass_fine - 0.5) * L['tex'] * 2.0 + (grass_mid - 0.5) * L['tex'] * 1.3
        rgb = rgb * tex[..., None]
        rgb = lerp(rgb, HAZE[None, None, :], (L['haze'] * (0.72 + 0.28 * (1 - falloff)))[..., None])
        cv.over(np.clip(rgb, 0, 1), mask)
    print(f'hills layer {li} done {time.time() - t0:.1f}s')

# settle the very bottom into the css filler colour
BASE = np.array([15, 20, 12], dtype=np.float32) / 255.0
bottom = np.clip((ys - (H - 140)) / 140.0, 0, 1) * np.ones((1, W), dtype=np.float32)
cv.pm = lerp(cv.pm, BASE[None, None, :] * cv.a[..., None], bottom[..., None])
save(cv.image(), 'public/img/hills.webp', 88, 'shots/preview-hills.png')

# ----------------------------------------------------------------------------- FOLIAGE
FW, FH = 2880, 1000
fxs = np.arange(FW, dtype=np.float32)
canopy = 170 + (value_noise(FW, 1, 420, octaves=3, seed=77)[0] - 0.5) * 220     # silhouette guide line

BANDS = [  # back -> front
    dict(count=120, r=(34, 84), dy=(-20, 60), blur=2, n=1.0, size=(2.2, 5.0), haze=0.20,
         shadow=(52, 46, 40), mid=(98, 84, 68), hi=(176, 130, 116)),
    dict(count=100, r=(50, 115), dy=(20, 140), blur=1, n=1.2, size=(2.6, 6.2), haze=0.06,
         shadow=(20, 19, 15), mid=(52, 47, 34), hi=(118, 88, 74)),
    dict(count=90, r=(70, 150), dy=(100, 260), blur=0, n=1.7, size=(2.6, 6.6), haze=0.0,
         shadow=(8, 8, 6), mid=(30, 28, 19), hi=(68, 52, 43)),
    dict(count=70, r=(90, 170), dy=(280, 460), blur=0, n=1.5, size=(2.8, 7.0), haze=0.0,
         shadow=(6, 6, 5), mid=(22, 20, 14), hi=(46, 36, 30)),
]

def draw_band(B, seed):
    r = np.random.default_rng(seed)
    layer = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sh, md, hi = (np.array(B[k], dtype=np.float32) for k in ('shadow', 'mid', 'hi'))
    if B['haze'] > 0:
        hz = HAZE_LIGHT * 255
        sh, md, hi = (lerp(c, hz, B['haze']) for c in (sh, md, hi))
    centers = np.sort(r.uniform(-60, FW + 60, B['count']))
    for cx in centers:
        rad = r.uniform(*B['r'])
        tall = r.random() < 0.18
        rx, ry = (rad * r.uniform(0.6, 0.8), rad * r.uniform(1.3, 1.7)) if tall else (rad * r.uniform(1.0, 1.4), rad)
        tint = np.array([r.normal(-2, 4), r.normal(7, 5), r.normal(-7, 3)], dtype=np.float32)
        cy = canopy[int(np.clip(cx, 0, FW - 1))] + ry * 0.55 + r.uniform(*B['dy'])
        n = int(1400 * (rad / 100.0) ** 2 * B['n']) + 120
        ang = r.uniform(0, 2 * math.pi, n)
        rr = np.sqrt(r.uniform(0, 1, n))
        px = cx + np.cos(ang) * rr * rx
        py = cy + np.sin(ang) * rr * ry * (0.85 + 0.3 * (np.sin(ang) > 0))   # bottoms sag a little
        up = np.clip((cy - py) / ry, -1, 1)
        left = np.clip((cx - px) / rx, -1, 1)
        t = np.clip(0.48 + 0.40 * up + 0.16 * left + r.normal(0, 0.15, n), 0, 1)
        sizes = r.uniform(B['size'][0], B['size'][1], n) * (0.7 + 0.5 * rr)
        for i in np.argsort(t):
            tt = t[i]
            col = sh + (md - sh) * (tt / 0.5) if tt < 0.5 else md + (hi - md) * ((tt - 0.5) / 0.5)
            col = np.clip(col + tint + r.normal(0, 5, 3), 0, 255)
            s = float(sizes[i])
            x0, y0 = float(px[i]) - s, float(py[i]) - s * 0.9
            d.ellipse([x0, y0, x0 + 2 * s, y0 + 1.8 * s], fill=(int(col[0]), int(col[1]), int(col[2]), 255))
    if B['blur'] > 0:
        layer = layer.filter(ImageFilter.GaussianBlur(B['blur']))
    return layer

fol = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
for bi, B in enumerate(BANDS):
    fol = Image.alpha_composite(fol, draw_band(B, 500 + bi))
    print(f'foliage band {bi} done {time.time() - t0:.1f}s')

arr = np.asarray(fol).astype(np.float32) / 255.0
fy = np.arange(FH, dtype=np.float32)[:, None]
GROUND = np.array([10, 9, 8], dtype=np.float32) / 255.0
fc = Canvas(FW, FH)
# opaque ground behind the trees, starting well inside the canopy so no gap can show
ground_a = np.clip((fy - 300) / 90.0, 0, 1) * np.ones((1, FW), dtype=np.float32)
fc.over(np.broadcast_to(GROUND, (FH, FW, 3)), ground_a)
fc.over(arr[..., :3], arr[..., 3])
# depth: darken the lower canopy into the ground tone
dark = np.clip((fy - 420) / 520.0, 0, 1) * np.ones((1, FW), dtype=np.float32)
fc.pm = lerp(fc.pm, GROUND[None, None, :] * fc.a[..., None], (dark * 0.9)[..., None])
save(fc.image(), 'public/img/foliage.webp', 86, 'shots/preview-foliage.png')

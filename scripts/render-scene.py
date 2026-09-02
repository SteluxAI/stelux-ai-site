"""
Procedural hero scenery renderer (no external art, deterministic).
  public/img/hills.webp    2880x1520  transparent above the crests: asymmetric rolling hills with undulating crests,
                                      streaked grass, mottling, hedgerow scrub, atmospheric haze, crest occlusion
  public/img/foliage.webp  2880x1000  transparent above the canopy: dense dark treetop silhouettes built from
                                      sub-clustered leaf particles, warm dusk rim light on the crown tops only
  shots/preview-hills.png / shots/preview-foliage.png  half-size previews (over #08080a)
"""
import math, os, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

t0 = time.time()
os.makedirs('public/img', exist_ok=True)
os.makedirs('shots', exist_ok=True)

# ----------------------------------------------------------------------------- helpers
def value_noise(w, h, scale, octaves=3, seed=0, persistence=0.5):
    """Smooth value noise in [0,1] (bicubic-upsampled random grids, 16-bit)."""
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

def stretched_noise(w, h, scale, stretch, seed):
    """Noise stretched horizontally (streaks that follow the slopes)."""
    base = value_noise(max(4, w // stretch), h, scale, octaves=2, seed=seed)
    img = Image.fromarray((base * 65535).astype(np.uint16), 'I;16').resize((w, h), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 65535.0

def box_blur1d(a, r, axis):
    if r <= 0:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r, r)
    p = np.pad(a, pad, mode='edge')
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    n = a.shape[axis]
    c0 = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    hi = [slice(None)] * a.ndim; lo = [slice(None)] * a.ndim
    hi[axis] = slice(2 * r + 1, 2 * r + 1 + n); lo[axis] = slice(0, n)
    return ((c0[tuple(hi)] - c0[tuple(lo)]) / (2 * r + 1)).astype(np.float32)

def blur(a, r):
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
    def over_image(self, img):
        arr = np.asarray(img).astype(np.float32) / 255.0
        self.over(arr[..., :3], arr[..., 3])
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

HAZE = np.array([164, 138, 144], dtype=np.float32) / 255.0
HAZE_LIGHT = np.array([196, 168, 170], dtype=np.float32) / 255.0
SUN = np.array([1.0, 0.90, 0.66], dtype=np.float32)
SCRUB = (14, 22, 11)

def mound(cx, width, height, base, skew):
    """Asymmetric mound: a long lee slope on one side (skew sign picks the side)."""
    wx = width * (1 + skew * np.tanh((xs - cx) / width))
    return base - height * np.exp(-0.5 * ((xs - cx) / wx) ** 2)

LAYERS = [  # far -> near
    dict(base=1000, haze=0.60, dark=(56, 64, 50), lit=(132, 138, 98), tex=0.05, soft=6, scrub=0,
         mounds=[(-150, 560, 200), (640, 680, 140), (1380, 600, 180), (2180, 720, 250), (2960, 640, 230)]),
    dict(base=1110, haze=0.40, dark=(40, 54, 34), lit=(120, 130, 74), tex=0.08, soft=3, scrub=0,
         mounds=[(170, 470, 300), (930, 560, 210), (1720, 560, 170), (2540, 720, 400), (3240, 560, 250)]),
    dict(base=1250, haze=0.20, dark=(24, 38, 20), lit=(104, 116, 62), tex=0.11, soft=2, scrub=260,
         mounds=[(-220, 520, 270), (560, 520, 330), (1340, 600, 190), (2180, 560, 240), (2840, 600, 360)]),
    dict(base=1410, haze=0.07, dark=(8, 14, 7), lit=(92, 106, 52), tex=0.13, soft=1, scrub=360,
         mounds=[(60, 660, 300), (1000, 560, 210), (1860, 680, 180), (2720, 700, 360)]),
]

cv = Canvas(W, H)
streaks = stretched_noise(W, H, 6, 4, seed=11)          # grass streaks following the slopes
mottle = value_noise(W, H, 120, octaves=2, seed=12)     # patchy ground cover
contour = value_noise(W, H, 260, octaves=2, seed=13)
side_light = (1.10 - 0.22 * (xs / W))[None, :]         # sun from the left

far_crest = np.min(np.stack([mound(cx, w, h, LAYERS[0]['base'], 0.3) for cx, w, h in LAYERS[0]['mounds']]), axis=0)
above = far_crest[None, :] - ys
glow = np.where(above > 0, np.exp(-np.clip(above, 0, None) / 150.0), 0.0).astype(np.float32) * 0.30
cv.over(np.broadcast_to(HAZE_LIGHT, (H, W, 3)), glow)

rng = np.random.default_rng(7)
for li, L in enumerate(LAYERS):
    dark = np.array(L['dark'], dtype=np.float32) / 255.0
    lit = np.array(L['lit'], dtype=np.float32) / 255.0
    order = sorted(range(len(L['mounds'])), key=lambda i: -L['mounds'][i][2])
    for mi in order:
        cx, width, height = L['mounds'][mi]
        skew = 0.45 if (mi % 2 == 0) else -0.35
        smooth = mound(cx, width, height, L['base'], skew)
        # visible undulation along the ridge (two octaves) + fine fringe for the mask
        undul = (value_noise(W, 1, 320, octaves=3, seed=200 + li * 10 + mi)[0] - 0.5) * 36 * (1 - 0.5 * L['haze'])               + (value_noise(W, 1, 60, octaves=2, seed=300 + li * 10 + mi)[0] - 0.5) * 10
        crest = smooth + undul
        # lighting from the smooth profile (no per-column banding) plus a gentle hint from the ridge undulation
        slope = np.gradient(smooth) + 0.35 * np.gradient(blur(undul[None, :], 40)[0])
        light1d = np.clip(0.55 - slope * 1.9, 0.06, 1.0)
        fringe = crest + (value_noise(W, 1, 7, octaves=2, seed=100 + li * 10 + mi)[0] - 0.5) * (2.0 + 2.0 * (1 - L['haze']))
        depth = ys - fringe[None, :]
        mask = np.clip(depth + 0.5, 0, 1)
        if L['soft'] > 1:
            mask = blur(mask, L['soft'] // 2)
        # crest occlusion on whatever sits behind this mound
        ao_above = np.clip(crest[None, :] - ys, 0, None)
        ao = np.where(ys < crest[None, :], np.exp(-ao_above / 26.0), 0.0).astype(np.float32) * 0.38
        cv.over(np.zeros((H, W, 3), dtype=np.float32) + np.array([0.04, 0.06, 0.03], dtype=np.float32), ao)
        d = np.clip(ys - crest[None, :], 0, None)
        rim = np.exp(-d / (34.0 + 26.0 * (1 - L['haze'])))
        falloff = np.exp(-d / (380.0 * (0.6 + height / 300.0)))
        dome = np.exp(-0.5 * ((xs - (cx - 0.28 * width)) / (0.9 * width)) ** 2)[None, :]
        shade = light1d[None, :] * (0.42 + 0.58 * falloff) * (0.72 + 0.28 * dome) * (0.86 + 0.28 * contour) * side_light
        shade = shade + rim * light1d[None, :] * 0.5
        rgb = lerp(dark[None, None, :], lit[None, None, :], np.clip(shade, 0, 1)[..., None])
        rgb = rgb + (rim * light1d[None, :] * 0.16)[..., None] * SUN[None, None, :]
        tex = 1 + (streaks - 0.5) * L['tex'] * 2.0 + (mottle - 0.5) * L['tex'] * 2.8
        rgb = rgb * tex[..., None]
        rgb = lerp(rgb, HAZE[None, None, :], (L['haze'] * (0.72 + 0.28 * (1 - falloff)))[..., None])
        cv.over(np.clip(rgb, 0, 1), mask)
        # hedgerow scrub along the near crests
        if L['scrub']:
            layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            d2 = ImageDraw.Draw(layer)
            # hedgerow clusters: a few dense runs of small bushes rather than an even sprinkle
            runs = [(rng.uniform(max(0, cx - 2.0 * width), min(W - 1, cx + 2.0 * width)), rng.uniform(120, 420)) for _ in range(4)]
            for _ in range(L['scrub']):
                rc, rl = runs[rng.integers(0, len(runs))]
                x = float(np.clip(rng.normal(rc, rl / 2.5), 0, W - 1))
                r = rng.uniform(5, 13)
                yc = crest[int(x)] - 0.45 * r + rng.uniform(-2, 6)
                a = int(rng.uniform(0.25, 0.55) * 255)
                d2.ellipse([x - r * rng.uniform(1.0, 1.6), yc - r, x + r * rng.uniform(1.0, 1.6), yc + r], fill=SCRUB + (a,))
            layer = layer.filter(ImageFilter.GaussianBlur(1.6))
            cv.over_image(layer)
    print(f'hills layer {li} done {time.time() - t0:.1f}s')

BASE = np.array([15, 20, 12], dtype=np.float32) / 255.0
bottom = np.clip((ys - (H - 140)) / 140.0, 0, 1) * np.ones((1, W), dtype=np.float32)
cv.pm = lerp(cv.pm, BASE[None, None, :] * cv.a[..., None], bottom[..., None])
save(cv.image(), 'public/img/hills.webp', 88, 'shots/preview-hills.png')

# ----------------------------------------------------------------------------- FOLIAGE
FW, FH = 2880, 1000
canopy = 130 + (value_noise(FW, 1, 420, octaves=3, seed=77)[0] - 0.5) * 160

BANDS = [  # back -> front: silhouettes, rim light only on the crown tops
    dict(count=140, r=(20, 50), dy=(-16, 40), blur=0.0, n=1.0, size=(1.6, 3.4), haze=0.06,
         shadow=(9, 9, 8), mid=(26, 24, 18), hi=(118, 88, 70)),
    dict(count=120, r=(30, 70), dy=(10, 90), blur=0.0, n=1.2, size=(1.4, 3.2), haze=0.0,
         shadow=(7, 7, 6), mid=(19, 18, 13), hi=(64, 48, 38)),
    dict(count=110, r=(40, 90), dy=(70, 180), blur=0.6, n=1.5, size=(1.2, 2.8), haze=0.0,
         shadow=(5, 5, 4), mid=(14, 13, 10), hi=(34, 27, 22)),
    dict(count=90, r=(55, 105), dy=(170, 320), blur=0.6, n=1.7, size=(1.2, 2.8), haze=0.0,
         shadow=(4, 4, 3), mid=(11, 10, 8), hi=(24, 19, 16)),
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
        tall = r.random() < 0.30
        rx, ry = (rad * r.uniform(0.45, 0.6), rad * r.uniform(2.2, 3.0)) if tall else (rad * r.uniform(1.0, 1.4), rad)
        cy = canopy[int(np.clip(cx, 0, FW - 1))] + ry * 0.55 + r.uniform(*B['dy'])
        tint = np.array([min(r.normal(-2, 4), 4.0), max(r.normal(7, 4), -1.0), r.normal(-7, 3)], dtype=np.float32)
        # crown = several overlapping sub-clusters so the outline is lumpy, not a dome
        subs = r.integers(6, 13)
        ang_mod = value_noise(64, 1, 8, octaves=2, seed=int(r.integers(0, 1 << 30)))[0]
        n_total = int(2600 * (rad / 100.0) ** 2 * B['n']) + 160
        px_all, py_all = [], []
        for si in range(subs):
            oa = r.uniform(0, 2 * math.pi)
            od = r.uniform(0.3, 0.6)
            scx, scy = cx + math.cos(oa) * od * rx, cy + math.sin(oa) * od * ry * 0.8
            srx, sry = rx * r.uniform(0.35, 0.6), ry * r.uniform(0.35, 0.6)
            n = n_total // subs
            ang = r.uniform(0, 2 * math.pi, n)
            rr = np.sqrt(r.uniform(0, 1, n))
            modv = 1 + 0.35 * (ang_mod[((ang / (2 * math.pi)) * 63).astype(int)] - 0.5)
            px_all.append(scx + np.cos(ang) * rr * srx * modv)
            py_all.append(scy + np.sin(ang) * rr * sry * modv)
        px = np.concatenate(px_all); py = np.concatenate(py_all)
        n = len(px)
        up = np.clip((cy - py) / ry, -1, 1)
        left = np.clip((cx - px) / rx, -1, 1)
        t = np.clip(0.5 + 0.4 * up + 0.16 * left + r.normal(0, 0.15, n), 0, 1) * np.clip((up - 0.35) / 0.45, 0, 1)
        sizes = r.uniform(B['size'][0], B['size'][1], n)
        for i in np.argsort(t):
            tt = t[i]
            col = sh + (md - sh) * (tt / 0.5) if tt < 0.5 else md + (hi - md) * ((tt - 0.5) / 0.5)
            col = np.clip(col + tint + r.normal(0, 3, 3), 0, 255)
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
ground_a = np.clip((fy - 240) / 80.0, 0, 1) * np.ones((1, FW), dtype=np.float32)
fc.over(np.broadcast_to(GROUND, (FH, FW, 3)), ground_a)
fc.over(arr[..., :3], arr[..., 3])
dark = np.clip((fy - 360) / 520.0, 0, 1) * np.ones((1, FW), dtype=np.float32)
fc.pm = lerp(fc.pm, GROUND[None, None, :] * fc.a[..., None], (dark * 0.9)[..., None])
save(fc.image(), 'public/img/foliage.webp', 86, 'shots/preview-foliage.png')

# quick QA numbers for the crest band the reviewer measured
img = np.asarray(fc.image()).astype(np.float32)
crest = img[0:200]
op = crest[..., 3] > 250
lum = (0.2126 * crest[..., 0] + 0.7152 * crest[..., 1] + 0.0722 * crest[..., 2])[op]
print(f'foliage rows 0-200 opaque px: mean lum {lum.mean():.0f}  p95 {np.percentile(lum, 95):.0f}')

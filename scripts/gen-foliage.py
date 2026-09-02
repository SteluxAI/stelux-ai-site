# Generates public/assets/foliage.svg: a dense dusk-lit treetop silhouette for the hero foreground layer.
import random
random.seed(11)
W, H = 1440, 420
layers = [
    # y_min, y_max, r_min, r_max, count, gradient id, filter id, displacement
    (150, 212, 34, 68, 72, 'lf-back', 'leafy-a', 22),
    (185, 250, 38, 78, 70, 'lf-mid', 'leafy-b', 26),
    (228, 300, 44, 92, 60, 'lf-front', 'leafy-c', 30),
]
out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">')
out.append('''<defs>
  <linearGradient id="lf-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a2f"/><stop offset="0.35" stop-color="#2f261e"/><stop offset="1" stop-color="#1b1712"/></linearGradient>
  <linearGradient id="lf-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2219"/><stop offset="0.4" stop-color="#1c1712"/><stop offset="1" stop-color="#110f0c"/></linearGradient>
  <linearGradient id="lf-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17140f"/><stop offset="0.5" stop-color="#0f0d0a"/><stop offset="1" stop-color="#0a0908"/></linearGradient>
  <linearGradient id="lf-tree" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d3126"/><stop offset="1" stop-color="#1a1610"/></linearGradient>
  <filter id="leafy-a" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="3" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="leafy-b" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves="3" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="leafy-c" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="13" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.16"/></feComponentTransfer></filter>
</defs>''')
# taller rounded trees in the back row
out.append('<g filter="url(#leafy-a)" fill="url(#lf-tree)">')
for i in range(14):
    cx = random.uniform(-20, W + 20)
    cy = random.uniform(150, 205)
    rx = random.uniform(22, 40)
    ry = random.uniform(52, 92)
    out.append(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.0f}" ry="{ry:.0f}"/>')
out.append('</g>')
for (ymin, ymax, rmin, rmax, count, grad, filt, _) in layers:
    out.append(f'<g filter="url(#{filt})" fill="url(#{grad})">')
    for i in range(count):
        cx = random.uniform(-40, W + 40)
        cy = random.uniform(ymin, ymax)
        r = random.uniform(rmin, rmax)
        out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}"/>')
    out.append('</g>')
out.append(f'<rect x="0" y="300" width="{W}" height="{H-300}" fill="#0a0908"/>')
out.append(f'<rect x="0" y="0" width="{W}" height="{H}" filter="url(#grain)" style="mix-blend-mode:overlay" opacity="0.5"/>')
out.append('</svg>')
open('assets-src/foliage.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('wrote assets-src/foliage.svg', sum(l[4] for l in layers) + 14, 'shapes')

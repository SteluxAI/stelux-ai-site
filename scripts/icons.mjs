// Builds the Stelux AI mark (hexagon, network and rising arrow) in three forms:
//   public/logo-mark.svg      the mark alone; the arrow, network and nodes are cut out (transparent),
//                             so it sits on any background. The page tints it through CSS (.brand-mark).
//   public/favicon.svg        the mark on a rounded tile
//   public/apple-touch-icon.png  180×180 full-bleed tile (iOS rounds the corners itself)
// Colours are arguments, so the icon can follow a new background:
//   node scripts/icons.mjs [markColor] [tileColor]      default: #b4c6ea #0f2d5e
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const MARK = process.argv[2] || '#b4c6ea'
const TILE = process.argv[3] || '#0f2d5e'
const out = (f) => new URL(`../public/${f}`, import.meta.url)

// Geometry traced from the logo artwork (1600 px canvas). The viewBox frames the mark.
const VIEW = '220 205 1160 1160'
const shape = 'M800 235 1120 415 1298 358 1276 525 1284 1080 800 1366 316 1080 316 525Z' // hexagon + the flag around the arrowhead
const band = 'M250 1277 657 792 825 922 1100 605' // the zigzag arrow's centre line
const head = 'M975 512 1258 404 1214 702Z'
const lines = [
  'M800 280 680 510 890 615 800 280', 'M680 510 365 540 470 765 680 510', 'M470 765 382 995', 'M470 765 555 780', 'M470 765 515 835',
  'M890 615 1000 582', 'M890 615 745 750', 'M890 615 825 800',
  'M1105 825 965 1055 1240 1060 1105 825', 'M1105 825 1045 780', 'M1105 825 1145 690',
  'M965 1055 685 1070 800 1320 965 1055', 'M685 1070 665 905', 'M685 1070 750 970', 'M685 1070 480 1135',
]
const nodes = [[800, 280, 19], [680, 510, 42], [890, 615, 42], [365, 540, 19], [470, 765, 42], [1105, 825, 42], [1240, 1060, 19], [965, 1055, 42], [685, 1070, 42], [800, 1320, 19]]

const cutouts = `<path d="${band}" fill="none" stroke="#000" stroke-width="112" stroke-miterlimit="8"/>
    <path d="${head}" fill="#000" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
    <g fill="none" stroke="#000" stroke-width="11" stroke-linecap="round">${lines.map((d) => `<path d="${d}"/>`).join('')}</g>
    <g fill="#000">${nodes.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
const markBody = (id, color) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1600">
    <path d="${shape}" fill="#fff" stroke="#fff" stroke-width="36" stroke-linejoin="round"/>
    ${cutouts}
  </mask>
  <rect x="0" y="0" width="1600" height="1600" fill="${color}" mask="url(#${id})"/>`

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW}">
  ${markBody('m', MARK)}
</svg>
`
// tile: the mark at ~78% of the tile, centred
const tile = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${TILE}"/>
  <svg x="7" y="7" width="50" height="50" viewBox="${VIEW}">
    ${markBody('m', MARK)}
  </svg>
</svg>
`
fs.writeFileSync(out('logo-mark.svg'), markSvg)
fs.writeFileSync(out('favicon.svg'), tile(14))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 180, height: 180 } })
await page.setContent(`<body style="margin:0">${tile(0).replace('<svg ', '<svg width="180" height="180" ')}</body>`)
await page.screenshot({ path: fileURLToPath(out('apple-touch-icon.png')) })
await browser.close()
console.log(`icons: mark ${MARK} on tile ${TILE}`)

// Point stelux.ai at GitHub Pages via the Cloudflare API, then enable HTTPS enforcement on the Pages site.
//
//   CLOUDFLARE_API_TOKEN=... node scripts/dns-switch.mjs            # apply
//   CLOUDFLARE_API_TOKEN=... node scripts/dns-switch.mjs --dry-run  # show the plan only
//   node scripts/dns-switch.mjs --rollback dns-backup-<timestamp>.json
//
// Token needs: Zone → DNS → Edit (and Zone → Zone → Read) on the stelux.ai zone.
// Only the apex (@) A/AAAA records and the www record are touched; every other record is left alone.
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const ZONE = process.env.ZONE_NAME || 'stelux.ai'
const REPO = process.env.PAGES_REPO || 'SteluxAI/stelux-ai-site'
const GH_HOST = process.env.PAGES_HOST || 'steluxai.github.io'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const dry = process.argv.includes('--dry-run')
const rollbackFile = process.argv.includes('--rollback') ? process.argv[process.argv.indexOf('--rollback') + 1] : null

const GITHUB_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153']
const GITHUB_AAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153']

if (!TOKEN) { console.error('Set CLOUDFLARE_API_TOKEN (Zone DNS Edit on ' + ZONE + ').'); process.exit(1) }
const api = async (path, init = {}) => {
  const r = await fetch('https://api.cloudflare.com/client/v4' + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const j = await r.json()
  if (!j.success) throw new Error(`${init.method || 'GET'} ${path}: ${JSON.stringify(j.errors)}`)
  return j.result
}

const zones = await api(`/zones?name=${ZONE}`)
if (!zones.length) throw new Error(`zone ${ZONE} not visible to this token`)
const zoneId = zones[0].id
const records = await api(`/zones/${zoneId}/dns_records?per_page=500`)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

if (rollbackFile) {
  const backup = JSON.parse(fs.readFileSync(rollbackFile, 'utf8'))
  console.log(`Rolling back ${backup.touched.length} record(s) from ${rollbackFile}`)
  // Rollback touches only the two names' A/AAAA/CNAME records (the same set the forward path replaces); MX/TXT etc. are never matched.
  const names = new Set(backup.touched.map((t) => t.name))
  for (const rec of records.filter((r) => names.has(r.name) && ['A', 'AAAA', 'CNAME'].includes(r.type))) {
    if (!dry) await api(`/zones/${zoneId}/dns_records/${rec.id}`, { method: 'DELETE' })
    console.log('  deleted', rec.type, rec.name, rec.content)
  }
  for (const t of backup.touched) {
    if (!dry) await api(`/zones/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify({ type: t.type, name: t.name, content: t.content, ttl: t.ttl, proxied: t.proxied }) })
    console.log('  restored', t.type, t.name, t.content, t.proxied ? '(proxied)' : '(dns only)')
  }
  process.exit(0)
}

const apex = records.filter((r) => r.name === ZONE && ['A', 'AAAA', 'CNAME'].includes(r.type))
const www = records.filter((r) => r.name === `www.${ZONE}` && ['A', 'AAAA', 'CNAME'].includes(r.type))
const touched = [...apex, ...www].map(({ type, name, content, ttl, proxied }) => ({ type, name, content, ttl, proxied }))
const backupPath = `dns-backup-${stamp}.json`
fs.writeFileSync(backupPath, JSON.stringify({ zone: ZONE, zoneId, at: stamp, touched, all: records.map(({ type, name, content, proxied }) => ({ type, name, content, proxied })) }, null, 2))
console.log(`Zone ${ZONE} (${zoneId}) — ${records.length} records. Backup of the ${touched.length} record(s) to be replaced: ${backupPath}`)
for (const t of touched) console.log('  current', t.type.padEnd(5), t.name.padEnd(18), t.content, t.proxied ? '(proxied)' : '(dns only)')

const plan = [
  ...GITHUB_A.map((ip) => ({ type: 'A', name: ZONE, content: ip })),
  ...GITHUB_AAAA.map((ip) => ({ type: 'AAAA', name: ZONE, content: ip })),
  { type: 'CNAME', name: `www.${ZONE}`, content: GH_HOST },
]
console.log('\nPlan (all DNS-only, TTL auto):')
for (const p of plan) console.log('  create ', p.type.padEnd(5), p.name.padEnd(18), p.content)
if (dry) { console.log('\n--dry-run: nothing changed.'); process.exit(0) }

for (const rec of [...apex, ...www]) { await api(`/zones/${zoneId}/dns_records/${rec.id}`, { method: 'DELETE' }); console.log('  deleted', rec.type, rec.name, rec.content) }
for (const p of plan) { await api(`/zones/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify({ ...p, ttl: 1, proxied: false }) }); console.log('  created', p.type, p.name, p.content) }

// GitHub Pages: re-assert the custom domain, then wait for the certificate and enforce HTTPS.
const gh = (args) => execSync(`gh api ${args}`, { encoding: 'utf8' })
try { gh(`-X PUT repos/${REPO}/pages -f cname=${ZONE}`) } catch {}
console.log('\nWaiting for GitHub to issue the certificate (usually a few minutes)…')
for (let i = 0; i < 40; i++) {
  const st = JSON.parse(gh(`repos/${REPO}/pages`))
  const cert = st.https_certificate || {}
  console.log(`  ${new Date().toISOString().slice(11, 19)} cert=${cert.state || 'unknown'} https_enforced=${st.https_enforced}`)
  if (cert.state === 'approved' || cert.state === 'issued') {
    try { gh(`-X PUT repos/${REPO}/pages -F https_enforced=true`); console.log('HTTPS enforcement enabled.') } catch (e) { console.log('Could not enable HTTPS enforcement yet:', e.message.split('\n')[0]) }
    break
  }
  await new Promise((r) => setTimeout(r, 30000))
}
console.log('\nDone. Verify with: curl -sI https://' + ZONE + '/ | head -5')

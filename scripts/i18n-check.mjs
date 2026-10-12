// Checks public/i18n/<code>.json against the English source in i18n/en.json:
// every key present, no extra keys, same {placeholders} and the same number of line breaks.
// Refresh i18n/en.json from the running dev server with: window.__steluxI18nSource()
import fs from 'node:fs'
const en = JSON.parse(fs.readFileSync(new URL('../i18n/en.json', import.meta.url)))
const dir = new URL('../public/i18n/', import.meta.url)
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
const br = (s) => String(s).split('\n').length
let problems = 0
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
for (const f of files) {
  const tr = JSON.parse(fs.readFileSync(new URL(f, dir)))
  const out = []
  for (const k of Object.keys(en)) {
    if (!(k in tr)) out.push(`missing ${k}`)
    else if (typeof tr[k] !== 'string' || !tr[k].trim()) out.push(`empty ${k}`)
    else {
      if (ph(tr[k]) !== ph(en[k])) out.push(`placeholders ${k}`)
      if (br(tr[k]) !== br(en[k])) out.push(`line breaks ${k}`)
    }
  }
  for (const k of Object.keys(tr)) if (!(k in en)) out.push(`extra ${k}`)
  if (out.length) { problems += out.length; console.log(`${f}: ${out.join('; ')}`) }
}
console.log(`${files.length} languages, ${Object.keys(en).length} keys, ${problems} problems`)
process.exit(problems ? 1 : 0)

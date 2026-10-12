import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { ARENA_COPY, ARENA_URL, applyArenaSeo } from './arena-seo.mjs'

const source = fs.readFileSync(new URL('../public/arena/index.html', import.meta.url), 'utf8')
const output = applyArenaSeo(source)
const scripts = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(match => !/arena-seo-/.test(match[1])).map(match => match[0])
const headMetadata = html => html.slice(0, html.indexOf('</head>')).replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')

test('the dashboard has indexable, canonical metadata and a fetchable favicon', () => {
  assert.doesNotMatch(headMetadata(output), /noindex|nofollow|data:image/)
  assert.match(output, /<meta name="robots" content="index,follow,max-image-preview:large">/)
  assert.equal([...output.matchAll(/<link rel="canonical"/g)].length, 1)
  assert.ok(output.includes(`<link rel="canonical" href="${ARENA_URL}">`))
  assert.match(output, /<link rel="icon" type="image\/png" sizes="180x180" href="https:\/\/stelux.ai\/arena\/apple-touch-icon.png">/)
  const icon = fs.readFileSync(new URL('../public/arena/apple-touch-icon.png', import.meta.url))
  assert.equal(icon.readUInt32BE(16), 180)
  assert.equal(icon.readUInt32BE(20), 180)
  assert.ok(output.includes(ARENA_COPY['zh-CN'][1]))
  assert.ok(output.includes(ARENA_COPY['zh-CN'][2]))
})

test('applying the site layer twice is byte-for-byte idempotent', () => {
  assert.equal(applyArenaSeo(output), output)
})

test('new publisher output cannot bring noindex or data-URL favicons back', () => {
  const republished = source.replace(/<!-- STELUX_ARENA_SEO_(HEAD|INTRO|RUNTIME)_START -->[\s\S]*?<!-- STELUX_ARENA_SEO_\1_END -->\r?\n?/g, '')
    .replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">\n<link rel="icon" href="data:image/png;base64,AAAA">')
    .replace(/<title>.*?<\/title>/, '<title>Arena · 实时竞技场</title>')
  const result = applyArenaSeo(republished)
  assert.doesNotMatch(headMetadata(result), /noindex|nofollow|data:image/)
  assert.match(result, /<section class="arena-intro"/)
  assert.equal(scripts(result).join('\n'), scripts(source).join('\n'))
})

test('all dashboard scripts, published data configuration and controls remain intact', () => {
  assert.deepEqual(scripts(output), scripts(source))
  const withoutLayer = html => html.replace(/<!-- STELUX_ARENA_SEO_(HEAD|INTRO|RUNTIME)_START -->[\s\S]*?<!-- STELUX_ARENA_SEO_\1_END -->/g, '')
  const ids = html => [...withoutLayer(html).matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(ids(output), ids(source))
  assert.ok(output.includes('PAPER ONLY'))
  assert.ok(output.includes('simulated'))
})

test('metadata and visible introduction use all 17 existing languages after the dashboard title update', () => {
  const languages = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'pt-BR', 'fr', 'de', 'it', 'ru', 'tr', 'id', 'vi', 'th', 'hi', 'ar']
  assert.deepEqual(Object.keys(ARENA_COPY), languages)
  const runtime = output.match(/<script id="arena-seo-runtime">([\s\S]*?)<\/script>/)[1]
  assert.ok(output.indexOf('<script id="arena-seo-runtime">') > output.lastIndexOf('document.title = "Arena · "'))
  const schemaSource = output.match(/<script type="application\/ld\+json" id="arena-seo-schema">([\s\S]*?)<\/script>/)[1]
  for (const lang of languages) {
    const copy = ARENA_COPY[lang]
    assert.equal(copy.length, 4)
    assert.ok(copy.every(value => typeof value === 'string' && value.trim()))
    const elements = Object.fromEntries(['heading', 'description', 'link'].map(id => [`arena-intro-${id}`, { textContent: '' }]))
    elements['arena-seo-schema'] = { textContent: schemaSource }
    const metas = {}
    const document = {
      title: 'Arena · previous dashboard title', documentElement: { lang },
      getElementById: id => elements[id],
      querySelector: selector => ({ setAttribute: (key, value) => { metas[selector] = { [key]: value } } }),
    }
    vm.runInNewContext(runtime, { document })
    assert.equal(document.title, `Arena — ${copy[0]} | Stelux AI`)
    assert.equal(elements['arena-intro-heading'].textContent, copy[1])
    assert.equal(elements['arena-intro-description'].textContent, copy[2])
    assert.equal(elements['arena-intro-link'].textContent, copy[3])
    assert.equal(metas['meta[name="description"]'].content, copy[2])
    assert.equal(metas['meta[property="og:title"]'].content, document.title)
    const schema = JSON.parse(elements['arena-seo-schema'].textContent)
    assert.deepEqual(schema['@graph'].map(entity => entity['@type']), ['WebPage', 'Thing'])
    assert.equal(schema['@graph'][0].inLanguage, lang)
    assert.equal(schema['@graph'][0].description, copy[2])
    assert.equal(schema['@graph'][1].description, copy[2])
    assert.equal(schema['@graph'][0].url, ARENA_URL)
    assert.equal(schema['@graph'][0].publisher.name, 'Stelux AI')
    assert.equal(schema['@graph'][0].about['@id'], schema['@graph'][1]['@id'])
    assert.equal(schema['@graph'][1].name, 'Stelux Arena')
    assert.equal(schema['@graph'][1].url, ARENA_URL)
    assert.ok(!JSON.stringify(schema).includes('aggregateRating'))
    assert.ok(!JSON.stringify(schema).includes('offers'))
    assert.doesNotMatch(JSON.stringify(schema), /SoftwareApplication|WebApplication|MobileApplication|ratingValue|reviewCount/)
  }
})

test('unknown publisher formats fail before publishing instead of silently skipping SEO', () => {
  assert.throws(() => applyArenaSeo('<html><head></head><body></body></html>'), /Unrecognized Arena publisher output/)
})

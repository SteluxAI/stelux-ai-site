import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { pathToFileURL } from 'node:url'
import { ARENA_COPY } from './arena-seo.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright')
const base = process.env.SEO_BASE_URL || 'http://127.0.0.1:4176'
const outputDir = path.resolve(process.env.SEO_OUTPUT_DIR || 'output/seo-browser')
await fs.mkdir(outputDir, { recursive: true })
const languageCodes = Object.keys(ARENA_COPY)
const widths = (process.env.SEO_WIDTHS || '390,1280').split(',').map(Number)
const mainI18n = await fs.readFile('src/i18n.js', 'utf8')
const en = Object.fromEntries(['metaTitle', 'metaDesc'].map(key => [key, vm.runInNewContext(`(${mainI18n.match(new RegExp(`${key}: ('(?:\\\\.|[^'])*')`))[1]})`)]))
const translations = { en }
for (const code of languageCodes.filter(code => code !== 'en')) translations[code] = JSON.parse(await fs.readFile(`public/i18n/${code}.json`, 'utf8'))
const gameContext = { window: {} }
vm.runInNewContext(await fs.readFile('public/cheek-beat/assets/seo-i18n.js', 'utf8'), gameContext)
const game = gameContext.window.CB_SEO
const definitions = [
  { id: 'home', path: '/', button: '.lang-nav .lang-btn', menu: '.lang-nav .lang-menu', title: lang => translations[lang].metaTitle, description: lang => translations[lang].metaDesc, newText: [] },
  { id: 'cheek', path: '/cheek-beat/', button: '#lang', menu: '#lang-menu', title: lang => game[lang].title, description: lang => game[lang].description, newText: ['#hero-title'] },
  { id: 'arena', path: '/arena/', button: '#langbtn', menu: '#langmenu', title: lang => `Arena — ${ARENA_COPY[lang][0]} | Stelux AI`, description: lang => ARENA_COPY[lang][2], newText: ['#arena-intro-heading', '#arena-intro-description', '#arena-intro-link'] },
]
const browser = await chromium.launch({ channel: process.env.SEO_BROWSER_CHANNEL || 'msedge', headless: true })
const results = []
const errors = []

async function metadata(page, definition, lang) {
  await page.waitForFunction(({ lang, title }) => document.documentElement.lang === lang && document.title === title, { lang, title: definition.title(lang) }, { timeout: 15000 })
  const actual = await page.evaluate(() => {
    const content = selector => document.querySelector(selector)?.getAttribute('content')
    return {
      title: document.title, description: content('meta[name="description"]'), ogTitle: content('meta[property="og:title"]'), twitterTitle: content('meta[name="twitter:title"]'),
      ogDescription: content('meta[property="og:description"]'), twitterDescription: content('meta[name="twitter:description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href, robots: content('meta[name="robots"]'), dir: document.documentElement.dir,
      schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(element => { const data = JSON.parse(element.textContent); return data['@graph'] || [data] }),
    }
  })
  assert.equal(actual.title, definition.title(lang))
  assert.equal(actual.description, definition.description(lang))
  assert.equal(actual.ogTitle, actual.title)
  assert.equal(actual.twitterTitle, actual.title)
  assert.equal(actual.ogDescription, actual.description)
  assert.equal(actual.twitterDescription, actual.description)
  assert.equal(actual.canonical, `https://stelux.ai${definition.path}`)
  assert.equal(actual.dir, lang === 'ar' ? 'rtl' : 'ltr')
  assert.ok(!/noindex/.test(actual.robots || ''))
  assert.ok(!actual.schemas.some(schema => ['WebApplication', 'SoftwareApplication'].includes(schema['@type'])), 'No incomplete software rich-result markup')
  if (definition.id === 'arena' || definition.id === 'cheek') {
    const webpage = actual.schemas.find(schema => schema['@type'] === 'WebPage' && schema.url === actual.canonical)
    assert.ok(webpage, 'The product landing page has WebPage markup')
    assert.equal(webpage.name, actual.title)
    assert.equal(webpage.description, actual.description)
    assert.equal(webpage.inLanguage, lang)
  }
  return actual
}

async function layout(page, definition) {
  await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 4000))]) })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const measurement = await page.evaluate(selectors => {
    const viewport = document.documentElement.clientWidth
    return {
      viewport,
      pageWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      newText: selectors.map(selector => {
        const element = document.querySelector(selector)
        const box = element.getBoundingClientRect()
        return { selector, left: box.left, right: box.right, width: box.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
      }),
    }
  }, definition.newText)
  assert.ok(measurement.pageWidth <= measurement.viewport + 1, `Page overflow: ${JSON.stringify(measurement)}`)
  for (const text of measurement.newText) {
    assert.ok(text.left >= -1 && text.right <= measurement.viewport + 1, `New SEO text outside viewport: ${JSON.stringify(text)}`)
    assert.ok(text.scrollWidth <= text.clientWidth + 1, `New SEO text clipped: ${JSON.stringify(text)}`)
  }
  return measurement
}

async function checkExistingFeatures(page, definition) {
  if (definition.id === 'cheek') {
    const links = await page.locator('a[href="https://play.google.com/store/apps/details?id=ai.stelux.bumphony"]').count()
    assert.equal(links, 3, 'All existing Android download links remain present')
    const ios = page.locator('.btn-ios')
    assert.equal(await ios.count(), 2)
    for (const button of await ios.all()) {
      assert.ok((await button.textContent()).includes('Update in review'))
      assert.equal(await button.getAttribute('href'), null)
    }
    assert.equal(await page.locator('video').count(), 4)
  }
  if (definition.id === 'arena') {
    await page.waitForFunction(() => document.querySelector('#expsel').options.length >= 2, null, { timeout: 25000 })
    await page.waitForFunction(() => document.querySelector('#sysEq').textContent.trim() !== '—', null, { timeout: 25000 })
    const initial = await page.locator('#expsel').inputValue()
    const options = await page.locator('#expsel option').evaluateAll(elements => elements.map(element => element.value))
    const other = options.find(value => value !== initial)
    await page.locator('#expsel').selectOption(other)
    await page.waitForFunction(value => document.querySelector('#expsel').value === value && new URL(location.href).searchParams.get('experiment') === value, other)
    await page.waitForFunction(() => document.querySelector('#sysEq').textContent.trim() !== '—', null, { timeout: 25000 })
    await page.locator('#cmpwhy').click()
    assert.equal(await page.locator('#cmpwhy').getAttribute('aria-expanded'), 'true')
    assert.ok(await page.locator('#cmpnotefull').isVisible())
    await page.locator('#cmpwhy').click()
    const focus = await page.locator('#cmpfocus').getAttribute('aria-pressed')
    await page.locator('#cmpfocus').click()
    assert.notEqual(await page.locator('#cmpfocus').getAttribute('aria-pressed'), focus)
    await page.locator('#cmpfocus').click()
    // Reset is intentionally disabled at the whole-range view. Zoom first,
    // then verify that reset returns to that state.
    assert.equal(await page.locator('#cmpzreset').isEnabled(), false)
    await page.locator('#cmpzin').click()
    await page.waitForFunction(() => !document.querySelector('#cmpzreset').disabled)
    await page.locator('#cmpzreset').click()
    assert.equal(await page.locator('#cmpzreset').isEnabled(), false)
    const mode = await page.locator('#themebtn').getAttribute('data-mode')
    await page.locator('#themebtn').click()
    assert.notEqual(await page.locator('#themebtn').getAttribute('data-mode'), mode)
    await page.locator('#expsel').selectOption(initial)
    await page.evaluate(() => scrollTo(0, 0))
    assert.equal(await page.locator('#renderfail').isVisible(), false)
  }
}

try {
  for (const width of widths) {
    for (const definition of definitions) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US', reducedMotion: 'reduce' })
      const page = await context.newPage()
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      await page.goto(`${base}${definition.path}?lang=en`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      for (const lang of languageCodes) {
        const name = `${definition.id}-${width}-${lang}`
        try {
          await page.evaluate(() => scrollTo(0, 0))
          if (await page.locator(definition.button).getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape')
          await page.locator(definition.button).click()
          await page.locator(`${definition.menu} button[data-code="${lang}"]`).click()
          const actual = await metadata(page, definition, lang)
          const measurements = await layout(page, definition)
          if (lang === 'en') await checkExistingFeatures(page, definition)
          assert.deepEqual(pageErrors, [], 'No uncaught page errors')
          if (['en', 'zh-CN', 'ar'].includes(lang)) {
            await page.evaluate(() => scrollTo(0, 0))
            await page.screenshot({ path: path.join(outputDir, `${name}.png`) })
          }
          results.push({ name, passed: true, title: actual.title, viewport: measurements.viewport, pageWidth: measurements.pageWidth })
        } catch (error) {
          const failure = { name, passed: false, error: error.message, pageErrors: [...pageErrors] }
          results.push(failure)
          errors.push(failure)
          await page.screenshot({ path: path.join(outputDir, `${name}-failed.png`) }).catch(() => {})
          console.log(JSON.stringify(failure))
        }
      }
      console.log(JSON.stringify({ page: definition.id, width, checked: languageCodes.length, failed: results.filter(result => result.name.startsWith(`${definition.id}-${width}-`) && !result.passed).length }))
      await context.close()
    }
  }
} finally {
  await browser.close()
  await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify({ base, checked: results.length, passed: results.length - errors.length, failures: errors, results }, null, 2))
}
console.log(JSON.stringify({ checked: results.length, passed: results.length - errors.length, failed: errors.length, report: path.join(outputDir, 'results.json') }))
if (errors.length) process.exitCode = 1

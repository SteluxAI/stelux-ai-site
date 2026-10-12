import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(resolve('dist', path), 'utf8');
const pages = [['index.html', 'https://stelux.ai/'], ['cheek-beat/index.html', 'https://stelux.ai/cheek-beat/'], ['arena/index.html', 'https://stelux.ai/arena/']];
const meta = (html, name) => html.match(new RegExp(`<meta\\s+(?:name|property)="${name}"\\s+content="([^"]*)"`))?.[1];
const structuredData = html => [...html.matchAll(/<script type="application\/ld\+json"(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
function checkDescriptiveSchema(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '@type') {
      const types = Array.isArray(child) ? child : [child];
      assert.ok(!types.some(type => ['SoftwareApplication', 'WebApplication', 'MobileApplication', 'Offer', 'Review', 'AggregateRating'].includes(type)), 'Do not advertise an unsupported app rich result');
    }
    assert.ok(!['offers', 'aggregateRating', 'ratingValue', 'reviewCount', 'review'].includes(key), `No unevidenced ${key}`);
    checkDescriptiveSchema(child);
  }
}
test('all public product landing pages remain indexable with self canonicals and consistent search/social metadata', () => {
  const sitemap = read('sitemap.xml');
  for (const [path, url] of pages) {
    const html = read(path);
    assert.ok(html.includes(`<link rel="canonical" href="${url}"`), path);
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), path);
    assert.doesNotMatch(html.slice(0, html.indexOf('</head>')), /content="[^"]*noindex/);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title?.length > 15, path);
    assert.equal(meta(html, 'og:title'), title, path);
    assert.equal(meta(html, 'twitter:title'), title, path);
    const description = meta(html, 'description');
    const minimumLength = /<html[^>]+lang="(?:zh|ja|ko)/.test(html) ? 25 : 70;
    assert.ok(description?.length > minimumLength, `${path}: substantive localized description`);
    const schemas = structuredData(html);
    assert.ok(schemas.length > 0, `${path}: valid structured data is present`);
    checkDescriptiveSchema(schemas);
    if (path !== 'index.html') {
      const entities = schemas.flatMap(schema => schema['@graph'] || [schema]);
      const page = entities.find(entity => entity['@type'] === 'WebPage');
      assert.equal(page.url, url);
      const subject = page.about['@type'] ? page.about : entities.find(entity => entity['@id'] === page.about['@id']);
      assert.equal(subject['@type'], 'Thing');
      assert.ok(subject.name?.trim());
      assert.ok(subject.url?.startsWith('https://'));
    }
  }
  assert.match(read('robots.txt'), /Allow: \/\s/);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/stelux.ai\/sitemap.xml/);
});
test('the hostname favicon is a reachable, square PNG larger than 48 pixels', () => {
  const html = read('index.html');
  const icon = html.match(/<link rel="icon" type="image\/png" sizes="180x180" href="([^"]+)">/)?.[1];
  assert.equal(new URL(icon, 'https://stelux.ai/').href, 'https://stelux.ai/apple-touch-icon.png');
  const png = readFileSync('dist/apple-touch-icon.png');
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 180);
  assert.equal(png.readUInt32BE(20), 180);
  assert.match(html, /"logo": "https:\/\/stelux.ai\/apple-touch-icon.png"/);
  assert.match(html, /"@type": "WebSite"/);
});
test('all 17 game metadata translations exist without inventing an iPhone release or ratings', () => {
  const context = { window: {} };
  runInNewContext(read('cheek-beat/assets/seo-i18n.js'), context);
  const dictionaries = context.window.CB_SEO;
  assert.equal(Object.keys(dictionaries).length, 17);
  for (const [lang, value] of Object.entries(dictionaries)) {
    for (const key of ['title', 'description', 'heading']) assert.ok(value[key]?.trim(), `${lang}:${key}`);
    assert.match(value.title, /Cheek Beat/);
    assert.match(value.description, /Android|安卓|안드로이드/);
    assert.ok(existsSync(`dist/i18n/${lang}.json`) || lang === 'en');
  }
  const html = read('cheek-beat/index.html');
  assert.match(html, /id="hero-title" class="eyebrow">Cheek Beat — Comedy Rhythm Game/);
  assert.match(html, /ai.stelux.bumphony/);
  assert.match(html, /Update in review/);
  assert.doesNotMatch(html, /aggregateRating|ratingValue|reviewCount/);
  const schemaSource = html.match(/<script type="application\/ld\+json" id="cheek-seo-schema">([\s\S]*?)<\/script>/)[1];
  const schemaUpdate = html.match(/(var schemaElement = document.getElementById\("cheek-seo-schema"\);[\s\S]*?)\r?\n      }\r?\n      var name/)[1];
  const originalSubject = JSON.parse(schemaSource)['@graph'][0].about;
  for (const [lang, seo] of Object.entries(dictionaries)) {
    const element = { textContent: schemaSource };
    runInNewContext(schemaUpdate, { seo, lang, document: { getElementById: id => id === 'cheek-seo-schema' ? element : null } });
    const schema = JSON.parse(element.textContent);
    const page = schema['@graph'].find(entity => entity['@type'] === 'WebPage');
    assert.equal(page.name, seo.title, lang);
    assert.equal(page.description, seo.description, lang);
    assert.equal(page.inLanguage, lang);
    assert.deepEqual(page.about, originalSubject, lang);
    checkDescriptiveSchema(schema);
  }
});

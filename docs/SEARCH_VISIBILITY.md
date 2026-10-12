# Search visibility update — 2026-10-12

This release improves crawlable branding and the existing product landing pages.
It does not add invented product claims, ratings, prices, returns, or keyword-only pages.

| Page | Relevant search intent |
| --- | --- |
| Stelux AI | Commercial equipment quotes, rhythm games, paper trading research, Michigan rental property analysis |
| Cheek Beat | Free Android rhythm game, offline music game, comedy rhythm game, tap-and-hold gameplay |
| Arena | AI stock and crypto paper trading, strategy comparison, leaderboards, equity curves, simulated trade logs |

Titles, descriptions, social metadata and visible introductions are localized for
the existing 17-language selectors. Cheek Beat and Arena also synchronize their
WebPage structured data. These are existing language selectors, not 17 new
indexable language paths. Canonicals remain the real product landing URLs.

The hostname homepage now declares its existing 180×180 PNG brand icon. Cheek
Beat keeps its existing 192×192 PNG browser icon. Arena keeps its existing PNG
and becomes indexable instead of publishing `noindex,nofollow`. The root sitemap
now includes Arena. Google chooses one search favicon per hostname, so the
Cheek Beat and Arena paths use the stelux.ai hostname icon in search results.

The site build reapplies `scripts/arena-seo.mjs` to fresh Arena publisher output
without changing its application scripts, controls or data. Unknown formats fail
the build rather than silently losing the correction. GitHub Pages runs the SEO
regression suite after building and before publishing.

## Validation

- `pnpm install --frozen-lockfile` and `pnpm build`; release privacy `findings: []`.
- `pnpm run privacy:test`: 8 checks; `pnpm run seo:test`: 9 checks.
- `node scripts/i18n-check.mjs`: 16 non-English dictionaries, 263 keys, no issues.
- `node scripts/seo-browser-check.mjs`: tests real menu changes across 17
  languages at 390 and 1280 pixels on all three pages, plus the existing game
  download links, iPhone pending state, videos and Arena controls. Default preview
  URL is `http://127.0.0.1:4176`; `SEO_BASE_URL` can point to the deployed site.

This site deploys through `.github/workflows/deploy-pages.yml` on a normal push
to `main`. Do not use the legacy Cloudflare Pages deploy command. No paid service,
DNS, account or trading program setting is changed by this release.

Google must recrawl pages before changing search presentation. Submission and
successful live tests do not establish that every URL is indexed or guarantee
ranking. Sources: [favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search),
[SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

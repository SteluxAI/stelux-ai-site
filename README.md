# Stelux AI — production website

Dark, depth-driven marketing site for [stelux.ai](https://stelux.ai): a fora.so-style dusk hero (sky shader, rolling hills behind an orchestration dashboard, foliage in front) with 3-layer parallax (0.3x / 1.0x / 1.4x), the existing Stelux products, fora-style stacking feature cards, an interactive CLI/SDK showcase, live-feel telemetry, an access matrix and a minimalist footer.

**Stack:** Vite 6 · Tailwind CSS v4 · GSAP ScrollTrigger · Lenis · Playwright (visual audit) · static output in `dist/`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on http://localhost:5173 |
| `pnpm build` | Production build → `dist/` (relative asset paths, works at any base URL) |
| `pnpm preview` | Serve `dist/` on http://localhost:4173 |
| `pnpm shots` | Screenshot + audit loop: 1440px and 375px at 0/25/50/75/100% scroll. Flags horizontal overflow, clipped text and text collisions. Output in `shots/` (`SHOT_URL`, `SHOT_DIR`, `SHOT_DEPTHS` env overrides) |
| `node scripts/og.mjs` | Re-render `public/og.png` from the live hero |
| `pnpm deploy` | `wrangler pages deploy dist` to the Cloudflare Pages project `stelux-ai` (needs `npx wrangler login` or `CLOUDFLARE_API_TOKEN`) |

## Hero assets

The six hero layers live in `public/img/hero-v4/` (desktop 2172×724, mobile 1448×1086, WebP with alpha) and were generated outside this repo; their masters, manifest and the foreground alpha profile come from the `output/hero-assets-v4/` handoff (git-ignored). `src/data/hero-foreground-profiles.json` is bundled so the panel's scroll lag is capped 24px clear of the CTA. Replace a layer by dropping a new WebP with the same name and re-checking `SHOT_DIR=shots/check node scripts/screenshots.mjs`.

## Deployment

**GitHub Pages (live now).** Every push to `main` runs `.github/workflows/deploy-pages.yml`, builds, and publishes to GitHub Pages. Custom domain: `stelux.ai` (set in the repository's Pages settings).

**Cloudflare Pages (ready).** `.github/workflows/deploy-cloudflare.yml` is a manual workflow. Add the repository secrets `CLOUDFLARE_API_TOKEN` (Pages:Edit + Account:Read) and `CLOUDFLARE_ACCOUNT_ID`, then run it from the Actions tab. Or deploy locally with `npx wrangler login && pnpm deploy`.

## DNS for stelux.ai (zone is on Cloudflare)

Point the apex and `www` at GitHub Pages. Keep the records **DNS-only (grey cloud)** until GitHub has issued the certificate; the proxy can be enabled afterwards with SSL mode *Full*.

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| AAAA | `@` | `2606:50c0:8000::153` | DNS only |
| AAAA | `@` | `2606:50c0:8001::153` | DNS only |
| AAAA | `@` | `2606:50c0:8002::153` | DNS only |
| AAAA | `@` | `2606:50c0:8003::153` | DNS only |
| CNAME | `www` | `steluxai.github.io` | DNS only |

Remove any existing A/AAAA/CNAME records for `@` and `www` that point at the previous host first. Once DNS resolves, enable *Enforce HTTPS* in the repo's Pages settings (or `gh api -X PUT repos/SteluxAI/stelux-ai-site/pages -F https_enforced=true`). `www.stelux.ai` redirects to `stelux.ai` automatically.

If the site is later moved to Cloudflare Pages, replace the records above with `CNAME @ → stelux-ai.pages.dev` and `CNAME www → stelux-ai.pages.dev` (Cloudflare adds these automatically when the custom domain is attached to the Pages project).

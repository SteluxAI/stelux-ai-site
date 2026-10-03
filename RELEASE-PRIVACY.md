# Product release privacy checklist

This applies to every new product page and release on stelux.ai. A passing
pattern scan is evidence about those patterns, not a promise of anonymity.

## Before creating a public repository or product listing

- Decide the real publisher identity and which disclosures each target market
  requires. A brand can reduce optional linkage, but verified store names,
  business records, signing identities and historical pages can identify owners.
- Choose an owner-approved Git name and exact GitHub-provided no-reply or real
  brand email. Set it per repository only after review. Check both author and
  committer, plus co-author trailers. Do not invent an email or change global
  settings as a side effect of a build.
- Keep tester rosters, screenshots of consoles, signing keys, provisioning
  inputs, support exports and private build logs outside public source.
- Review repository visibility, commit history, issues, pull requests and release
  attachments before making any repository public. Removing a current file does
  not remove previous commits, caches, forks or already-downloaded artifacts.

## Before publishing each website change

1. Review the exact source diff and canonical release commit. Check optional
   marketing text, translated strings, JSON-LD, copyright/legal sections,
   contact links, image EXIF/XMP, video metadata and author credits.
2. Run `pnpm privacy:test` and `pnpm build`. The build checks every output file
   for private filenames, source maps, credential patterns and local paths.
   `pnpm deploy` also checks existing dist before deploying; direct provider
   console uploads bypass this gate and require the same check separately.
3. Set `RELEASE_APPROVED_GIT_NAME` and `RELEASE_APPROVED_GIT_EMAIL` in the local
   process to the owner-approved identity, then run
   `node scripts/check-release-attribution.mjs <base>..HEAD` for every new commit.
   A single commit argument checks that commit only. Do not publish the variables.
4. Manually inspect support/privacy pages and store links in the real browser,
   including applicable country storefronts. Record observation time and build
   number; a saved status file is not a live console check.
5. Keep required operator, trader and seller disclosures accurate and accessible.
   Privacy claims about app users are separate from the publisher's identity.
   Web hosting logs, external fonts and support email have their own data flows.
6. Obtain approval for the concrete publication diff. After publishing, verify
   the served bytes, source map absence, metadata, and working support contacts.

## Native app releases

- Scan the exact signed AAB/IPA plus store-delivered packages where available.
  Preserve hashes, source commit and package/version IDs.
- Inspect native binaries for absolute build paths and certificate identities.
  Use the game's `tools/audit-release-archive.py` on AAB/IPA/APK. Do not remove
  certificates or embedded profiles from signed packages to hide a name.
- Keep dSYMs and other debugging files private. AAB ProGuard mapping in
  `BUNDLE-METADATA` is upload metadata, not proof of public APK disclosure.
- If a credential is found, stop release, report a redacted location, and arrange
  owner-approved revocation/rotation. Never test the live credential.

## Current limitations and owner decisions

- This change removes optional homepage organization/location metadata and
  Cheek Beat marketing company strings. Following owner approval, the homepage
  copyright uses the true Stelux AI brand. Michigan product names remain accurate.
- Existing public commit attribution is still exposed. Choose and verify future
  attribution before committing these changes. History cleanup requires a
  separate reviewed plan and cannot erase copies already made.
- Business contacts must be real, controlled and accepted by the applicable
  store. No fabricated address, phone number or non-trader declaration.
- Domain registration privacy, app-store account conversion and legal-contact
  changes require separate owner review. No account settings are changed here.

## October 3 continuation

The scanner also rejects a linked output root and empty private directories.
Before deploying, re-fetch the canonical source and preserve newer independent
changes; the prepared privacy checkout is not necessarily the latest release.
The candidate reconciled with ee65ef5 preserves the five newer Arena commits.
Arena's public data feed is an independent deployment: this site's dist gate
does not protect updates to that feed. Review its publication pipeline separately.
Keep review patches, backups and audit inventories outside published output.

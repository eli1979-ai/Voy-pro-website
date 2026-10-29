# EZRaiderEU legacy — controlled release package

**Prepared 29 October 2026. No production change.** This document is a source-only coordination layer over six independently prepared draft PRs. It is **not** a WordPress backup, updated template, verified Google embed, provider integration or deployment. **No owner action requested now**; preserve all owner-required work in [#604](https://github.com/eli1979-ai/Voy-pro-website/issues/604).

## Scope and exact boundaries

| Surface | Controlled source | Current usable access | Release method |
|---|---|---|---|
| Budapest site | `https://ezraidereu.com/budapest/` | Connected Jetpack WordPress #258220563; classic PHP `ezraider` template; stored tour and article content | Edit actual live WordPress **only** after staging and release approval |
| Site-root landing | `https://ezraidereu.com/` | Public source only, no authenticated root CMS/host write path | Discover actual host/serving files; separate release |
| Lisbon landing | `https://ezraidereu.com/lisbon/` | Public source only; historical FareHarbor CTAs | Separate provider/customer obligation review and host release |
| VOY PRO website | `eli1979-ai/Voy-pro-website` | GitHub source for proposals and tests | Merging these **docs/scripts** does **not** update legacy WordPress |
| FBM | `eli1979-ai/Ezraider-os` | Independent booking backend | Not included; do not activate checkout, payment or OTA providers |

Public repository rule: **never commit full production WP/ACF exports, site backups, customer data, licensed plugin ZIPs, hosting credentials, API tokens, or unsanitized logs.**

## Verified inventory and 29 October checkpoints

All six PRs are **open, DRAFT, unmerged** and their **then-current** heads each had a successful standard GitHub website Build / Launch-readiness / Site QA check. Runs are source-build evidence **only**: they do not prove customer-browser DOM, backup restoratability or WordPress provider state. Several branches are 3–5 commits behind the then-current `main`, so fresh validations and conflict review are mandatory after any rebase or cherry-pick.

| PR | Exact verified head (short) | GitHub run | What it actually supplies | Live status |
|---|---|---|---|---|
| [#591](https://github.com/eli1979-ai/Voy-pro-website/pull/591) | `8aca918a` | [40750642954](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40750642954) | Read-only public-home HTML / 33 stored-content link audits | Not deployed or connected to live WordPress |
| [#596](https://github.com/eli1979-ai/Voy-pro-website/pull/596) | `d299c032` | [40709964285](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40709964285) | EN/HU/HE ACF homepage replacement copy, SEO suggestions; **no ACF keys** | Unpublished |
| [#598](https://github.com/eli1979-ai/Voy-pro-website/pull/598) | `cedc92d8` | [40850615023](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40850615023) | Integrated `v7` WPCode map-hold candidate preserving `v6.2` footer | **Uninstalled; must not install yet** |
| [#601](https://github.com/eli1979-ai/Voy-pro-website/pull/601) | `ad3758cd` | [40691355871](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40691355871) | Version-locked `v6.2` source checkpoint and browser-console diagnostic | **v6.2 installation owner-reported**; don't reinstall older candidates |
| [#610](https://github.com/eli1979-ai/Voy-pro-website/pull/610) | `7cf16727` | [40864724139](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40864724139) | Root/Lisbon HTML proposals and fail-closed stale booking diagnostics | **Unpublished**; different hosting scope |
| [#625](https://github.com/eli1979-ai/Voy-pro-website/pull/625) | `169e6ece` | [40850170868](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40850170868) | Security version checks; conditional CVE triage; Yoast compatibility gates | Security vulnerabilities **not patched** |

**Exact, non-guess facts:** owner supplied official Maps business link `https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac`; municipal property evidence identifies parcel 24285 (Városház utca 14 = Pilvax köz 4), **not** the exact guest entrance. Historical 26-Oct `.wpress` archive is neither fresh after later edits nor restoration-tested.

## Operational release sequence — separate rollback domains

### Phase 0 — no owner involvement, source-only (done or possible now)

Preserve these draft PRs and the exact WPCode `v6.2` rollback source. Audit each PR against current main and upstream prerequisites. Keep source-only QA scripts in `scripts/` and documents in `docs/`; avoid altering the new VOY PRO website or FBM. Use the manifest `docs/legacy-wordpress/ezraidereu-release-contract-20261029.json` and checker `scripts/check-legacy-ezraidereu-release-contract.mjs` to prevent falsely labeling a release ready.

### Phase 1 — WordPress staging foundation (later, requires controlled access)

1. Identify the actual WordPress hosting and a way to restore a **current** complete files+database snapshot to an isolated staging URL/environment, without overwriting Production. Preserve existing WordPress/PHP versions, theme files, plugins, custom templates, Polylang configuration, ACF fields and WPCode #488 **v6.2**. Never use the old archive alone as proof of rollback.
2. Restore the snapshot **successfully** and record a private restore checkpoint and recovery steps. Ensure staging has no real outbound bookings, email sending, live customer payment or crawl indexing. Production stays unchanged.
3. Read the current source of `templates/template-home.php` and export/map all relevant ACF field groups and three localized page values. Do not mistake empty `pages.content` for blank live home pages. Capture the exact current WPCode #488 snippet and its current hashes before attempting any replacement.
4. Capture non-sensitive baseline screenshots and browser behavior in desktop and mobile for EN #7, HU #90, HE #92; 21 tour posts; 12 blog/recommendation records; all footer anchors, image cards, green WhatsApp CTA, contact email, trust/reviews and map links. Verify no duplicate WhatsApp buttons.
5. Audit exact root and Lisbon hosting/source separately; **do not clone, replace or rewrite them** by editing the Budapest PHP theme.

### Phase 2 — security maintenance **alone**, not mixed with content changes

- Investigate the Yoast Premium license and official patched package; **Premium 21.0 reports no update**, which is not a clean bill of health. The vendor's 27.6.1 fix dates to **May 26, 2026**, while later CVE/advisory dates refer to publication. The `.htaccess` scenario requires Apache, manually enabled file-based redirects, and a user with post-edit capability; actual site conditions are not verified.
- The latest Premium 28.8 needs at least **WordPress 7.0** and free Yoast 28.8 according to vendor changelog. Current WordPress/PHP versions have not been verified. Do not install Premium 28.8 blindly or trust a third-party plugin ZIP. Use the preflight in #625 and verify every version/host/licensing condition.
- Audit whether Elementor and Contact Form 7 are actually used by theme/PHP/ACF/front-end. The selected CF7 replay issue requires its Stripe PaymentIntent pathway; generic CF7 presence is not evidence that path is enabled. Update one plugin at a time on **isolated staging**, checking the published tri-lingual content, form handling and metadata after each.
- After staging acceptance and owner release approval, perform a **separate**, recoverable security maintenance window. Do not combine a security upgrade with ACF copy or WPCode map replacement in one live rollback unit.

### Phase 3 — Budapest editorial / SEO source remediation **alone**

- Match the manifest in #596 to real ACF fields and `template-home.php`. Require Hungarian native copy review and verify current business rules (riders generally 16+, passengers only by arrangement, no blanket suitability, no guaranteed routes/speed/range).
- Keep tour cards short and keep the 21 tour-detail posts intact. Only publish changes to the exact ACF sources; do not overwrite generic WordPress `page.content`.
- Review localized Yoast title/description without changing permalinks, Polylang locale mapping or canonical/`hreflang` relations. Run `#591` source audit after publishing and verify the actual rendered DOM.
- One atomic editorial release and its own rollback; no change to FareHarbor/FBM/payment provider.

### Phase 4 — Budapest map & WPCode **alone**

- Current guest departure entrance is still unverified. The municipal parcel shows **Városház utca 14 = Pilvax köz 4** for the same property but **does not specify the entrance or pin**. Do not substitute Pilvax köz 1–3 (nearby hotel), text geocoding, guessed coordinates or free-text Google map iframe.
- Verify exact live business profile pin, approved guest entrance and **official correct iframe**. Review the full installed WPCode #488, not a fragment. The #598 integrated v7 candidate preserves the reported v6.2 footer script but **removes** an unverified map override; installing it too early may expose an old PHP map.
- Stage a single version-locked full-snippet replacement only after backup + source review. Confirm EN/HU/HE footer menu links, WhatsApp, review providers, email and map **with a real browser**, not just synthetic script tests. Do not create a second snippet or activate unrelated booking providers.

### Phase 5A — root landing **separate host / rollback / approval**

- Identify the host and serving source for **`/` only**, obtain and successfully restore a current **root-site** backup into isolated staging, and verify `www` redirect/canonical, Budapest link targets, mobile layout and SEO indexing. Do not assert Athens is currently operable.
- Review the new root destination messaging, and approve a **root-only** release. Changing the root visitor navigation must not be treated as disabling any old Lisbon provider checkout or cancelling bookings. Check external FareHarbor paths separately; preserve `/budapest/` routing and other existing production paths.
- Release the **root** only with its own tested rollback and approval. Check both `/` and `www` after publication before considering any Lisbon change.

### Phase 5B — Lisbon notice **separate provider / customer / rollback / approval**

- Discover the **`/lisbon/`** serving host and source and independently test restoration from a current Lisbon backup. Do not assume it shares the root application's file ownership or rollback.
- Review actual live FareHarbor products, sale availability and any **previously paid customers** before changing public language or providers. An HTML notice alone does not disable direct provider checkout URLs.
- Stage the Lisbon-specific candidate from #610 without booking forms, stale prices or unverifiable route promises. Review existing-reservation instructions and avoid cancellations/refunds without authorization.
- Require **separate explicit Lisbon release approval**. Independently verify Lisbon source and rendered page, mobile/HTTPS/SEO, direct provider purchasability controls, customer obligations and a Lisbon-only rollback. **Never use root approval as Lisbon approval.**

## Post-release acceptance (each atomic scope)

**Budapest content:** three home locales render correctly, old unsafe/unconditional ACF text gone from server source, correct contact, 21 tours and linked languages intact, no new PHP errors.

**Budapest map:** genuine exact guest entrance pin and embedded map location checked in browser; one green WhatsApp and correct footer/nav; no new guessed free-text map.

**Security:** patched versions confirmed through real WordPress, all required frontend/admin/editor/SEO/forms checks passed, no new PHP/JS errors, backup restore path still valid.

**Root/Lisbon:** obsolete Lisbon booking CTAs absent from source *and rendered page*, provider sale state reviewed, historical reservations not accidentally cancelled, URLs and SEO routing stable.

**STOP/ROLLBACK criteria:** unexpected booking checkout, lost WhatsApp route, failed tri-lingual navigation, broken ACF or map, missing plugin features, error/5xx spike, wrong live domain or irreversible data action. Stop further rollouts, use scope-specific verified backup/rollback, and retain evidence privately.

## Offline release-safety check

```sh
node scripts/check-legacy-ezraidereu-release-contract.mjs --self-test
node scripts/check-legacy-ezraidereu-release-contract.mjs
node scripts/check-legacy-ezraidereu-release-contract.mjs --input /private/release-evidence.json
```

No input means status reporting only; it does **not** fetch GitHub status or inspect WordPress. Evidence files remain local/private and require source-verifiable `verified:true` + `evidenceRef` per gate, and exact PR SHA. Even if every gate is *self-reported* as verified, the outcome is **`unverified-attestations-awaiting-review`**, the command exits nonzero, and **`mayDeployAutomatically:false`**. An arbitrary `evidenceRef` is only an untrusted pointer, not proof of a completed backup, live CI, authentic owner approval or any release authorization. Production releases still require explicit owner authorization and real host access. The checker rejects multi-workstream releases and archived WPCode restoration as a substitute for current v6.2.

**Technical limitation:** This source-only GitHub repository does not provide live WordPress PHP/ACF editing or a production backup/restore environment. Green standard GitHub Actions do **not** imply legacy WordPress readiness. Do not promote this release dossier as if it were installed.


### Independent fail-closed review — 29 October

A blind regression check of the original release-control code reproduced **two real false-readiness weaknesses**: plain `{verified:true,evidenceRef:"anything"}` claims for every gate were reported as `human-release-review-required`, and changing the map workstream's PR from **#598 to unrelated editorial #596** was not rejected. Neither flaw deployed code, but both could have encouraged an unsafe release decision if operators over-trusted the tool.

The **revised** checker fixes both:
- A hardcoded, individually reviewed workstream-to-PR-to-target-to-mandatory-gates mapping rejects changed PR assignments, changed target hosts, replaced status, missing gates and an attempt to substitute a newer-looking archive for the v6.2 checkpoint.
- It never marks *self-declared* private evidence as verified. Even complete-looking evidence produces `unverified-attestations-awaiting-review` and nonzero process exit. Independent review of original private restore, vendor license, exact **current** upstream SHA and human authorization is required outside the code.
- **24/24** targeted local test assertions pass against the exact GitHub-fetched source, including the two formerly missed cases and additional scope/status mutations. Original manifest remains a static **29-Oct snapshot**, not a GitHub online attestation. The new checker also treats root and Lisbon as separate workstreams sharing source PR #610, not as one release. It makes **no** WordPress, plugin, payment, hosting or GitHub merge changes.

A PR merge to the modern website would still publish only documentation and test code, not legacy WordPress or root/Lisbon changes. The live release remains blocked by #604 until individual prerequisites and approvals are independently verified.

**29 October follow-up:** The release contract now has **seven workstream records**, of which five are blocked actual releases and two are source-only/owner-installed checkpoints. The exact reviewed static workstream→PR→target→required-gates mappings reject scope swaps. A fake all-true evidence form yields `unverified-attestations-awaiting-review`, never a green release; the CLI exits with code 2. A valid planning document does not substitute for current GitHub CI or private host/provider evidence.


## 29 October — fresh GitHub source evidence (read-only)

A new zero-dependency, no-auth **public GitHub metadata checker** `scripts/check-legacy-ezraidereu-github-freshness.mjs` closes a source-freshness blind spot in this static release manifest. It compares each of the six prepared PRs' current **head SHA**, open/draft status, main base branch and **exact pinned existing website CI run** against the archive; it rejects changed heads, closed/merged PRs, wrong workflows, failed/stale source CI and missing results.

```sh
node scripts/check-legacy-ezraidereu-github-freshness.mjs --self-test
node scripts/check-legacy-ezraidereu-github-freshness.mjs --live
```

- `--self-test` runs **13/13** isolated pure-JS regression scenarios; no network request.
- `--live` makes public read-only GitHub API GET requests with timeouts, no token or repository/WordPress write; HTTP errors, rate limits and unexpected redirects produce **inconclusive**, not success. This is an optional operator command, **not** an Actions workflow or background monitor.
- Using the **connected GitHub plugin** to supply a fresh independent current-data snapshot, the new inspector returned **6/6 `snapshot-matches`**, with `releaseAuthorized:false`, zero mismatches. All six were still draft and unmerged at this check. This does **not** guarantee they will remain unchanged after this check.
- A match confirms only the historic **repository** source QA and unchanged draft head metadata; it does not verify live WordPress ACF/PHP, the real browser DOM, backups, provider purchases, Google guest pin, protected host settings or any release approval. The workstream gate in this packet remains **blocked** for every actual production change.

### Confirmed WordPress connector limitations

Authenticated WordPress readback of page IDs **7, 90 and 92** shows `template="templates/template-home.php"`, `content.raw` empty and no `acf` field payload (only trivial `meta`). The connected site-editing `templates.list` returns **zero block templates** and `templates.lookup(home)` returns null for this classic PHP theme. The GitHub account's visible repositories are only `Ezraider-os` and `Voy-pro-website`; the legacy PHP template source has not been located in them.

The installed WordPress connector therefore does **not** expose an authenticated editor/readback for that private PHP template or its actual ACF values. **Do not** generate artificial ACF field keys, overwrite blank REST page bodies or confuse an unreturned classic template with a missing live page. The already deferred owner/host source-and-backup task under #604 remains the only release dependency, not a new request.

### 29 October — source safety fixes propagated

Draft #610 was corrected after a blind mutation test found **five previously false-clean FareHarbor link/iframe/form URL forms** (protocol-relative or unquoted HTML attributes). It now has **23/23** public-source and **13/13** candidate guard tests PASS, with GitHub standard CI [#40864724139](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40864724139) SUCCESS at exact head `7cf1672743db81a84ece4b42d6fcf31f94818d01`. The release contract has been repinned to that **new** #610 head and run. It is still a *source-only proposed change*, not live Lisbon FareHarbor disablement. Other sources and host-specific gates remain unaffected.

Read-only infrastructure check: all five projects visible through the connected Vercel account were enumerated along with their attached domains. None serves `ezraidereu.com`; the modern `voy-pro.com` domains belong to the separate VOY PRO staging-named project. The legacy root/Lisbon host remains unidentified from those Vercel credentials; **do not** create a new Vercel project or assume migrating legacy root is authorized.

WordPress read-only safety status: Account Protection is **active**, Site Monitor is **inactive**, Jetpack Backup is **unavailable in this subscription**. No active Jetpack backup exists to treat as a restore point, and no monitoring product or paid plan has been activated. Treat legacy full-site backup/restoration as independently outstanding.

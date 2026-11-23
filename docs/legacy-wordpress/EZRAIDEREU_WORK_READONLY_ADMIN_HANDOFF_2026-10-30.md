# EZRaiderEU legacy WordPress — Work Cloud Browser read-only admin handoff

**Status:** prepared 30 October 2026; **no browser session has run from this chat**. The owner explicitly permitted **Work Cloud Browser as an option**, coordinated with the existing VOY PRO Development Control Center, to inspect the old site. This file is a precise execution protocol, **not a license to publish, update plugins, run payments, change login, or deploy**.

**Repository policy:** [AGENTS.md](../../AGENTS.md) and [DEVELOPMENT-COST-POLICY.md](../DEVELOPMENT-COST-POLICY.md) are controlling: one atomic task; exact-head standard build/launch/site QA; no automatic main merge; preserve public-domain and Vercel safeguards. This site is the **legacy WordPress** on `ezraidereu.com/budapest/`, **not** the new VOY PRO website or FBM.

## Authoritative scope, known state and stopping boundaries

- WordPress Jetpack site ID **258220563**. Known homepage IDs: **English 7**, **Hungarian 90**, **Hebrew 92**; all use the classic PHP template `templates/template-home.php` in theme `ezraider`. The connected content API returns empty page `content.raw` and no ACF payload; that is **not** proof the live homepage is empty.
- Owner-reported installed WPCode Lite snippet **#488 v6.2** is the baseline. Preserve it; **v7 in draft PR #598 is NOT installed**. Never activate a second footer snippet or replace the map iframe based on an unverified postal address.
- Current Budapest guest-facing email must be `Voyprobud@gmail.com`. Registered business property `Városház utca 14 = Pilvax köz 4` is cadastral **24285**; **exact rider entrance/Google pin remains unverified**. The owner already supplied the business listing URL `https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac`—do not ask again.
- The legacy domain **root** (`/`) and Lisbon (`/lisbon/`) may be served by a separate host; access to Budapest WordPress **does not establish** authority over either. Existing Lisbon FareHarbor links and obligations must not be changed while inspecting Budapest.
- The 26-Oct historical All-in-One WP Migration `.wpress` archive is known but **has not been restoration-tested**. Jetpack Backup is unavailable. Do not declare rollback ready.
- The connected WordPress account currently exposes legacy plugin versions, but **no theme PHP or ACF field-group source**. This specific Work task is meant to close that gap.

## Browser operating instructions — explicitly READ ONLY

**Preflight:** Run in ChatGPT **Work** mode with its cloud browser; do not impersonate Work in ordinary chat. Reuse only a site session already authenticated by the authorized user. Navigate to `https://ezraidereu.com/budapest/wp-admin/` using the browser. If login or two-factor verification is required, **stop** and record `AUTH_REQUIRED` privately; never request or put passwords/2FA codes/cookies/URLs with tokens in GitHub. If the dashboard URL redirects or Cloudflare challenges, report exact observed URL/status without inventing access.

**Step 1 — real environment/source ownership:** In WordPress Dashboard inspect site info (e.g. Tools → Site Health → Info, Dashboard → Updates), **read only**. Capture WP core and PHP version, active theme name/version, PHP template directory evidence and whether the administrator has a safe *read-only* path to theme sources (host File Manager / Theme File Editor, if already enabled). **Do not enable** theme/plugin editors or change files or site settings.

**Step 2 — actual ACF schema:** Navigate Custom Fields/ACF → Field Groups, if available. Identify groups applicable to template `templates/template-home.php` and home IDs 7, 90, 92. Record **field name, type, group name, repeater/group nesting, and translation/localization mapping**; capture only relevant non-sensitive *public marketing* values (header, tour card short descriptions, email, reviews, business map/meeting-point source). Distinguish `field_...` immutable IDs from `field_name` names. Keep a mapping for all three locales. Never make up field keys. Do not export the whole database, credentials or hidden/private options.

**Step 3 — actual PHP template readback:** If the existing admin UI provides an **authorized read-only view** of `wp-content/themes/ezraider/templates/template-home.php`, identify the exact source version, referenced `get_field` / `the_field` names, map embed origin, contact values and DOM elements/IDs involved in footer navigation. Do not click **Update File**, install a file-manager plugin, edit PHP, or execute it outside the server. If no accessible source view exists, mark `PHP_SOURCE_INACCESSIBLE`; source may have to come later from an existing host/backup route, not guessed.

**Step 4 — WPCode baseline, read only:** In WPCode inspect snippet **#488** (view only): active status, whether the owner-installed **v6.2** footer and main-script layout still appears as expected, and whether there is more than one active duplicated footer/WhatsApp snippet. Do **not** toggle, save, update, clone, publish, import or export snippets. Record only a safe version/source-check result; never paste unknown private snippet content into public GitHub.

**Step 5 — public site real-browser smoke:** Open public EN/HU/HE homepage, plus one tour-detail page in responsive desktop and mobile widths. Verify correct RTL for HE, visible titles/card-length (short on homepage, full on details), 6 footer anchors, one green WhatsApp floating button, absence of overlapping red WhatsApp CTA, correct Budapest email, and ratings provider labels (Google/Tripadvisor/GetYourGuide). Test clicks **only** to public, non-payment navigation or WhatsApp URL **without sending a message**. Inspect visible Google map link/iframe carefully but do not infer exact meeting-door position from an address or map screenshot. **Never submit** checkout or real customer forms.

**Step 6 — backup/patch readiness, read only:** Inspect the All-in-One WP Migration page for the existence and date of prior backups (without triggering export/import), Site Health software versions, Yoast Premium licensing/update *status without showing keys*, Elementor and Contact Form 7 usage references. Do not install, deactivate or update any plugin. Existing backup record is **not** a tested rollback. Record whether the live site is Apache and whether Yoast redirects are set to PHP or `.htaccess` **only if already visible safely**; otherwise mark unknown, not vulnerable-by-default.

## Required output — private evidence first, minimal sanitized GitHub notes

Return this **structured status** to the working Work/Control Center conversation. Avoid screenshot uploads to a *public* repository and redact all admin usernames, emails other than public business contact, login session identifiers, customer bookings, private hosting paths, site tokens and license keys:

```json
{
  "execution": "observed|auth_required|blocked",
  "wordpressCoreVersion": "verified value or unknown",
  "phpVersion": "verified value or unknown",
  "themeTemplate": "verified | source_inaccessible",
  "acfHomeFieldMap": "verified | partial | inaccessible",
  "locales": {"en": "passed|failed|inconclusive", "hu": "passed|failed|inconclusive", "he": "passed|failed|inconclusive"},
  "wpcode488": "v6.2 owner baseline observed | different | inaccessible",
  "liveFooterWhatsapp": "passed|failed|inconclusive",
  "mapExactEntrance": "verified|unverified",
  "backupRestored": false,
  "providerBookingVerified": false,
  "productionChanges": 0,
  "nextSafeAtomicTask": "short description",
  "redactedEvidenceStoredPrivately": true
}
```

**Missing data is explicitly `unknown` or `inconclusive`**, never `passed`. If the real browser finds live booking/reputation/map issues, record affected **public URL + locale + visible symptom**; do not publish visitor identities, any booking details or unpublished records.

## Handoff after inspection

1. Update only **sanitized observations** into [legacy issue #589](https://github.com/eli1979-ai/Voy-pro-website/issues/589) and link [deferred owner queue #604](https://github.com/eli1979-ai/Voy-pro-website/issues/604). Capture private artifacts inside the Work session, not the public repo.
2. Where exact ACF field names/template source are observed, prepare a **new narrow draft PR** based on then-current `main` for a single corresponding patch. Do not combine ACF, map and plugin security changes. No speculative `WPCode v7` deployment.
3. Before any live edit: verify a **current complete backup that has actually been restored in isolated staging**, confirm rollback, perform real browser QA, then obtain **separate owner approval** for each live content, security, map or root/Lisbon release.
4. If Work is inaccessible, record the specific blocker and continue safe independent GitHub checks. **Do not mark this checklist completed merely because the instructions exist.**

**Output of this PR is only a Work-ready procedure.** The browser has not been invoked and no WordPress admin facts beyond existing connector evidence should be claimed.

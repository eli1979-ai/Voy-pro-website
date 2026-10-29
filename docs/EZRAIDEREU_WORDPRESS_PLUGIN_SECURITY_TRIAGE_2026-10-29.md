# Legacy Budapest WordPress — plugin security advisory triage

**Date:** 29 October 2026. **Scope:** Jetpack-connected classic WordPress `/budapest/` (site #258220563), **not** the new VOY PRO frontend. **State:** read-only preparation; no WordPress/plugin updates, role mutations, production changes or approvals inferred.

## Verified read-only inventory

The WordPress plugin inventory returned **28 plugins, 20 active**. Selected installed/active versions:

| Plugin | Actual version | WordPress reports newer available |
|---|---:|---|
| Yoast SEO Premium | 21.0 | **No** (do not infer it is up to date) |
| Elementor | 3.23.4 | 4.3.5 |
| Contact Form 7 | 5.9.8 | 6.2.3 |
| Yoast SEO (free) | 28.7 | 28.8 |
| Advanced Custom Fields | 6.8.10 | No |
| Jetpack | 16.3.1 | No |

The plugin security condition cannot be determined solely from update flags. In particular Yoast Premium **21.0** does not report a vendor update in this connection, despite being inside more recent published affected-version ranges.

## Carefully scoped public advisories

1. **Yoast SEO Premium <27.6.1**, CVE-2026-10821: Yoast's official security fix was released **26 May 2026**; public CVE record published **2 Sep 2026**, and Patchstack indexed its advisory **26 Oct 2026**. Yoast says exposure requires Apache, manually enabled file-based redirects written to `.htaccess`, and a user with `edit_posts` capability (e.g. Author). This is a version-range match for installed 21.0, not proof the dangerous feature is enabled or exploited. [Yoast vendor advisory](https://yoast.com/yoast-seo-premium-may-26-2026/) · [Patchstack indexed advisory](https://patchstack.com/database/wordpress/plugin/wordpress-seo-premium/vulnerability/wordpress-yoast-seo-premium-plugin-27-6-1-author-arbitrary-htaccess-directive-injection-to-rce-vulnerability).
2. **Yoast SEO Premium <=26.6**, CVE-2026-40722: broken access control requiring a qualifying authenticated user; fixed 26.7. Version 21.0 matches. [Patchstack advisory](https://patchstack.com/database/wordpress/plugin/wordpress-seo-premium/vulnerability/wordpress-yoast-seo-premium-plugin-26-6-broken-access-control-vulnerability).
3. **Elementor <=3.23.4**, CVE-2024-5416: contributor-level stored XSS in relevant widgets, fixed 3.24.0; installed 3.23.4 matches. [Wordfence advisory](https://www.wordfence.com/threat-intel/vulnerabilities/wordpress-plugins/elementor/elementor-website-builder-more-than-just-a-page-builder-3234-authenticated-contributor-stored-cross-site-scripting-in-the-url-parameter-in-multiple-widgets).
4. **Contact Form 7 <=6.0.5**, CVE-2025-3247: an Order Replay issue **only where the affected CF7 Stripe PaymentIntent workflow is in use**, fixed 6.0.6; installed 5.9.8 matches but **this payment workflow is not confirmed at the site**. The issue can mislead operators about order fulfillment; it does not mean each Contact Form 7 site exposes a payment path. [Wordfence advisory](https://www.wordfence.com/threat-intel/vulnerabilities/wordpress-plugins/contact-form-7/contact-form-7-605-order-replay-vulnerability).

These **four selected CVEs are not a comprehensive audit**. The availability of a later plugin release does not itself prove a particular CVE is exploitable, and being outside these version ranges does not mean the site is safe. Current Yoast SEO free 28.7 is a **different installed plugin** and does not remove a known issue in Premium 21.0.

## Reachability evidence and limits

- WordPress `users.list` returned **one site collaborator** with Administrator role and did **not** report additional Author/Contributor collaborators. This is not proof that other user accounts, compromised credentials or plugin custom roles cannot exist or that there are no plugin/API attack paths.
- The six published classic sidebar widgets are all block widgets; their returned rendered content has no visible `contact-form-7`, `wpcf7` or `elementor` marker. Content search of indexable posts/pages/tours also found no matches. **This does not establish either plugin is unused**; custom PHP/ACF templates, unpublished forms and non-indexed objects remain outside connector visibility.
- Jetpack Scan reports `state: unavailable`, reason `missing_scan_capability`. No threats reported here does **not** imply a scan ran successfully. Jetpack Backup product has also been unavailable, and the older `.wpress` export has not been restoration-tested. Do not claim the backup or site security is verified.
- This analysis was strictly read-only: no User/role/permission/credential changes, no widget or plugin toggles, no form submissions or checkouts.

## New offline, read-only regression helper

`scripts/check-legacy-ezraidereu-plugin-advisories.mjs` compares **only** selected installed plugin version strings to the four known advisories above. It does not connect to WordPress or retrieve credentials.

```sh
node scripts/check-legacy-ezraidereu-plugin-advisories.mjs --self-test
node scripts/check-legacy-ezraidereu-plugin-advisories.mjs --input /private/plugin-versions.json
```

Input example (only plugin identity/version/status — **no accounts, mail, access tokens, private backup**). The helper also directly accepts the real connected WordPress `plugin.list` shape, which uses `plugin_file` rather than `slug`; you do not have to manually rename the identifier:

```json
{
  "plugins": [
    {"slug":"wordpress-seo-premium/wp-seo-premium","version":"21.0","status":"active"},
    {"slug":"elementor/elementor","version":"3.23.4","status":"active"},
    {"slug":"contact-form-7/wp-contact-form-7","version":"5.9.8","status":"active"}
  ]
}
```

Output `within-advisory-version-range` means only that the version matches a published range. Applicability conditions and authentication remain separate. Status `inconclusive` is returned for missing, duplicated or unparseable plugin versions rather than a false all-clear. Exit code **1**: a selected range match; **2**: incomplete/ambiguous input; **0**: no match to *these four CVEs*, explicitly **not** security certification. **Eighteen** independent synthetic scenarios check fixed-version boundaries, missing/duplicate/invalid fields, inactive plugins, conflicting IDs, unknown states and the actual `plugin_file` schema. All four selected historical advisories still match the three **active** WordPress plugins in the connected 29-Oct inventory. Both `matches` (all installed-version range matches) and `activeMatches` / `inactiveMatches` are returned to distinguish the risk of code loaded on the site from a disabled plugin's stale version; inactive-version matches still return exit 1 for review, but they do not count as active exposure. An unrecognized activation state is *inconclusive*, not safe. This script is **not** connected to GitHub CI or any public schedule; it is intentionally local/offline to preserve low usage and avoid production credentials.

## Safest release path

1. **Immediate priority to investigate** Yoast Premium license/vendor update channel and ability to reach an officially patched version; the site does not display a usable Premium update path. Follow the vendor's **26 May 2026** mitigation notice: inspect the redirect method without changing settings; default PHP-based redirects are **not affected by CVE-2026-10821**, and .htaccess mode plus Apache plus edit_posts-capable account is the specific exposed configuration. Obtain the licensed official update channel and validate the patch/rollback path. No unofficial ZIPs and no one-click change without an update/rollback plan.
2. Obtain an up-to-date **full files+database snapshot with successful restoration into isolated staging**, preserving current WPCode #488 v6.2 and all custom ACF field values. Do not upload a customer database or backup to a public repository.
3. Update one plugin at a time in staging from a trusted, officially signed/served package; validate admin, EN/HU/HE homepage, 21 tour pages, full-copy rendering, 18 footer anchors, green WhatsApp, email, contact forms, Yoast metadata, and old business map behavior. Do not accidentally reactivate FareHarbor, direct FBM booking or paid checkouts.
4. For the **CF7 issue specifically**, first confirm whether the Stripe PaymentIntent integration is enabled, then tailor mitigation/tests accordingly. Never test with a live charge or real customer data.
5. After exact-head QA, a reviewed restore path and owner authorization, schedule a narrowly scoped live maintenance release; verify on real visitors' paths and prepare rollback. Never update all three plugins together or silently disable potentially used content widgets.

**All human/host/plugin-license/production tasks remain deferred:** [owner queue #604](https://github.com/eli1979-ai/Voy-pro-website/issues/604) and [security issue #615](https://github.com/eli1979-ai/Voy-pro-website/issues/615). The current source-only branch is not a WordPress plugin patch and will not change this site's exposure on merge.

### 29 October read-only code verification

The exact GitHub-fetched updated checker was evaluated against the **unmodified 28-plugin WordPress connector response** (using native `plugin_file` fields). It returned **four version matches, four active matches, zero inactive matches, zero unknowns** across the three tracked plugins; 18/18 synthetic cases passed. This is a *detection* result, not any mitigation. CVE applicability requires the conditional plugin feature, host and role constraints discussed above.

**Corrected vendor chronology:** Yoast itself announced the **27.6.1 patch on 26 May 2026**. WPScan publicly catalogued the issue in June 2026, the public CVE record shows **2 September 2026**, and Patchstack's indexed advisory shows **26 October 2026**. These are different publication/indexing dates for the same issue, not separate patches. The minimum patch version remains 27.6.1.

### Additional authenticated settings readback (29 October)

Read-only WordPress `settings.get` reports `users_can_register=true` and `default_role=subscriber` for `/budapest/`. Thus the configured default for **new registrations** is low privilege, which does not on its own satisfy the Author+ prerequisites of the selected Yoast Premium advisories, but the site's registration setting still needs an owner-reviewed business and abuse-prevention decision. **A public registration page could not be independently opened from the available web client**, so this setting alone does *not* prove a working public sign-up endpoint or actual registrations.

`users.list` returns **one collaborator with Administrator role** through this particular connector. It is **not a complete inventory of self-registered subscribers** and should not be used to infer that the site has only one WordPress account. WordPress discussions currently report `default_comment_status=closed`, `default_ping_status=closed`, `comment_previously_approved=true`, but those values are not a substitute for plugin/front-end abuse protection.

A future **read-only** host audit should validate whether public registration was intentionally required, whether bot protection or an authentication plugin blocks it, and whether it relates to any historical customer access. Changing `users_can_register`, roles, security rules or login URLs is an **authentication / business-impacting Production change** requiring explicit owner approval and rollback preparation. No live settings were modified in this review.

### Vendor update channel and compatibility, independently verified

Yoast's [official update help](https://yoast.com/help/not-receiving-updates-support/) explains that absent Premium updates may be caused by a subscription that is unactivated, missing or expired, but **the actual reason on this installation is not established**. The [vendor licensing FAQ](https://yoast.com/help/does-my-licensed-plugin-expire/) confirms older Premium plugins can keep functioning without a current subscription while losing updates. Do **not** infer a specific license-expiration state from the connector's `update_available=false`.

The [Yoast Premium changelog](https://developer.yoast.com/changelog/yoast-seo-premium/) lists **Premium 28.8 released 27 Oct 2026**, with minimum **Yoast SEO free 28.8** and **WordPress 7.0**. This legacy site's WordPress core version has **not been independently established** by the available WordPress connector, so do **not** blindly install Premium 28.8 or update the free/Premium versions out of order. Inspect the actual WP core and PHP versions, legitimate license/update availability, and plugin version dependencies during a restorable staging maintenance release. Any safer intermediate patched version must be vetted for current security fixes and legitimate vendor support, not simply assumed compatible.

The severity ranking above is a **maintenance priority**, not a claim of currently exploitable RCE. Even the vendor's high-impact scenario depends on a manually chosen redirect mode and server prerequisites. The current site redirect method remains **unverified**.

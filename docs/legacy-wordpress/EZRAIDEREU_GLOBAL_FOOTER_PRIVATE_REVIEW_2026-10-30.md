# EZRaiderEU — private global Header & Footer cleanup verification

**30 October 2026 — preparation only. NO live WordPress edits or approved release.**

## Confirmed source ownership

[Authenticated Work #685](https://github.com/eli1979-ai/Voy-pro-website/issues/685#issuecomment-6518143822) confirmed the **old red FareHarbor floater and its two unwanted event handlers are in the GLOBAL WPCode Header & Footer → Footer injection**, a different editable surface from owner-installed active snippet **#488 v6.2**. The legacy injector adds a `.fh-fixed--bottom` / `.fh-button-true-flat-red` red anchor; a second handler sets its localized label (`Időpontot foglalok` in HU) and a separate handler rewrites `.hero__cta` and `.button-cta` to a historic FareHarbor endpoint. The latter can counteract the WhatsApp rewrite in #488 depending on callback order. This source observation corrects earlier candidate-only guesses.

**Work already prepared a minimal private diff** and did not install it. Because the old global source and its backup contain site-admin code, do **not** copy those raw files into this public repository, GitHub comments or CI. The new helper is a **local-only diff safety test** which an already-authorized Work session can run on private copies; this branch does not contain the privately prepared patch, does not remove the red button live and does not alter #488.

## Offline private check

Prepare three local, PRIVATE text files inside the authorized Work environment:

- `footer-original.html`: exact Global Header & Footer → Footer field before any change.
- `footer-candidate.html`: proposed Footer field after deleting only the obsolete anchor and its two handler spans. Preserve the jQuery `script src` dependency and all unrelated Footer markup/scripts **byte-for-byte**.
- `footer-exact-removals.json`: exact original text spans and required intent labels: `red-floater-anchor`, `red-floater-label-handler`, `fareharbor-cta-rewriter`. The JSON field `target` must be `global-header-footer-footer` (not WPCode #488). Never include private raw spans in issue comments or source control.

```sh
node scripts/check-legacy-ezraidereu-global-footer-removal.mjs --self-test
node scripts/check-legacy-ezraidereu-global-footer-removal.mjs \
  --before /private/footer-original.html \
  --after /private/footer-candidate.html \
  --removals /private/footer-exact-removals.json
```

The checker checks the **exact before→after relation** (removing precisely three single-occurrence spans, no unrelated changes), confirms the expected red FareHarbor anchor, a matching HU/HE old-floater label handler and both `.hero__cta`/`.button-cta` provider-override selectors, rejects unexpected deletion of `script src` dependencies or the unrelated green WPCode #488 marker, checks that no old provider/red-floater signature remains after removal, and syntax-parses remaining inline JavaScript **without executing it**. It emits only generic safety codes, no raw code, credentials, customer content or file paths. It returns `candidate-diff-structure-only` rather than deployment permission.

**Limitations / release STOP:** Even a PASS proves only structural identity of private text files. It does **not** prove that the original is the currently installed live footer, that PHP/WordPress callbacks are executed in the expected order, absence of links injected by plugins or other scripts, FareHarbor third-party checkout state, EN/HU/HE/mobile behavior, browser clickability or successful recovery. All these need a separately authorized, private staging browser test with **current full backup successfully restored**. The fresh All-in-One archive (30 Oct 607.33 MB UI) exists but no isolated restore has passed. The Import UI shows 64 MB limit; never run the live Backups → Restore button as a test.

**Recommended acceptance after restore approval:** precisely one green floating WhatsApp CTA for EN/HU/HE on home, detail and article; no red floating FareHarbor link; preserve legitimate in-content enquiry CTAs, all six footer navigation anchors and existing #488 v6.2 without edit; verify no Hero/CTA flips back to FareHarbor after DOM ready/load; test desktop/mobile and preserve a verified rollback. Do not disable the separate FareHarbor plugin or replace bookings with FBM as part of this cleanup.

**Verification:** The exact standalone helper passed **14/14 isolated synthetic cases** including unwanted changes, provider remnants, duplicated old anchors, wrong target, malformed scope, missing label signature, removed dependency, changed #488 marker and malformed inline JS. GitHub repository's standard required build/launch/site QA runs separately and **does not invoke this private checker**. No new dependency, GitHub workflow, Vercel Preview, PHP edit, ACF content, WordPress plugin update or permission change was introduced.

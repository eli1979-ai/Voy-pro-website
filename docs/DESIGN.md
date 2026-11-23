# VOY PRO design tokens — DR-07/08/10 draft

**Source:** `fontsource/font-files`, Rubik variable `wght` subsets (Hebrew, Latin, Latin-ext), licensed under SIL OFL 1.1. License is bundled at `site/assets/fonts/OFL-rubik.txt`. These font assets are self-hosted, not loaded from a runtime CDN.

## Draft type scale
- XS: `12px` (hard readability floor)
- Small: `14px`
- Body: `16px`
- Large: `20px`
- Headings: `clamp(28px,3vw,40px)`

Use `var(--voy-type-xs|sm|body|lg|heading)` and `var(--voy-font-body)`. Three intended button classes: primary (`.btn`), secondary (`.btn.secondary` / `.btn.hero-secondary`), text-only (`.footer-link-button`). The existing site has additional legacy button styles: consolidation is **NOT PROVEN / PENDING**.

Three intended radii: small `10px`, card `18px`, pill `999px`. Existing legacy values are not globally rewritten pending real visual QA.

## Required acceptance before a merge candidate
Verify self-hosted Rubik loads in `document.fonts` on EN, HE, HU, ES and relevant tour pages; 0 text below 12px, 0 tracked/uppercase Hebrew, 0 actionable targets under 24px, <=12 distinct rendered font sizes, and no font-induced CLS at 375/1440. Currently **NOT PROVEN**. No merge or deployment permitted.

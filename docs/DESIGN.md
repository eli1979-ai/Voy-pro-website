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

## DR-07 source type quantization
Twelve allowed discrete computed font-size steps: `12px`, `14px`, `16px`, `18px`, `20px`, `24px`, `28px`, `32px`, `36px`, `40px`, `48px`, `56px`. Literal pixel/rem declarations in the main stylesheet are snapped to the nearest step; fluid clamp declarations retain their original fallback and use CSS `round(nearest, …, 8px)` on browsers with CSS Values Level 4 support. This is a source change, not proof that rendered pages pass the <=12 unique-size or CLS gates.

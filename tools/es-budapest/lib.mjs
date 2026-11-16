// Spanish Budapest preview generator — shared transform helpers.
//
// The Spanish pages are generated from the English Budapest source pages so
// that layout, components, photography and page-specific content stay
// equivalent. They are static: no site.js, no FBM API, no availability,
// checkout or payment. Booking is replaced by a human WhatsApp inquiry panel.
import fs from 'node:fs';
import path from 'node:path';

export const ROUTES = [
  '', 'tours/buda-castle-ezraider-tour/', 'tours/margaret-island-ezraider-tour/',
  'tours/buda-margaret-extended-tour/', 'tours/heroes-square-city-ezraider-tour/',
  'tours/citadella-advanced-ezraider-tour/', 'private-tours/', 'with-kids/',
  'group-tours/', 'corporate-events/', 'first-day/', 'where-to-stay/',
  'unique-things-to-do/', 'buda-castle-without-walking/'
];

export const enFile = (root, r) => path.join(root, 'site', 'budapest', r, 'index.html');
export const esFile = (root, r) => path.join(root, 'site', 'es', 'budapest', r, 'index.html');
export const enPath = r => '/budapest/' + r;
export const esPath = r => '/es/budapest/' + r;

// Runtime hydration fallbacks in the English source are replaced by the
// canonical English text first, then translated like any other copy.
export const CANONICAL = {
  riderPolicyFallbacks: [
    'Riding eligibility details are temporarily unavailable',
    'Independent riding eligibility is shown live'
  ],
  riderPolicy: 'Independent riding 16+ (15 with assessment)',
  agePolicy: 'Independent riding is from age 16. Riders aged 15 may be approved as an exception by our team. Children from age 1 through 15 can join as passengers using the appropriate child/passenger seat setup.'
};

// JS-only hooks. CSS-used data attributes (data-page, data-tour-image,
// data-media-slot, data-review-*, data-runtime-*, data-home-live-price,
// data-tour-live-state) and data-faq (FAQ schema renderer) are kept.
const STRIP_ATTRS = [
  'data-track', 'data-wa', 'data-personalize-cta', 'data-personalize-kicker',
  'data-select-experience', 'data-tour-detail', 'data-tour-card', 'data-tour-price',
  'data-experience-slugs', 'data-api-tour-duration', 'data-api-guide-languages',
  'data-intent-hub', 'data-ez-tour-guide', 'data-media-label', 'data-tour-mode',
  'data-route-visual', 'data-policy-live', 'data-checkout-intel', 'data-selected-tour-hint',
  'data-mobile-nav-wa', 'data-runtime-age-policy', 'data-special-request', 'data-b2b-whatsapp'
];

export function stripJsAttributes(html) {
  for (const a of STRIP_ATTRS) {
    html = html.replace(new RegExp('\\s' + a + '(?:="[^"]*")?(?=[\\s/>])', 'g'), '');
  }
  return html;
}

export function removeSection(html, re) {
  const m = html.match(re);
  if (!m) return { html, removed: false };
  return { html: html.replace(m[0], ''), removed: true };
}

// Split HTML into tags and text, translating text and selected attributes.
const TRANSLATABLE_ATTRS = ['alt', 'aria-label', 'title', 'placeholder'];
export function translateHtml(html, dict, missing, context) {
  const parts = html.split(/(<[^>]+>)/);
  let inRaw = null;
  return parts.map(part => {
    if (!part) return part;
    if (part.startsWith('<')) {
      const lower = part.toLowerCase();
      if (inRaw) { if (lower.startsWith('</' + inRaw)) inRaw = null; return part; }
      if (/^<(script|style)\b/.test(lower)) { inRaw = lower.match(/^<(script|style)/)[1]; return part; }
      return part.replace(/\s(alt|aria-label|title|placeholder)="([^"]*)"/g, (all, attr, value) => {
        const t = translateText(value, dict, missing, context + ' @' + attr);
        return ' ' + attr + '="' + t + '"';
      });
    }
    if (inRaw) return part;
    return translateText(part, dict, missing, context);
  }).join('');
}

const NEUTRAL = /^[\s\d.,:;!?·•—–\-+×()/%€★#&;|’'"“”…←→↑↓]*$/;
export function translateText(text, dict, missing, context) {
  const core = text.replace(/\s+/g, ' ').trim();
  if (!core || NEUTRAL.test(core)) return text;
  if (!/[A-Za-zÀ-ÿ]/.test(core)) return text;
  if (Object.prototype.hasOwnProperty.call(dict, core)) {
    const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0];
    return lead + dict[core] + tail;
  }
  missing.set(core, (missing.get(core) || new Set()).add(context));
  return text;
}

export function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

#!/usr/bin/env node
// Generate the 14 Spanish Budapest preview pages from the English source.
//
//   node tools/es-budapest/generate.mjs --extract   list untranslated strings
//   node tools/es-budapest/generate.mjs             write site/es/budapest/**
//
// Inputs (all in tools/es-budapest/): es-dictionary.json (EN → ES copy),
// pages.json (approved Spanish title/description/facts/WhatsApp text) and
// route-visuals/*.html (the English route photo strip + schematic that
// site.js renders on the three tour pages, captured from a local build).
// Output pages load no JavaScript: no availability, checkout, FBM or payment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROUTES, enFile, esFile, enPath, esPath, CANONICAL, stripJsAttributes,
  translateHtml, translateText, readJson
} from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const extractOnly = process.argv.includes('--extract');
const dict = readJson(path.join(here, 'es-dictionary.json'));
const pages = readJson(path.join(here, 'pages.json'));
const WA_BASE = 'https://wa.me/36300993099?text=';
const MAPS_URL = 'https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac';
const missing = new Map();
const WA_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M20.5 3.5A11.6 11.6 0 0 0 12.1 0C5.7 0 .4 5.2.4 11.6c0 2 .5 4 1.6 5.7L0 24l6.9-1.8c1.6.9 3.4 1.4 5.2 1.4 6.4 0 11.6-5.2 11.6-11.6 0-3.1-1.2-6-3.2-8.2Zm-8.4 18.1c-1.7 0-3.4-.5-4.8-1.4l-.4-.2-4.1 1.1 1.1-4-.3-.4a9.6 9.6 0 0 1-1.5-5.1c0-5.3 4.3-9.6 9.6-9.6a9.6 9.6 0 0 1 0 19.2Zm5.3-7.1c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1a7.8 7.8 0 0 1-2.3-1.4 8.7 8.7 0 0 1-1.6-2c-.2-.3 0-.4.1-.6l.5-.5c.2-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5 0-.8.3s-1 1-1 2.4 1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.4.7.3 1.3.4 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z"></path></svg>';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const routeKey = r => (r || 'home').replace(/\/$/, '').replace(/\//g, '_');

function waHref(r) {
  return WA_BASE + encodeURIComponent(pages[r].wa);
}

function rewriteLinks(html, r) {
  // Internal Budapest routes that exist in Spanish → Spanish equivalents.
  html = html.replace(/href="(?:https:\/\/voy-pro\.com)?\/budapest\/([^"#?]*)(#[^"]*)?"/g, (all, rest, hash) => {
    const target = rest && !rest.endsWith('/') ? rest + '/' : rest;
    if (!ROUTES.includes(target)) return all;
    const h = hash === '#booking' ? '#consulta' : (hash || '');
    return 'href="' + esPath(target) + h + '"';
  });
  html = html.replace(/href="#booking"/g, 'href="#consulta"');
  // English-only destinations stay English but are announced as such.
  html = html.replace(/<a\b([^>]*\bhref="\/(?:legal\/|manage\/|ezraider\/)[^"]*"[^>]*)>/g, (tag, attrs) =>
    /\slang=/.test(attrs) ? tag : '<a' + attrs + ' hreflang="en">');
  return html;
}

function languagePicker(r, cls) {
  const links = [
    ['en', 'EN', enPath(r)], ['hu', 'HU', '/hu/budapest/' + r], ['he', 'עברית', '/he/budapest/' + r], ['es', 'ES', esPath(r)]
  ];
  return links.map(([code, label, href]) => code === 'es'
    ? `<a class="lang-switch active" aria-current="page" href="${href}" hreflang="es" lang="es">${label}</a>`
    : `<a class="lang-switch" href="${href}" hreflang="${code}" lang="${code}">${label}</a>`).join('');
}

function mobileMenu(r) {
  const items = [
    ['tours/buda-castle-ezraider-tour/', 'Tour del Castillo de Buda'],
    ['tours/margaret-island-ezraider-tour/', 'Isla Margarita'],
    ['tours/heroes-square-city-ezraider-tour/', 'Plaza de los Héroes'],
    ['tours/citadella-advanced-ezraider-tour/', 'Citadella avanzado'],
    ['tours/buda-margaret-extended-tour/', 'Recorrido ampliado'],
    ['private-tours/', 'Tours privados'],
    ['with-kids/', 'Budapest con niños']
  ].map(([t, label]) => `<a href="${esPath(t)}">${label}</a>`).join('');
  return `<details class="es-mobile-menu"><summary class="nav-menu-toggle" aria-label="Abrir el menú de navegación">Menú</summary>` +
    `<div class="mobile-nav-card" role="navigation" aria-label="Menú de navegación"><b>Explora Budapest</b>${items}` +
    `<a href="/portugal/" hreflang="en">Portugal · Marvão (en inglés)</a>` +
    `<div class="mobile-language-row" aria-label="Idioma">${languagePicker(r)}</div>` +
    `<a class="btn secondary" href="${waHref(r)}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>` +
    `<a class="btn" href="#consulta">Consultar disponibilidad</a></div></details>`;
}

function inquirySection(r) {
  const facts = pages[r].facts.map(f => `<span class="es-fact">${esc(f)}</span>`).join('');
  return `<section class="section booking es-inquiry" id="consulta" aria-labelledby="es-consulta-title"><div class="wrap booking-grid"><div>` +
    `<div class="eyebrow" style="color:#0d4d7c">CONSULTA</div><h2 id="es-consulta-title">Consulta disponibilidad y precio</h2>` +
    `<div class="panel es-inquiry-panel"><div aria-label="Pasos de la consulta" class="booking-steps">` +
    `<div class="booking-step is-active"><small>Paso 1</small><b>Elige el recorrido</b></div>` +
    `<div class="booking-step"><small>Paso 2</small><b>Indica fecha, grupo e idioma</b></div>` +
    `<div class="booking-step"><small>Paso 3</small><b>El equipo confirma por WhatsApp</b></div></div>` +
    `<div class="es-commercial-facts" aria-label="Precio orientativo y datos del recorrido">${facts}</div>` +
    `<p>En español no hay reserva ni pago en línea. Escríbenos por WhatsApp con el recorrido, la fecha, el número de conductores y pasajeros y el idioma de guía que prefieres: el equipo local te confirma la disponibilidad, el precio final y el horario.</p>` +
    `<a class="btn es-inquiry-whatsapp" href="${waHref(r)}" target="_blank" rel="noopener noreferrer" lang="es">Consultar por WhatsApp</a>` +
    `<p class="notice">Vista previa: no se aceptan reservas reales ni pagos desde estas páginas. El idioma de esta página no garantiza un guía en español.</p>` +
    `</div></div><aside class="panel"><div class="eyebrow" style="color:#0d4d7c">DATOS PRÁCTICOS</div>` +
    `<h3>Budapest · salidas diarias · práctica antes de salir</h3>` +
    `<p class="notice">El precio final y los horarios disponibles se confirman de forma personal antes de reservar.</p>` +
    `<div class="reassure"><div class="reassure-item">Casco e instrucciones incluidos</div><div class="reassure-item">Práctica guiada antes de salir</div>` +
    `<div class="reassure-item">Confirmación personal por WhatsApp</div><div class="reassure-item">Sin pagos en esta página</div></div></aside></div></section>`;
}

function b2bPanel(r) {
  const items = ['Fecha y franja horaria preferidas', 'Número aproximado de participantes',
    'Conductores independientes y niños o bebés pasajeros', 'Idioma de guía preferido',
    'Formato: grupo privado o abierto a la recomendación del equipo'];
  return `<div class="panel es-b2b-whatsapp"><h3>Qué indicar en tu mensaje</h3><ul>` +
    items.map(i => `<li>${i}</li>`).join('') + `</ul>` +
    `<a class="btn alt" href="${waHref(r)}" target="_blank" rel="noopener noreferrer" lang="es">Continuar en WhatsApp</a>` +
    `<p class="notice">Se abre WhatsApp con un mensaje preparado: no se envía nada hasta que pulses Enviar. Es una consulta, no una reserva confirmada.</p></div>`;
}

function meetingPointSection() {
  return `<section class="section meeting-point-section" aria-labelledby="es-meeting-title"><div class="wrap meeting-point-grid">` +
    `<div class="meeting-point-copy"><div class="eyebrow">PUNTO DE ENCUENTRO</div><h2 id="es-meeting-title">Empezamos en el centro de Budapest.</h2>` +
    `<p>Llega unos 15 minutos antes de la salida para el registro, el ajuste del equipo y las instrucciones de conducción.</p>` +
    `<div class="meeting-point-address"><b>VOY PRO Budapest</b><strong>Városház utca 14, 1052 Budapest, Hungría</strong></div>` +
    `<a class="btn secondary meeting-point-button" href="${MAPS_URL}" target="_blank" rel="noopener">Abrir en Google Maps</a></div>` +
    `<div class="meeting-map-card meeting-map-card--google"><div class="meeting-map-label"><small>Punto de encuentro exacto</small>` +
    `<b>EZRaider Budapest by Voy PRO</b><span>Városház utca 14, 1052 Budapest, Hungría</span></div></div></div></section>`;
}

function buildHead(enHtml, r) {
  const meta = pages[r];
  const enHead = enHtml.match(/<head>([\s\S]*?)<\/head>/)[1];
  const hreflangs = [...enHead.matchAll(/<link href="([^"]+)" hreflang="([^"]+)" rel="alternate"\/>/g)]
    .map(m => `<link href="${m[1]}" hreflang="${m[2]}" rel="alternate"/>`).join('');
  const styles = [...enHead.matchAll(/<link\b[^>]*stylesheet[^>]*>/g)].map(m => m[0])
    .filter(t => !/budapest-review-ticker\.css/.test(t)).join('');
  const canonical = 'https://voy-pro.com' + esPath(r);
  const h1 = meta.title.replace(/ \| VOY PRO$/, '');
  const crumbs = [{ name: 'VOY PRO', item: 'https://voy-pro.com/' }, { name: 'Budapest', item: 'https://voy-pro.com/es/budapest/' }];
  if (r) crumbs.push({ name: h1, item: canonical });
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: meta.title, description: meta.description, url: canonical, inLanguage: 'es',
      isPartOf: { '@type': 'WebSite', name: 'VOY PRO', url: 'https://voy-pro.com/' } }
  ].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  return `<head><meta charset="utf-8"/><meta content="width=device-width,initial-scale=1" name="viewport"/>` +
    `<meta content="#0d151d" name="theme-color"/><meta content="light" name="color-scheme"/><meta content="index,follow" name="robots"/>` +
    `<title>${esc(meta.title)}</title><meta name="description" content="${esc(meta.description)}"/>` +
    `<link href="${canonical}" rel="canonical"/>${hreflangs}${styles}<link rel="stylesheet" href="/assets/spanish-budapest.css"/>${ld}</head>`;
}

function transform(r) {
  const en = fs.readFileSync(enFile(repo, r), 'utf8');
  const bodyTag = en.match(/<body\b[^>]*>/)[0];
  let body = en.split(bodyTag)[1].split('</body>')[0];
  const ctx = 'es/budapest/' + r;

  // 1. Runtime-only parts: scripts, live booking, review ticker, resume banner.
  body = body.replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/g, '');
  const booking = body.match(/<section class="section booking" id="booking">[\s\S]*?<\/section>/);
  if (booking) body = body.replace(booking[0], inquirySection(r));
  else body = body.replace(/<section class="section budapest-cancel-policy"/, inquirySection(r) + '<section class="section budapest-cancel-policy"');
  body = body.replace(/<section class="vp-reviews"[\s\S]*?<\/section>/g, '');
  body = body.replace(/<section class="resume-shell"[\s\S]*?<\/section>/g, '');

  // 2. Static versions of runtime-rendered English components.
  //    The approved cancellation & weather policy appears on every Spanish page
  //    (English group/corporate pages link to it; Spanish pages show it in place).
  if (!/<section class="section budapest-cancel-policy"/.test(body)) {
    const home = fs.readFileSync(enFile(repo, ''), 'utf8');
    const policy = home.match(/<section class="section budapest-cancel-policy"[\s\S]*?<\/section>/)[0];
    body = body.replace(/(<section class="section booking es-inquiry"[\s\S]*?<\/section>)/, '$1' + policy);
  }
  body = body.replace(/(<section class="section budapest-cancel-policy"[\s\S]*?<\/section>)/, '$1' + meetingPointSection());
  const visualFile = path.join(here, 'route-visuals', routeKey(r) + '.html');
  if (fs.existsSync(visualFile)) {
    const visual = fs.readFileSync(visualFile, 'utf8');
    body = body.replace(/(<p class="route-itinerary-lede">[\s\S]*?<\/p>)/, '$1' + visual);
  }

  // 3. Fallback text that the English runtime would hydrate.
  for (const f of CANONICAL.riderPolicyFallbacks) body = body.split('>' + f + '<').join('>' + CANONICAL.riderPolicy + '<');
  body = body.replace(/(<p data-runtime-age-policy>)[\s\S]*?(<\/p>)/g, '$1' + CANONICAL.agePolicy + '$2');

  // 4. Header: Spanish language picker and a no-JS mobile menu.
  body = body.replace(/<span aria-label="Language" class="language-picker">[\s\S]*?<\/span>(<\/nav>)/,
    '<span aria-label="Idioma" class="language-picker">' + languagePicker(r) + '</span>$1' + mobileMenu(r));

  // 4b. JS-only controls get static, privacy-first equivalents.
  //  - Cookie settings: Spanish pages set no optional cookies or analytics.
  body = body.replace(/(?:<br\/>)?<button type="button" class="footer-link-button" data-cookie-settings>[\s\S]*?<\/button>/g, '');
  //  - Thule product photos load from thule.com only after opt-in (JS); show a neutral frame.
  body = body.replace(/<div class="family-seat-media"><img\b[^>]*\balt="([^"]*)"[^>]*>\s*<button[^>]*data-thule-load[^>]*>[\s\S]*?<\/button><\/div>/g,
    (all, alt) => `<div class="family-seat-media es-seat-neutral" role="img" aria-label="${alt}"><span>${/Junior/.test(alt) ? 'Thule Yepp Junior' : 'Thule Yepp 2 Maxi'}</span></div>`);
  //    No product image is shown, so drop the image credit (keep the model number).
  body = body.replace(/Thule model 12041302 · Product image: Thule/g, 'Thule model 12041302')
    .replace(/<span class="family-seat-source">Product image: Thule<\/span>/g, '');
  //  - Group / corporate enquiry planner (JS form) → static WhatsApp checklist.
  body = body.replace(/<form\b[^>]*>[\s\S]*?<\/form>/g, () => b2bPanel(r));
  //  - Review counts in Spanish number style (1327, not 1,327).
  body = body.replace(/(<span data-review-count="[a-z]+">)(\d{1,3}),(\d{3})(<\/span>)/g, '$1$2$3$4');

  // 5. Floating WhatsApp and mobile sticky bar → Spanish human inquiry.
  //    Same compact markup the English runtime builds, so shared CSS applies.
  body = body.replace(/<a class="whatsapp"[^>]*>WhatsApp<\/a>/,
    `<a class="whatsapp compact-booking-whatsapp" href="${waHref(r)}" target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp" style="--booking-whatsapp-bottom: 110px;">${WA_ICON}<span class="compact-booking-whatsapp-label">WhatsApp</span></a>`);
  //    Every WhatsApp link uses the Spanish, route-specific prefilled message.
  body = body.replace(/href="https:\/\/wa\.me\/36300993099[^"]*"/g, 'href="' + waHref(r) + '"');
  //    Sticky bar shows the amount under its own "Desde" label (as the English runtime does).
  const barPrice = r === 'private-tours/' ? '100 €' : '70 €';
  body = body.replace(/(<div class="mobilebook">[\s\S]*?<b data-runtime-price="">)From €\d+(<\/b>)/, '$1' + barPrice + '$2');
  //    Private page: the approved Spanish private price (70 € + 30 € suplemento).
  if (r === 'private-tours/') body = body.replace(/(<div class="facts[^"]*"><span data-runtime-price="">)From €70(<\/span>)/, '$1From €100 per rider$2');

  body = stripJsAttributes(rewriteLinks(body, r));
  body = translateHtml(body, dict, missing, ctx);

  const head = buildHead(en, r);
  // EN data-page keeps the shared Budapest component styles identical; the
  // Spanish route is exposed separately for QA and analytics-free targeting.
  const esBody = bodyTag
    .replace(/class="([^"]*)"/, (m, c) => 'class="' + (c ? c + ' ' : '') + 'es-budapest"')
    .replace(/<body(?![^>]*class=)/, '<body class="es-budapest"')
    .replace(/>$/, ' data-es-page="' + esPath(r) + '">');
  const ribbon = '<div class="voy-preview-ribbon" role="note">Vista previa · No se aceptan reservas reales desde estas páginas</div>';
  const withRibbon = body.replace(/(<a class="skip-link"[^>]*>[^<]*<\/a>)/, '$1' + ribbon);
  return `<!DOCTYPE html>\n<html lang="es">${head}\n${esBody}${withRibbon}</body></html>\n`;
}

const outputs = ROUTES.map(r => [r, transform(r)]);
if (missing.size) {
  const list = [...missing].map(([s, ctx]) => ({ en: s, pages: [...ctx].length, sample: [...ctx][0] }));
  fs.writeFileSync(path.join(here, 'missing.json'), JSON.stringify(list, null, 1));
  console.error(`Untranslated strings: ${missing.size} (see tools/es-budapest/missing.json)`);
  if (!extractOnly) process.exit(1);
}
if (extractOnly) process.exit(0);
for (const [r, html] of outputs) {
  fs.mkdirSync(path.dirname(esFile(repo, r)), { recursive: true });
  fs.writeFileSync(esFile(repo, r), html);
}
console.log(`Generated ${outputs.length} Spanish Budapest pages.`);

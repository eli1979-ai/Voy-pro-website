#!/usr/bin/env node
/** Read-only HTML-source audit for the legacy WordPress channel. No browser/runtime mutations. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAGES = Object.freeze({
  en: 'https://ezraidereu.com/budapest/',
  hu: 'https://ezraidereu.com/budapest/fooldal/',
  he: 'https://ezraidereu.com/budapest/%D7%91%D7%99%D7%AA/',
});
const ISSUE = (code, severity, detail) => ({ code, severity, detail });

export function auditPage(locale, html, url = PAGES[locale]) {
  const issues = [];
  if (!/<html\b/i.test(html) || /cf-chl-|just a moment|attention required.*cloudflare/i.test(html)) {
    return { locale, url, status: 'inconclusive', issues: [ISSUE('BLOCKED_OR_NON_HTML', 'unknown', 'Response may be a CDN challenge, not the published page.')] };
  }
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)].map(m => m[2].replace(/&amp;/g, '&'));
  const renderedText = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp);/g, ' ');
  const addIf = (condition, code, severity, detail) => { if (condition) issues.push(ISSUE(code, severity, detail)); };
  addIf(/voy\.pro\.eu@gmail\.com/i.test(renderedText) || hrefs.some(x => /voy\.pro\.eu@gmail\.com/i.test(x)), 'OLD_BUDAPEST_EMAIL', 'high', 'Legacy public contact email remains; desired site contact is Voyprobud@gmail.com, not the WP admin email.');
  addIf(hrefs.some(x => /(?:^|\/\/)\s*(?:www\.)?fareharbor\.com\b/i.test(x)) || /fareharbor\.com/i.test(html), 'FAREHARBOR_PRESENT', 'high', 'FareHarbor reference remains. Classify before changing, since live booking cutover is not approved.');
  addIf(/Lisbon|Lisszabon|ליסבון/i.test(renderedText), 'LISBON_STALE', 'medium', 'Lisbon claim found in Budapest content; verify context before removal.');
  addIf(/anyone can join|suitable for all riders|bárki csatlakozhat|minden 16 éven felüli számára|כל אחד יכול להצטרף|מתאים לכל הרוכבים/i.test(renderedText), 'UNIVERSAL_SUITABILITY', 'high', 'Unqualified eligibility/accessibility claim detected.');
  addIf(/ride any path|menjen bármilyen ösvényen|סעו על כל שביל/i.test(renderedText), 'UNRESTRICTED_ROUTE_CLAIM', 'medium', 'Vehicle marketing claim needs distinction from legal tour route permissions.');
  addIf(/Pilvax(?:\s|\+|%20|\x20|&#32;|%2B|%2520)*k/i.test(html), 'LEGACY_MAP_REFERENCE', 'high', 'Map source still references Pilvax köz; verify current official Maps place identity and actual meeting point before replacement.');
  const trusted = ['google.com/maps', 'tripadvisor.', 'getyourguide.'].map(domain => hrefs.some(x => x.includes(domain)));
  addIf(trusted.filter(Boolean).length < 3, 'TRUST_STRIPE_SOURCE_UNCONFIRMED', 'manual', 'All three provider links not confirmed in source anchors; client-side WPCode may add them; inspect actual desktop/mobile DOM.');
  return { locale, url, status: 'audited-source-only', issueCount: issues.length, issues };
}

function selfTest() {
  const dirty = `<html><a href="https://fareharbor.com/example">Book</a><span>voy.pro.eu@gmail.com</span><p>Anyone can join. Tourists in Lisbon.</p><iframe src="https://www.google.com/maps/embed?pb=Pilvax+k%C3%B6z"></iframe></html>`;
  const found = auditPage('en', dirty).issues.map(x => x.code);
  for (const expected of ['OLD_BUDAPEST_EMAIL', 'FAREHARBOR_PRESENT', 'LISBON_STALE', 'UNIVERSAL_SUITABILITY', 'LEGACY_MAP_REFERENCE', 'TRUST_STRIPE_SOURCE_UNCONFIRMED']) assert.ok(found.includes(expected), expected);
  assert.equal(auditPage('he', '<html><p>סעו על כל שביל</p></html>').issues.some(x => x.code === 'UNRESTRICTED_ROUTE_CLAIM'), true);
  assert.equal(auditPage('en', '<html><title>Just a moment...</title></html>').status, 'inconclusive');
  assert.equal(auditPage('hu', '<html><p>Hello</p></html>').issues.some(x => x.code === 'FAREHARBOR_PRESENT'), false);
  console.log('Self-test: 4 cases passed');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const pos = args.indexOf('--fixture-dir');
  const fixtures = pos < 0 ? null : args[pos + 1];
  if (pos >= 0 && (!fixtures || fixtures.startsWith('--'))) throw Error('--fixture-dir requires a path');
  const results = [];
  for (const [locale, url] of Object.entries(PAGES)) {
    try {
      const html = fixtures
        ? await readFile(join(fixtures, `${locale}.html`), 'utf8')
        : await (async () => { const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'EZRaiderEU-SourceAudit/1.0 (+read-only)' } }); if (!response.ok) throw Error(`HTTP ${response.status}`); return response.text(); })();
      results.push(auditPage(locale, html, url));
    } catch (error) {
      results.push({ locale, url, status: 'inconclusive', issues: [ISSUE('FETCH_FAILED', 'unknown', String(error.message))] });
    }
  }
  const output = { generatedAt: new Date().toISOString(), method: 'raw HTML response only; not a rendered browser/JS test', results };
  if (args.includes('--json')) console.log(JSON.stringify(output, null, 2));
  else for (const r of results) console.log(`${r.locale}: ${r.status}\n${r.issues.map(x => `  - ${x.severity}: ${x.code} — ${x.detail}`).join('\n')}`);
  if (results.some(x => x.status === 'inconclusive')) process.exitCode = 2;
  else if (results.some(x => x.issues.some(y => y.severity === 'high'))) process.exitCode = 1;
}

await main();
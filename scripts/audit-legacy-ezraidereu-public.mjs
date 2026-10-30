#!/usr/bin/env node
/** EZRaiderEU: read-only raw-HTML audit. Never mistake a bot challenge for a clean homepage. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAGES = Object.freeze({
  en: 'https://ezraidereu.com/budapest/',
  hu: 'https://ezraidereu.com/budapest/fooldal/',
  he: 'https://ezraidereu.com/budapest/%D7%91%D7%99%D7%AA/',
});
const ISSUE = (code, severity, detail) => ({ code, severity, detail });
// Classic PHP templates can emit quoted or unquoted attributes. Only parse
// actual tag attributes, not arbitrary script strings or data-href lookalikes.
function decodeUrlEntities(value){
 const named={amp:'&',period:'.',colon:':',sol:'/',quot:'"',apos:"'"};
 return String(value).replace(/&(?:#(?:x[0-9a-f]+|[0-9]+);?|(?:amp|period|colon|sol|quot|apos);)/gi,ent=>{
  const code=ent.slice(1,ent.endsWith(';')?-1:undefined);
  if(code[0]==='#'){
   const hex=code[1]?.toLowerCase()==='x';
   const number=Number.parseInt(code.slice(hex?2:1),hex?16:10);
   return Number.isSafeInteger(number)&&number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)
    ?String.fromCodePoint(number):ent;
  }
  return named[code.toLowerCase()]??ent;
 });
}
function extractAttributes(html,tag,attribute){
 const tagPattern=new RegExp('<'+tag+'\\b((?:"[^"]*"|\\x27[^\\x27]*\\x27|[^\\x27">])*)>','gi');
 const attrPattern=new RegExp('(?:^|\\s)'+attribute+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s"\\x27'+String.fromCharCode(96)+'=<>]+))','i');
 const links=[];
 for(const item of html.matchAll(tagPattern)){
  const match=item[1].match(attrPattern);
  if(match)links.push(decodeUrlEntities(match[1]??match[2]??match[3]));
 }
 return links;
}
const withoutNonVisibleTags = html => html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
const visibleText = html => withoutNonVisibleTags(html)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:nbsp|amp|quot|apos);/gi, ' ')
  .replace(/&#(?:x[0-9a-f]+|[0-9]+);/gi, ' ')
  .replace(/\s+/g, ' ').trim();
function isFareHarborUrl(value) {
  // A real browser trims leading ASCII whitespace, interprets explicit ports
  // and accepts the trailing DNS root dot. Check the parsed host, not a
  // fragile literal URL spelling or lookalike domains/userinfo.
  try {
    const url = new URL(String(value), 'https://ezraidereu.com/budapest/');
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return host === 'fareharbor.com' || host.endsWith('.fareharbor.com');
  } catch { return false; }
}
const isLegacyMap = x => /Pilvax(?:\s|\+|%20|&#32;|%2B|%2520)*k(?:öz|oz|%C3%B6z)/i.test(x);

function isPlausibleBudapestHomepage(locale, html, text) {
  // Guard against 200-OK bot walls, skeletal/error pages and accidentally fetched articles.
  if (typeof html !== 'string' || html.length < 1500) return false;
  if (!/<html\b/i.test(html) || !/<body\b/i.test(html) || !/<\/body\s*>/i.test(html)) return false;
  if (/cf-chl-|\/cdn-cgi\/challenge-platform|just a moment|attention required.{0,30}cloudflare|verify you are human|checking your browser|security verification/i.test(html)) return false;
  if (!/(?:budapest|בודפשט)/i.test(text)) return false;
  const navTokens = {en:/(?:tours|ezraider)/i,hu:/(?:túrák|ezraider)/i,he:/(?:סיורים|איזיריידר|ezraider)/i};
  if (!(navTokens[locale] || navTokens.en).test(text)) return false;
  // Site has footer anchors and several actual links. Header text alone is not sufficient.
  return extractAttributes(html, 'a', 'href').length >= 4;
}

export function auditPage(locale, html, url = PAGES[locale]) {
  if (!Object.hasOwn(PAGES, locale)) throw Error('Unknown locale: ' + locale);
  const plain = visibleText(String(html ?? ''));
  if (!isPlausibleBudapestHomepage(locale, html, plain)) {
    return { locale, url, status: 'inconclusive', issueCount: 1,
      issues: [ISSUE('BLOCKED_OR_NON_HOME_HTML', 'unknown', 'Too short, missing homepage structure, unexpected locale, or challenge/error response. Do not treat as clean.')] };
  }
  const htmlNoScripts = withoutNonVisibleTags(html);
  const hrefs = extractAttributes(htmlNoScripts, 'a', 'href');
  const iframes = extractAttributes(htmlNoScripts, 'iframe', 'src');
  const scripts = extractAttributes(html, 'script', 'src');
  const issues = [];
  const addIf = (condition, code, severity, detail) => { if (condition) issues.push(ISSUE(code, severity, detail)); };
  addIf(/voy\.pro\.eu@gmail\.com/i.test(plain) || hrefs.some(x => /voy\.pro\.eu@gmail\.com/i.test(x)),
    'OLD_BUDAPEST_EMAIL', 'high', 'Old Budapest public contact persists in source (client JS changes do not remove source).');
  addIf(hrefs.some(isFareHarborUrl) || iframes.some(isFareHarborUrl) || scripts.some(isFareHarborUrl),
    'FAREHARBOR_PRESENT', 'high', 'Real FareHarbor link, embed, or externally loaded script present. Do not activate FBM replacement without approval.');
  addIf(/Lisbon|Lisszabon|ליסבון/i.test(plain),
    'LISBON_STALE', 'medium', 'Budapest marketing text mentions Lisbon; inspect surrounding context.');
  addIf(/anyone can join|suitable for all riders|bárki csatlakozhat|minden 16 éven felüli számára|כל אחד יכול להצטרף|מתאים לכל הרוכבים/i.test(plain),
    'UNIVERSAL_SUITABILITY', 'high', 'Blanket eligibility/accessibility promise remains.');
  addIf(/ride any path|menjen bármilyen ösvényen|סעו על כל שביל/i.test(plain),
    'UNRESTRICTED_ROUTE_CLAIM', 'medium', 'Unrestricted route promise needs distinction from permitted guided routes.');
  addIf(iframes.some(isLegacyMap) || isLegacyMap(plain),
    'LEGACY_MAP_REFERENCE', 'high', 'Visible Pilvax reference or iframe source: verify business pin and actual guest entrance; do not automatically geocode.');
  const has = {
    maps: hrefs.some(x => /(?:google\.[^/]+\/maps|maps\.app\.goo\.gl)/i.test(x)),
    tripadvisor: hrefs.some(x => /tripadvisor\./i.test(x)),
    getyourguide: hrefs.some(x => /getyourguide\./i.test(x)),
  };
  addIf(Object.values(has).filter(Boolean).length < 3,
    'TRUST_STRIPE_SOURCE_UNCONFIRMED', 'manual', 'Source lacks one or more external trust provider links; WPCode may create these in live JS; inspect the final DOM.');
  return { locale, url, status: 'audited-source-only', issueCount: issues.length, issues };
}

function selfTest() {
  const page = (locale, body, head='') =>
    '<!doctype html><html lang="' + locale + '"><head><title>EZRaider Budapest</title>' + head + '</head><body>' +
    '<nav><a href="#tours">Tours</a><a href="#contact">Contact</a><a href="#about">About</a><a href="#gallery">Gallery</a></nav>' +
    '<main><h1>EZRaider Budapest</h1><h2 id="tours">Túrák סיורים</h2>' + '<p>Budapest guided tours</p>'.repeat(110) + body +
    '</main></body></html>';
  const dirty = page('en', '<a href="https://fareharbor.com/example">Book</a><span>voy.pro.eu@gmail.com</span><p>Anyone can join. Tourists in Lisbon.</p><iframe src="https://www.google.com/maps/embed?pb=Pilvax+k%C3%B6z"></iframe>');
  const found = auditPage('en', dirty).issues.map(x => x.code);
  for (const expected of ['OLD_BUDAPEST_EMAIL', 'FAREHARBOR_PRESENT', 'LISBON_STALE', 'UNIVERSAL_SUITABILITY', 'LEGACY_MAP_REFERENCE', 'TRUST_STRIPE_SOURCE_UNCONFIRMED'])
    assert.ok(found.includes(expected), expected);
  assert.equal(auditPage('he', page('he', '<p>סעו על כל שביל</p>')).issues.some(x => x.code === 'UNRESTRICTED_ROUTE_CLAIM'), true);
  assert.equal(auditPage('en', '<html><p>Just a moment...</p></html>').status, 'inconclusive');
  assert.equal(auditPage('hu', '<html><p>Hello</p></html>').status, 'inconclusive');
  assert.equal(auditPage('en', page('en', '<p>Budapest</p>','<script>var diagnostic="fareharbor.com Pilvax+k%C3%B6z";</script>')).issues.some(x => ['FAREHARBOR_PRESENT','LEGACY_MAP_REFERENCE'].includes(x.code)), false);
  assert.equal(auditPage('en', page('en','<a href="https://fareharbor.com/embeds/book/">Book now</a>')).issues.some(x => x.code === 'FAREHARBOR_PRESENT'), true);
  assert.equal(auditPage('en', '<html><head></head><body>'+'Budapest tours '.repeat(500)+'</body></html>').status, 'inconclusive');
  assert.equal(auditPage('en', page('en','<p>Tour information</p>').replace('Budapest','Berlin').replace(/Budapest guided tours/g,'Berlin guided tours').replace('EZRaider Budapest','EZRaider Berlin')).status, 'inconclusive');
  for(const html of [
   '<a href=//fareharbor.com/embeds/book/ezraidereu/>Book</a>',
   '<iframe src=https://fareharbor.com/embeds/book/ezraidereu/>',
   '<script src=https://fareharbor.com/embeds/book/ezraidereu.js></script>',
   '<a href="https://fareharbor&#46;com/embeds/book/ezraidereu/">Book</a>',
   '<a href="https://fareharbor&#46com/embeds/book/ezraidereu/">Book</a>',
   '<a href="   https://fareharbor.com/embeds/book/ezraidereu/">Book</a>',
   '<a href="https://fareharbor.com:443/embeds/book/ezraidereu/">Book</a>',
   '<a href="https://booking.fareharbor.com./embeds/book/ezraidereu/">Book</a>'
  ]) {
   assert.equal(auditPage('en',page('en',html)).issues.some(x=>x.code==='FAREHARBOR_PRESENT'),true,'unsafe source link not detected');
  }
  for(const lookalike of [
    'https://fareharbor.com@evil.example/checkout',
    'https://fareharbor.com.evil.example/checkout',
    'https://fakefareharbor.com/checkout'
  ]) {
    assert.equal(auditPage('en',page('en','<a href="'+lookalike+'">External link</a>'))
      .issues.some(x=>x.code==='FAREHARBOR_PRESENT'),false,'false positive for '+lookalike);
  }
  assert.equal(auditPage('en',page('en','<a data-href="https://fareharbor.com/" href="/budapest/">Info</a>')).issues.some(x=>x.code==='FAREHARBOR_PRESENT'),false);
  assert.equal(auditPage('en',page('en','<a data-label="x > y" href=//fareharbor.com/embeds/book/>Book</a>')).issues.some(x=>x.code==='FAREHARBOR_PRESENT'),true);
  console.log('Self-test: 21 cases passed, including browser-normalized FareHarbor URLs and lookalike-host guards');
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
        ? await readFile(join(fixtures, locale + '.html'), 'utf8')
        : await (async () => {
            const response = await fetch(url, { signal: AbortSignal.timeout(15000),
              headers: { 'user-agent': 'EZRaiderEU-SourceAudit/2.0 (+read-only)' } });
            if (!response.ok) throw Error('HTTP ' + response.status);
            const type = response.headers.get('content-type') || '';
            if (!/text\/html/i.test(type)) throw Error('Not HTML: ' + type);
            return response.text();
          })();
      results.push(auditPage(locale, html, url));
    } catch (error) {
      results.push({ locale, url, status: 'inconclusive',
        issues: [ISSUE('FETCH_FAILED', 'unknown', String(error.message))] });
    }
  }
  const output = { generatedAt: new Date().toISOString(), method: 'raw HTML only; no JS-rendered DOM, booking or map certification', results };
  if (args.includes('--json')) console.log(JSON.stringify(output, null, 2));
  else for (const r of results) console.log(r.locale + ': ' + r.status + '\n' + r.issues.map(x => '  - ' + x.severity + ': ' + x.code + ' — ' + x.detail).join('\n'));
  if (results.some(x => x.status === 'inconclusive')) process.exitCode = 2;
  else if (results.some(x => x.issues.some(y => y.severity === 'high'))) process.exitCode = 1;
}

await main();

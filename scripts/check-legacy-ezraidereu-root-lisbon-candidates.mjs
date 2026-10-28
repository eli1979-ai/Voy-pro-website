#!/usr/bin/env node
/**
 * Source-only safety validation for two *uninstalled* legacy EZRaiderEU HTML
 * landing candidates. It never calls a production site or booking service.
 * No new dependencies, config or npm scripts.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../docs/legacy-wordpress/ezraidereu-root-safe-landing-candidate.html',import.meta.url),'utf8');
const lisbon=readFileSync(new URL('../docs/legacy-wordpress/ezraidereu-lisbon-no-booking-candidate.html',import.meta.url),'utf8');
const allowed=new Set([
  'https://ezraidereu.com/',
  'https://ezraidereu.com/budapest/'
]);
const hasHtml=s=>/<!doctype html>/i.test(s)&&/<html\s+lang=["']en["']/i.test(s)&&/<main\b/i.test(s)&&/<\/body>/i.test(s);
const anchors=s=>[...s.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)].map(m=>m[2].replace(/&amp;/g,'&'));
function issues(s,kind) {
  const problems=[];
  const issue=(condition,code)=>{if(condition)problems.push(code)};
  issue(!hasHtml(s),'NOT_COMPLETE_SEMANTIC_HTML');
  issue(!/<meta\s+name="viewport"/i.test(s),'MISSING_MOBILE_VIEWPORT');
  issue(!/<link\s+rel="canonical"\s+href="https:\/\/ezraidereu\.com\/(?:lisbon\/)?"/i.test(s),'MISSING_EXACT_CANONICAL');
  issue(/<script\b|<iframe\b|<form\b|<input\b|on(?:click|load|error)\s*=/i.test(s),'UNREVIEWED_ACTIVE_EMBEDS_OR_FORM');
  issue(/fareharbor\.com|\/checkout\b|buy (?:a )?ticket|book now|pay now/i.test(s),'BOOKING_LINK_OR_CTA_PRESENT');
  issue(/https?:\/\/athen\.ezraidereu\.com/i.test(s),'ATHENS_BOOKING_DESTINATION');
  issue(/<a\b[^>]*\btarget\s*=\s*["']_blank/i.test(s),'UNGUARDED_NEW_TAB');
  for(const href of anchors(s)) {
    if(kind==='root' && href.startsWith('https://wa.me/36300993099?text=')) continue;
    if(!allowed.has(href)) issue(true,'UNREVIEWED_DESTINATION:'+href);
  }
  if(kind==='root') {
    issue(/lisbon|lisabon|lissabon|athens|athén/i.test(s),'STALE_DESTINATION_IN_ROOT');
    issue(!s.includes('https://ezraidereu.com/budapest/'),'MISSING_BUDAPEST');
    issue(!anchors(s).some(x=>x.startsWith('https://wa.me/36300993099?text=')),'MISSING_WHATSAPP_ENQUIRY');
    issue(!/<h1>/.test(s),'MISSING_HEADING');
  } else if(kind==='lisbon') {
    issue(!/Lisbon tours are not currently offered for new bookings through this website/i.test(s),'MISSING_CLOSED_TO_NEW_BOOKING_NOTICE');
    issue(!/This notice does not cancel an existing reservation/i.test(s),'MISSING_EXISTING_BOOKING_SAFEGUARD');
    issue(/€\s*\d|\d+\s*€|R\.\s*Castilho|fareharbor/i.test(s),'STALE_PRICE_ADDRESS_OR_PROVIDER');
    issue(/<meta\s+name=["']robots["']/i.test(s),'UNREVIEWED_ROBOTS_INDEXING_CHANGE');
  }
  return [...new Set(problems)];
}
function selfTest(){
  assert.deepEqual(issues(root,'root'),[]);
  assert.deepEqual(issues(lisbon,'lisbon'),[]);
  const samples=[
    ['root Lisbon',root.replace('Explore Budapest tours','Lisbon Check out'), 'STALE_DESTINATION_IN_ROOT','root'],
    ['root Athens',root.replace('</main>','<a href="https://athen.ezraidereu.com/">Athens</a></main>'),'ATHENS_BOOKING_DESTINATION','root'],
    ['root unsafe checkout',root.replace('</main>','<a href="https://fareharbor.com/old">Book now</a></main>'),'BOOKING_LINK_OR_CTA_PRESENT','root'],
    ['Lisbon raw fareharbor',lisbon.replace('</main>','<a href="https://fareharbor.com/old">Book now</a></main>'),'BOOKING_LINK_OR_CTA_PRESENT','lisbon'],
    ['Lisbon old price',lisbon.replace('</main>','<p>€60</p></main>'),'STALE_PRICE_ADDRESS_OR_PROVIDER','lisbon'],
    ['Lisbon fake cancellation',lisbon.replace('This notice does not cancel an existing reservation','Old bookings are cancelled'),'MISSING_EXISTING_BOOKING_SAFEGUARD','lisbon'],
    ['Lisbon hidden form',lisbon.replace('</main>','<form><input></form></main>'),'UNREVIEWED_ACTIVE_EMBEDS_OR_FORM','lisbon'],
    ['root unreviewed external link',root.replace('</main>','<a href="https://third-party.example/">External</a></main>'),'UNREVIEWED_DESTINATION:https://third-party.example/','root'],
  ];
  for(const [label,html,expected,kind] of samples)assert.ok(issues(html,kind).includes(expected),label+': missing '+expected);
  console.log('PASS: 10 static candidate safety scenarios (2 valid, 8 intentionally invalid)');
}
if(process.argv.includes('--self-test'))selfTest();
else{
  const a=issues(root,'root'),b=issues(lisbon,'lisbon');
  console.log(JSON.stringify({root:a,lisbon:b},null,2));
  if(a.length||b.length)process.exitCode=1;
}

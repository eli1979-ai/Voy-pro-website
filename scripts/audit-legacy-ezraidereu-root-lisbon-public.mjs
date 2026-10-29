#!/usr/bin/env node
/**
 * Read-only public-source audit for the old EZRaiderEU root and Lisbon URLs.
 * Does not execute page scripts or make bookings. A CDN challenge is inconclusive.
 * Runs online only when invoked without --fixture-dir; never installed in CI.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const pages={
  root:'https://ezraidereu.com/',
  lisbon:'https://ezraidereu.com/lisbon/'
};
const strip=s=>String(s).replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
const plain=s=>strip(s).replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp);/gi,' ').replace(/\s+/g,' ').trim();
// Accept valid quoted and unquoted HTML attributes, including protocol-relative
// URLs. This is a source-level audit, not a DOM parser or runtime checkout test.
const attrs=(s,tag,key)=>[...String(s).matchAll(
 new RegExp('<'+tag+'\\b[^>]*?\\b'+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s"\\x27=<>`]+))','gi')
)].map(m=>(m[1]??m[2]??m[3]??'').replace(/&amp;/gi,'&'));
const hrefs=s=>attrs(strip(s),'a','href');
const fareharbor=x=>/^(?:https?:)?//(?:[^/?#]+.)?fareharbor.com(?:[/?#]|$)/i.test(String(x).trim());
const issue=(code,severity,detail)=>({code,severity,detail});
export function auditLegacyPage(kind,html,url=pages[kind]){
  if(!(kind in pages))throw Error('Unknown page type');
  const body=plain(html),source=String(html??'');
  const ready=source.length>800&&/<html\b/i.test(source)&&/<body\b/i.test(source)&&/<\/body\s*>/i.test(source)
    &&/<h1\b/i.test(source)&&hrefs(source).length>=2
    &&!/cf-chl-|\/cdn-cgi\/challenge-platform|just a moment|checking your browser|verify you are human/i.test(source);
  if(!ready)return {kind,url,status:'inconclusive',issues:[issue('CHALLENGE_OR_SHORT_HTML','unknown','Not a substantive complete page; do not certify public state.')]};
  const links=hrefs(source),issues=[];
  if(kind==='root'){
    if(/Lisbon|Lisabon|Athén|Athens/i.test(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??''))
      issues.push(issue('STALE_ROOT_TITLE','medium','Root title still advertises inactive or unverified destinations.'));
    const destinationHeadings=[...strip(source).matchAll(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/gi)]
      .map(m=>m[1].replace(/<[^>]*>/g,' ').trim());
    if(links.some(x=>/(?:\/lisbon(?:\/|\?|#|$)|athen\.ezraidereu\.com)/i.test(x))
      ||/Lisbon\s+Check\s*out|VoyproAth[eé]n\s+Check\s*out/i.test(body)
      ||destinationHeadings.some(x=>/\b(?:Lisbon|Lisabon|Lisboa|Athens|Athén)\b/i.test(x)))
      issues.push(issue('LEGACY_DESTINATION_CTA','high','Root still has Lisbon or Athens destination marketing.'));
    if(!links.some(x=>/ezraidereu\.com\/budapest\/?$/i.test(x)))
      issues.push(issue('BUDAPEST_DESTINATION_NOT_CONFIRMED','medium','Cannot find known Budapest destination link.'));
  }else{
    if(links.some(fareharbor))
      issues.push(issue('LISBON_FAREHARBOR_LINK','high','FareHarbor link in HTML; live checkout availability not confirmed.'));
    const embeds=[...attrs(source,'iframe','src'),...attrs(source,'script','src'),
      ...attrs(source,'form','action')];
    if(embeds.some(fareharbor))
      issues.push(issue('LISBON_FAREHARBOR_EMBED','high','FareHarbor iframe, external script or form action remains in HTML source.'));
    if(/<[^>]+\b(?:data-fareharbor(?:-[\w-]+)?|data-fh-(?:item|calendar|company))\s*=/i.test(source))
      issues.push(issue('LISBON_BOOKING_WIDGET_ATTRIBUTE','high','FareHarbor/widget-related data attribute remains; do not certify checkout disabled.'));
    const visibleButtons=[...strip(source).matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)]
      .map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
    if(visibleButtons.some(x=>/^(?:book now|book a tour|reserve now|buy tickets)$/i.test(x)))
      issues.push(issue('LISBON_BOOKING_BUTTON','high','Visible booking button remains; not proof of provider purchasability.'));
    if(/<script\b[^>]*>[\s\S]*?fareharbor\S*[\s\S]*?<\/script>/i.test(source))
      issues.push(issue('LISBON_INLINE_FAREHARBOR_REFERENCE','manual','Inline script references FareHarbor; inspect runtime usage before claiming sale path removed.'));
    if(/(?:€\s*\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\s*(?:euros?|€)\b)/i.test(body))
      issues.push(issue('LISBON_LEGACY_FARES','medium','Historical Lisbon published tour prices visible.'));
    if(!/not currently offered for new bookings/i.test(body))
      issues.push(issue('LISBON_NO_NEW_BOOKINGS_NOTICE_UNCONFIRMED','manual','No explicit non-bookable status notice detected.'));
  }
  return {kind,url,status:issues.length?'risk-present':'source-clean',issueCount:issues.length,issues};
}
function selfTest(){
  const rootOld='<!doctype html><html><head><title>EZRaider tours Budapest Lisbon Athén</title></head><body><h1>Choose Destination</h1>'
    +'<a href="https://ezraidereu.com/budapest">Budapest Check out</a><a href="https://ezraidereu.com/lisbon">Lisbon Check out</a>'
    +'<a href="https://athen.ezraidereu.com/">VoyproAthén Check out</a>'+'Enjoy your trip in Europe! '.repeat(70)+'</body></html>';
  const lisbonOld='<!doctype html><html><head><title>Lisbon tours</title></head><body><h1>Lisbon Tours</h1>'
    +'<a href="https://fareharbor.com/old">Book Now</a><a href="https://ezraidereu.com/">Home</a>'
    +'Short tour 40 euros, full tour 60 euros, extended 80 euros. '.repeat(50)+'</body></html>';
  assert.equal(auditLegacyPage('root',rootOld).status,'risk-present');
  assert.ok(auditLegacyPage('root',rootOld).issues.some(x=>x.code==='LEGACY_DESTINATION_CTA'));
  assert.equal(auditLegacyPage('lisbon',lisbonOld).status,'risk-present');
  assert.ok(auditLegacyPage('lisbon',lisbonOld).issues.some(x=>x.code==='LISBON_FAREHARBOR_LINK'));
  assert.equal(auditLegacyPage('root','<html>Just a moment...</html>').status,'inconclusive');
  assert.equal(auditLegacyPage('lisbon','<html>Bad Gateway</html>').status,'inconclusive');
  const cleanRoot=rootOld.replace(/<title>[\s\S]*?<\/title>/,'<title>Budapest tours</title>')
    .replace(/<a href="https:\/\/ezraidereu\.com\/lisbon">Lisbon Check out<\/a>/,'')
    .replace(/<a href="https:\/\/athen\.ezraidereu\.com\/">VoyproAthén Check out<\/a>/,'');
  assert.equal(auditLegacyPage('root',cleanRoot).status,'inconclusive'); // only one destination anchor: fail closed
  const rootReady=cleanRoot.replace('</body>','<a href="https://ezraidereu.com/">Home</a></body>');
  assert.equal(auditLegacyPage('root',rootReady).status,'source-clean');
  const safeLisbon=lisbonOld.replace('<a href="https://fareharbor.com/old">Book Now</a>',
      '<a href="https://ezraidereu.com/budapest/">Budapest</a>')
    .replace(/Short tour 40 euros, full tour 60 euros, extended 80 euros\./g,
      'Lisbon tours are not currently offered for new bookings through this website.');
  assert.equal(auditLegacyPage('lisbon',safeLisbon).status,'source-clean');
  const bookingCases=[
    ['iframe','<iframe src="https://fareharbor.com/embeds/book"></iframe>','LISBON_FAREHARBOR_EMBED'],
    ['external script','<script src="https://fareharbor.com/embeds/api.js"></script>','LISBON_FAREHARBOR_EMBED'],
    ['form action','<form action="https://fareharbor.com/checkout"></form>','LISBON_FAREHARBOR_EMBED'],
    ['widget attribute','<div data-fareharbor-company="legacy"></div>','LISBON_BOOKING_WIDGET_ATTRIBUTE'],
    ['booking button','<button type="button">Book Now</button>','LISBON_BOOKING_BUTTON'],
    ['inline mention','<script>console.log("fareharbor.com")</script>','LISBON_INLINE_FAREHARBOR_REFERENCE'],
    ['changed price','<p>New promotional price: €55.</p>','LISBON_LEGACY_FARES'],
    ['protocol-relative anchor','<a href="//fareharbor.com/book/">Reserve</a>','LISBON_FAREHARBOR_LINK'],
    ['protocol-relative iframe','<iframe src="//fareharbor.com/embeds/book"></iframe>','LISBON_FAREHARBOR_EMBED'],
    ['unquoted anchor','<a href=https://fareharbor.com/book>Reserve</a>','LISBON_FAREHARBOR_LINK'],
    ['unquoted iframe','<iframe src=https://fareharbor.com/embeds/book></iframe>','LISBON_FAREHARBOR_EMBED'],
    ['unquoted form','<form action=https://fareharbor.com/book></form>','LISBON_FAREHARBOR_EMBED'],
  ];
  for(const [label,markup,expected] of bookingCases){
    const fixture=safeLisbon.replace('</main>','</main>'); // long, complete fixture
    const injected=fixture.replace('</body>',markup+'</body>');
    assert.ok(auditLegacyPage('lisbon',injected).issues.some(x=>x.code===expected),label+' misses '+expected);
  }
  const headedRoot=rootReady.replace('</body>','<h2>Lisboa — new tours!</h2></body>');
  assert.ok(auditLegacyPage('root',headedRoot).issues.some(x=>x.code==='LEGACY_DESTINATION_CTA'));
  const unquotedLisbon=rootReady.replace('</body>','<a href=/lisbon/>Lisbon destination</a></body>');
  assert.ok(auditLegacyPage('root',unquotedLisbon).issues.some(x=>x.code==='LEGACY_DESTINATION_CTA'));
  console.log('PASS: 23 read-only public source audit scenarios (17 previous + 6 overlooked HTML link forms)');
}
async function main(){
  if(process.argv.includes('--self-test')){selfTest();return;}
  const arg=process.argv.indexOf('--fixture-dir'),base=arg>=0?process.argv[arg+1]:null;
  if(arg>=0&&(!base||base.startsWith('--')))throw Error('--fixture-dir requires a directory');
  const results=[];
  for(const [kind,url] of Object.entries(pages)){
    try{
      const content=base?await readFile(join(base,kind+'.html'),'utf8'):await (async()=>{
        const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'user-agent':'EZRaiderEU-ReadOnlySourceAudit/1.0'}});
        if(!response.ok)throw Error('HTTP '+response.status);
        const finalURL=new URL(response.url),expectedURL=new URL(url);
        if(finalURL.origin!==expectedURL.origin
          ||finalURL.pathname.replace(/\/+$/,'/')!==expectedURL.pathname.replace(/\/+$/,'/'))
          throw Error('Unexpected final URL after redirect: '+finalURL.origin+finalURL.pathname);
        if(!/text\/html/i.test(response.headers.get('content-type')??''))throw Error('Not HTML');
        return response.text();
      })();
      results.push(auditLegacyPage(kind,content,url));
    }catch(e){results.push({kind,url,status:'inconclusive',issues:[issue('FETCH_FAILED','unknown',e.message)]});}
  }
  console.log(JSON.stringify({method:'raw HTML only; no JavaScript execution or booking validation',results},null,2));
  if(results.some(r=>r.status==='inconclusive'))process.exitCode=2;
  else if(results.some(r=>r.issues?.some(i=>i.severity==='high')))process.exitCode=1;
}
await main();

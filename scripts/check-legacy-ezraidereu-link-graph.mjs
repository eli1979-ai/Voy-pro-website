#!/usr/bin/env node
/**
 * EZRaiderEU classic WordPress stored-content QA (21 tours + 12 editorial).
 * READ ONLY. Requires explicitly supplied, PRIVATE WP REST content snapshot.
 * Never uploads content; no network or WordPress writes. Do not commit snapshots.
 *
 * node scripts/check-legacy-ezraidereu-link-graph.mjs --self-test
 * node scripts/check-legacy-ezraidereu-link-graph.mjs --input /private/wp-content-snapshot.json
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../docs/legacy-wordpress/ezraidereu-published-link-contract-20261028.json',import.meta.url),'utf8'));
const origin=manifest.site;
function canonical(url,base=origin+'/budapest/'){
  try{
    const u=new URL(String(url).replace(/&amp;/gi,'&'),base);
    if(u.hostname!=='ezraidereu.com'&&u.hostname!=='www.ezraidereu.com')return null;
    return decodeURIComponent(u.pathname).replace(/\/+$/,'')+'/';
  }catch(_){return 'MALFORMED';}
}
const expected=new Map(),groups=new Map();
for(const family of manifest.families){
  const paths={};
  for(const locale of ['en','hu','he']){
    const entry=family[locale],path='/budapest/tours/'+entry.slug+'/';
    const c=canonical(path);
    assert.ok(!expected.has(c),'duplicate tour permalink');
    expected.set(c,{...entry,path:c,type:'tour',locale,family:family.family});
    paths[locale]=c;
  }
  groups.set(family.family,paths);
}
for(const e of manifest.editorial){
  const c=canonical('/budapest/'+e.slug+'/');
  assert.ok(!expected.has(c),'duplicate editorial permalink');
  expected.set(c,{...e,path:c,type:e.type,locale:e.locale});
}
for(const [locale,path] of Object.entries(manifest.homes)){
  const c=canonical(path);
  assert.ok(!expected.has(c),'duplicate homepage permalink');
  expected.set(c,{id:({en:7,hu:90,he:92})[locale],path:c,type:'home',locale});
}
assert.equal(manifest.families.length,7);
assert.equal(manifest.editorial.length,12);
assert.equal([...expected.values()].filter(x=>x.type==='tour').length,21);

function contentString(r){
  if(typeof r.content==='string')return r.content;
  return r.content?.raw??r.content?.rendered??'';
}
// Conservative HTML-attribute reader: classic WP content can use quoted or
// unquoted hrefs. An entity-obfuscated booking link is still a real link.
// No DOM, network access, or executable HTML is involved.
function decodeHref(value){
  const named={amp:'&',quot:'"',apos:"'",colon:':',sol:'/',tab:'\t',newline:'\n',period:'.'};
  return String(value).replace(/&(?:#(?:x[0-9a-f]+|[0-9]+);?|(?:amp|quot|apos|colon|sol|tab|newline|period);)/gi,entity=>{
    const code=entity.slice(1,entity.endsWith(';')?-1:undefined);
    if(code.startsWith('#')){
      const hex=code[1]?.toLowerCase()==='x';
      const number=Number.parseInt(code.slice(hex?2:1),hex?16:10);
      return Number.isFinite(number)&&number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)
        ?String.fromCodePoint(number):entity;
    }
    return named[code.toLowerCase()]??entity;
  });
}
function hrefsOf(html){
  const links=[];
  // Recognize '>' inside quoted attributes rather than prematurely ending a tag.
  const tags=/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  for(const tag of html.matchAll(tags)){
    const attrs=tag[1];
    const href=attrs.match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i);
    if(href)links.push(decodeHref(href[1]??href[2]??href[3]));
    else if(/(?:^|\s)href\s*=/i.test(attrs))links.push('MALFORMED');
  }
  return links;
}
function isFareHarborHref(href,base){
  try{
    const host=new URL(href,base).hostname.toLowerCase().replace(/\.+$/,'');
    return host==='fareharbor.com'||host.endsWith('.fareharbor.com');
  }catch{return false;}
}
function fullyDecoded(value){
  let v=String(value).replace(/\+/g,' ');
  for(let i=0;i<3;i++){
    let next;
    try{next=decodeURIComponent(v)}catch(_){break}
    if(next===v)break;
    v=next;
  }
  return v.normalize('NFC');
}
function whatsappSourceMatches(waUrl,pagePath){
  const match=waUrl.match(/[?&]text=([^&#]*)/i);
  if(!match)return false;
  const text=fullyDecoded(match[1]);
  // Source attribution is a stable path, not locale-dependent label text.
  return text.includes('https://ezraidereu.com'+pagePath);
}
export function auditRecord(r){
  const errors=[],flags=[],html=contentString(r),url=r.link??r.url,permalink=canonical(url);
  const item=expected.get(permalink);
  if(!item)errors.push('UNEXPECTED_PERMALINK');
  if(!item||item.id!==r.id)errors.push('UNEXPECTED_ID');
  if(r.status!=='publish')errors.push('NOT_PUBLISHED');
  if(html.length<100)errors.push('MISSING_BODY');
  const anchors=hrefsOf(html);
  for(const href of anchors){
    if(href==='MALFORMED')errors.push('MALFORMED_ANCHOR_HREF');
    // Browsers ignore ASCII controls/whitespace in URL schemes. Check after
    // entity-decoding so java&#x73;cript&colon; cannot bypass the audit.
    const normalized=href.trim().replace(/[\u0000-\u0020]+/g,'');
    if(/^(?:javascript|vbscript|data|file):/i.test(normalized))errors.push('UNSAFE_ANCHOR_SCHEME');
    if(/^http:\/\//i.test(normalized))errors.push('INSECURE_HTTP_ANCHOR');
  }
  const local=anchors.map(x=>canonical(x,url)).filter(x=>x!==null);
  for(const ref of local)if(ref==='MALFORMED'||!expected.has(ref))errors.push('UNKNOWN_INTERNAL_LINK:'+ref);
  const mail=anchors.filter(x=>/^mailto:/i.test(x));
  if(!mail.some(x=>/^mailto:Voyprobud@gmail\.com(?:\?|$)/i.test(x)))errors.push('PUBLIC_BUDAPEST_EMAIL_MISSING');
  if(/voy\.pro\.eu@gmail\.com/i.test(html))errors.push('STALE_EMAIL');
  if(/fareharbor\.com/i.test(html)||anchors.some(href=>isFareHarborHref(href,url)))
    errors.push('FAREHARBOR_IN_STORED_CONTENT');
  const wa=anchors.filter(x=>/^https:\/\/wa\.me\/36300993099(?:[?#]|$)/i.test(x));
  if(wa.length!==1)errors.push('EXPECTED_ONE_CORRECT_WHATSAPP_LINK');
  // One valid link must not conceal another live booking/contact link
  // with a stale number or a different WhatsApp endpoint.
  const whatsappDestinations=anchors.filter(href=>{
    try{
      const target=new URL(href,url);
      const host=target.hostname.toLowerCase().replace(/\.+$/,'');
      return host==='wa.me'||host==='www.wa.me'||
        ((host==='api.whatsapp.com'||host==='web.whatsapp.com')&&
          /^\/send(?:\/|$)/i.test(target.pathname));
    }catch{return false}
  });
  if(whatsappDestinations.length!==wa.length)errors.push('UNEXPECTED_WHATSAPP_DESTINATION');
  if(wa.length===1 && !whatsappSourceMatches(wa[0],permalink))
    errors.push('WHATSAPP_SOURCE_ATTRIBUTION_MISMATCH');
  if(item?.type==='tour'){
    if(!html.includes('<!--more-->')||!html.includes('ezre-tour-long-copy'))errors.push('TOUR_LONG_COPY_MARKER_MISSING');
    const family=groups.get(item.family);
    for(const locale of ['en','hu','he']){
      if(locale===item.locale)continue;
      if(local.filter(x=>x===family[locale]).length!==1)errors.push('TOUR_TRANSLATION_LINK_MISSING_OR_DUPLICATE:'+locale);
    }
    if(local.filter(x=>x===item.path).length)flags.push('SELF_LINK_PRESENT');
  }
  return {id:r.id,type:item?.type??'unknown',locale:item?.locale??'unknown',path:permalink,errors:[...new Set(errors)],flags};
}
export function auditSnapshot(snapshot){
  const records=Array.isArray(snapshot)?snapshot:snapshot?.records;
  if(!Array.isArray(records))throw Error('Snapshot must be an array or {records:[...]}');
  const outcomes=records.map(auditRecord),seen=new Set(),duplicates=[];
  for(const x of outcomes){const k=x.path;if(seen.has(k))duplicates.push(k);seen.add(k);}
  const required=[...expected.values()].filter(x=>x.type!=='home');
  const missing=required.filter(x=>!seen.has(x.path)).map(x=>({id:x.id,path:x.path,type:x.type}));
  const extras=outcomes.filter(x=>x.type==='home'||x.type==='unknown')
    .map(x=>({id:x.id,path:x.path,type:x.type}));
  const problems=outcomes.filter(x=>x.errors.length);
  const wrongCount=records.length!==required.length;
  return {status:missing.length||extras.length||duplicates.length||problems.length||wrongCount?'fail':'pass',received:records.length,
    expected:required.length,missing,extras,duplicates,problems,
    flags:outcomes.filter(x=>x.flags.length).map(x=>({id:x.id,flags:x.flags}))};
}
function selfTest(){
  const records=[...expected.values()].filter(x=>x.type!=='home').map(item=>{
    const translations=item.type==='tour'
      ?Object.entries(groups.get(item.family)).filter(([locale])=>locale!==item.locale)
        .map(([,p])=>'<a href="'+origin+encodeURI(p)+'">Translation</a>').join(''):'';
    const related=item.type==='tour'?'':'<a href="'+origin+'/budapest/tours/buda-castle-tour/">Tour</a>';
    return {id:item.id,status:'publish',link:origin+encodeURI(item.path),
      content:'<p>Guided EZRaider Budapest tour information.</p>'+translations+related+
        '<a href="https://wa.me/36300993099?text='+encodeURIComponent('Budapest source: '+origin+item.path)+'">WhatsApp</a>'+
        '<a href="mailto:Voyprobud@gmail.com">Email</a>'+
        (item.type==='tour'?'<!--more--><section class="ezre-tour-long-copy">Further tour information</section>':'')};
  });
  const ok=auditSnapshot(records);
  assert.equal(ok.status,'pass',JSON.stringify(ok));
  assert.equal(ok.expected,33);
  assert.equal(ok.received,33);
  const mutate=(id,transform)=>records.map(x=>x.id===id?transform({...x}):x);
  const tests=[
    {name:'missing translation',list:mutate(38,x=>({...x,content:x.content.replace(/<a href="https:\/\/ezraidereu\.com\/budapest\/tours\/budavari-tura\/">Translation<\/a>/,'')})),error:'TOUR_TRANSLATION_LINK_MISSING_OR_DUPLICATE:hu'},
    {name:'stale email',list:mutate(49,x=>({...x,content:x.content+' voy.pro.eu@gmail.com'})),error:'STALE_EMAIL'},
    {name:'fareharbor',list:mutate(390,x=>({...x,content:x.content+' <a href="https://fareharbor.com/old">Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
    {name:'broken tour internal link',list:mutate(43,x=>({...x,content:x.content+' <a href="/budapest/tours/does-not-exist/">Bad</a>'})),error:'UNKNOWN_INTERNAL_LINK:/budapest/tours/does-not-exist/'},
    {name:'missing long copy',list:mutate(45,x=>({...x,content:x.content.replace('<!--more-->','')})),error:'TOUR_LONG_COPY_MARKER_MISSING'},
    {name:'unexpected WhatsApp number',list:mutate(44,x=>({...x,content:x.content.replace('wa.me/36300993099','wa.me/36000000000')})),error:'EXPECTED_ONE_CORRECT_WHATSAPP_LINK'},
    {name:'WhatsApp wrong source page',list:mutate(38,x=>({...x,content:x.content.replace(encodeURIComponent('Budapest source: '+origin+'/budapest/tours/buda-castle-tour/'),encodeURIComponent('Budapest source: '+origin+'/budapest/tours/night-tour/'))})),error:'WHATSAPP_SOURCE_ATTRIBUTION_MISMATCH'},
    {name:'extra WhatsApp wrong number',list:mutate(49,x=>({...x,content:x.content+' <a href="https://wa.me/36000000000">Wrong extra booking contact</a>'})),error:'UNEXPECTED_WHATSAPP_DESTINATION'},
    {name:'extra legacy api WhatsApp send',list:mutate(49,x=>({...x,content:x.content+' <a href="https://api.whatsapp.com/send?phone=36000000000">Wrong extra contact</a>'})),error:'UNEXPECTED_WHATSAPP_DESTINATION'},
    {name:'additional insecure wa.me link',list:mutate(49,x=>({...x,content:x.content+' <a href="http://wa.me/36300993099?text=bad">Wrong scheme</a>'})),error:'UNEXPECTED_WHATSAPP_DESTINATION'},
    {name:'unsafe JavaScript link',list:mutate(49,x=>({...x,content:x.content+' <a href="javascript:alert(1)">Unsafe</a>'})),error:'UNSAFE_ANCHOR_SCHEME'},
    {name:'insecure HTTP link',list:mutate(390,x=>({...x,content:x.content+' <a href="http://ezraidereu.com/budapest/tours/buda-castle-tour/">HTTP</a>'})),error:'INSECURE_HTTP_ANCHOR'},

    {name:'unquoted unsafe scheme',list:mutate(49,x=>({...x,content:x.content+' <a href=javascript:alert(1)>Unsafe</a>'})),error:'UNSAFE_ANCHOR_SCHEME'},
    {name:'entity-encoded unsafe scheme',list:mutate(49,x=>({...x,content:x.content+' <a href="java&#x73;cript&colon;alert(1)">Unsafe</a>'})),error:'UNSAFE_ANCHOR_SCHEME'},
    {name:'unquoted insecure URL',list:mutate(390,x=>({...x,content:x.content+' <a href=http://ezraidereu.com/budapest/tours/buda-castle-tour/>HTTP</a>'})),error:'INSECURE_HTTP_ANCHOR'},
    {name:'unquoted broken internal URL',list:mutate(43,x=>({...x,content:x.content+' <a href=/budapest/tours/missing-unquoted/>Broken</a>'})),error:'UNKNOWN_INTERNAL_LINK:/budapest/tours/missing-unquoted/'},
    {name:'unquoted FareHarbor link',list:mutate(390,x=>({...x,content:x.content+' <a href=//fareharbor.com/embeds/book/ezraidereu/>Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
    {name:'entity-encoded FareHarbor host',list:mutate(390,x=>({...x,content:x.content+' <a href="https://fareharbor&#46;com/embeds/book/">Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
    {name:'named-period-encoded FareHarbor host',list:mutate(390,x=>({...x,content:x.content+' <a href="https://fareharbor&period;com/embeds/book/">Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
    {name:'unterminated-numeric-period FareHarbor host',list:mutate(390,x=>({...x,content:x.content+' <a href="https://fareharbor&#46com/embeds/book/">Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
    {name:'numeric-period plus DNS trailing root dot',list:mutate(390,x=>({...x,content:x.content+' <a href="https://fareharbor&#46;com./embeds/book/">Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
    {name:'named-period plus subdomain root dot',list:mutate(390,x=>({...x,content:x.content+' <a href="https://booking.fareharbor&period;com./embeds/book/">Book</a>'})),error:'FAREHARBOR_IN_STORED_CONTENT'},
  ];
  for(const t of tests){
    const bad=auditSnapshot(t.list);
    assert.equal(bad.status,'fail',t.name);
    assert.ok(bad.problems.some(x=>x.errors.includes(t.error)),t.name+' missing '+t.error);
  }
  const externalLookalike=mutate(49,x=>({...x,content:x.content+
    ' <a href="https://wa.me.evil.example/36000000000">Unrelated external URL</a>'}));
  assert.equal(auditSnapshot(externalLookalike).status,'pass','lookalike must not trigger WhatsApp host guard');
  const missing=auditSnapshot(records.slice(1));
  assert.equal(missing.status,'fail');
  assert.equal(missing.missing.length,1);
  const dup=auditSnapshot([...records,records[0]]);
  assert.equal(dup.status,'fail');
  assert.equal(dup.duplicates.length,1);
  const extraHome={id:7,status:'publish',link:origin+'/budapest/',
    content:'<p>EZRaider Budapest homepage test, intentionally not in 33-content export</p>'+
      '<a href="https://wa.me/36300993099?text='+encodeURIComponent('Source page: '+origin+'/budapest/')+'">WhatsApp</a>'+
      '<a href="mailto:Voyprobud@gmail.com">Email</a>'};
  assert.deepEqual(auditRecord(extraHome).errors,[],'isolated home record is individually valid');
  const unexpected=auditSnapshot([...records,extraHome]);
  assert.equal(unexpected.status,'fail');
  assert.equal(unexpected.extras.length,1);
  assert.equal(unexpected.received,34);
  console.log('PASS: 27 snapshot scenarios (clean, 22 safety/link regressions, one false-positive guard, missing, duplicate, extra home) on 33 published items');
}
if(process.argv.includes('--self-test'))selfTest();
else {
  const i=process.argv.indexOf('--input');
  if(i<0||!process.argv[i+1]){console.error('Use --self-test or --input /private/snapshot.json');process.exitCode=2;}
  else{
    const report=auditSnapshot(JSON.parse(readFileSync(process.argv[i+1],'utf8')));
    console.log(JSON.stringify(report,null,2));if(report.status!=='pass')process.exitCode=1;
  }
}

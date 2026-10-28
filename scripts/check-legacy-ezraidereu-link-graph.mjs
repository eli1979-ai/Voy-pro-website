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
function hrefsOf(html){
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)].map(m=>m[2].replace(/&amp;/gi,'&'));
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
    if(/^(?:javascript|vbscript|data|file):/i.test(href.trim()))errors.push('UNSAFE_ANCHOR_SCHEME');
    if(/^http:\/\//i.test(href.trim()))errors.push('INSECURE_HTTP_ANCHOR');
  }
  const local=anchors.map(x=>canonical(x,url)).filter(x=>x!==null);
  for(const ref of local)if(ref==='MALFORMED'||!expected.has(ref))errors.push('UNKNOWN_INTERNAL_LINK:'+ref);
  const mail=anchors.filter(x=>/^mailto:/i.test(x));
  if(!mail.some(x=>/^mailto:Voyprobud@gmail\.com(?:\?|$)/i.test(x)))errors.push('PUBLIC_BUDAPEST_EMAIL_MISSING');
  if(/voy\.pro\.eu@gmail\.com/i.test(html))errors.push('STALE_EMAIL');
  if(/fareharbor\.com/i.test(html))errors.push('FAREHARBOR_IN_STORED_CONTENT');
  const wa=anchors.filter(x=>/^https:\/\/wa\.me\/36300993099(?:[?#]|$)/i.test(x));
  if(wa.length!==1)errors.push('EXPECTED_ONE_CORRECT_WHATSAPP_LINK');
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
  const problems=outcomes.filter(x=>x.errors.length);
  return {status:missing.length||duplicates.length||problems.length?'fail':'pass',received:records.length,
    expected:required.length,missing,duplicates,problems,flags:outcomes.filter(x=>x.flags.length).map(x=>({id:x.id,flags:x.flags}))};
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
    {name:'unsafe JavaScript link',list:mutate(49,x=>({...x,content:x.content+' <a href="javascript:alert(1)">Unsafe</a>'})),error:'UNSAFE_ANCHOR_SCHEME'},
    {name:'insecure HTTP link',list:mutate(390,x=>({...x,content:x.content+' <a href="http://ezraidereu.com/budapest/tours/buda-castle-tour/">HTTP</a>'})),error:'INSECURE_HTTP_ANCHOR'},
  ];
  for(const t of tests){
    const bad=auditSnapshot(t.list);
    assert.equal(bad.status,'fail',t.name);
    assert.ok(bad.problems.some(x=>x.errors.includes(t.error)),t.name+' missing '+t.error);
  }
  const missing=auditSnapshot(records.slice(1));
  assert.equal(missing.status,'fail');
  assert.equal(missing.missing.length,1);
  const dup=auditSnapshot([...records,records[0]]);
  assert.equal(dup.status,'fail');
  assert.equal(dup.duplicates.length,1);
  console.log('PASS: 12 snapshot scenarios (clean, nine safety/link regressions, missing, duplicate) on 33 published items');
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

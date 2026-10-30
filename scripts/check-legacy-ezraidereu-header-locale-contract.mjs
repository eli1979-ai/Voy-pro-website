#!/usr/bin/env node
/**
 * Read-only test of stored WordPress translated-tour identities and static
 * language-menu fallback risk; a PHP/Polylang header implementation is not
 * asserted or changed by this script.
 *
 * node scripts/check-legacy-ezraidereu-header-locale-contract.mjs --self-test
 * node scripts/check-legacy-ezraidereu-header-locale-contract.mjs --menus /private/menus.json
 *
 * Menus JSON may be {"data":[...]} or {"items":[...]} or an item array.
 * No customer, authentication, credential or plugin data should be supplied.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL(
 '../docs/legacy-wordpress/ezraidereu-published-link-contract-20261028.json',import.meta.url),'utf8'));
const LANGUAGE_KEYS=['en','hu','he'];
const MAIN_MENUS=Object.freeze({en:2,hu:14,he:15});
function cleanPath(raw){
 const x=String(raw??'').trim();
 if(!x||x.includes('?')||x.includes('#'))return null;
 let url;
 try{url=new URL(x,'https://ezraidereu.com')}catch{return null}
 if(url.origin!=='https://ezraidereu.com'||url.username||url.password)return null;
 const path=url.pathname.replace(/\/+$/,'/');
 try{return decodeURI(path).normalize('NFC')}catch{return null}
}
function buildGraph(contract){
 const problems=[],routes={};
 const families=contract?.families;
 if(!Array.isArray(families)||families.length!==7)return {status:'invalid',problems:['EXPECTED_SEVEN_FAMILIES'],routes:{}};
 const ids=new Set(),paths=new Set();
 for(const group of families){
  if(!group.family||routes[group.family]){problems.push('DUPLICATE_FAMILY');continue}
  const links={};
  for(const lang of LANGUAGE_KEYS){
   const t=group[lang];
   if(!t||!Number.isSafeInteger(t.id)||typeof t.slug!=='string'||!t.slug.trim()||/[/?#]/.test(t.slug)){
    problems.push('MISSING_OR_INVALID_TRANSLATION:'+group.family+':'+lang);continue;
   }
   if(ids.has(t.id))problems.push('DUPLICATE_ID:'+t.id);
   ids.add(t.id);
   const path=cleanPath('https://ezraidereu.com/budapest/tours/'+encodeURIComponent(t.slug)+'/');
   if(!path||paths.has(path))problems.push('INVALID_OR_DUPLICATE_PATH:'+group.family+':'+lang);
   paths.add(path);
   links[lang]={id:t.id,path};
  }
  routes[group.family]=links;
 }
 if(ids.size!==21||paths.size!==21)problems.push('EXPECTED_TWENTY_ONE_UNIQUE_TOURS');
 return {status:problems.length?'invalid':'complete',problems,routes};
}
export function localeLink(contract,sourceId,targetLanguage){
 const g=buildGraph(contract);
 if(g.status!=='complete'||!LANGUAGE_KEYS.includes(targetLanguage))return null;
 for(const [family,items] of Object.entries(g.routes)){
  if(Object.values(items).some(x=>x.id===sourceId))return {
   family,sourceId,targetLanguage,targetId:items[targetLanguage].id,
   targetPath:items[targetLanguage].path
  };
 }
 return null;
}
export function inspectAdminMenus(contract,source){
 const graph=buildGraph(contract);
 if(graph.status!=='complete')return {status:'inconclusive',problems:graph.problems,publicHeaderObserved:false};
 const entries=Array.isArray(source)?source:source?.data??source?.items;
 if(!Array.isArray(entries))return {status:'inconclusive',problems:['MISSING_MENU_ITEMS'],publicHeaderObserved:false};
 const homePaths=Object.fromEntries(LANGUAGE_KEYS.map(lang=>[lang,cleanPath(contract?.homes?.[lang])]));
 if(Object.values(homePaths).some(x=>!x))return {status:'inconclusive',problems:['INVALID_HOME_PATHS'],publicHeaderObserved:false};
 const tourLocaleByPath=new Map(Object.values(graph.routes).flatMap(byLang=>
  Object.entries(byLang).map(([language,entry])=>[entry.path,language])));
 const allTourPaths=new Set(tourLocaleByPath.keys());
 const observations=[];
 for(const item of entries){
  if(!item||!Object.values(MAIN_MENUS).includes(Number(item.menus)))continue;
  const rawTitle=item.title?.rendered??item.title??'';
  const name=String(rawTitle).toLowerCase().trim();
  let lang=name==='en'?'en':name==='hu'?'hu':name==='עברית'||name==='he'?'he':null;
  if(!lang)continue;
  const href=cleanPath(item.url);
  const sourceLanguage=Object.keys(MAIN_MENUS).find(k=>MAIN_MENUS[k]===Number(item.menus));
  const kind=href===homePaths[lang]?'static-home':allTourPaths.has(href)?
   (tourLocaleByPath.get(href)===lang?'tour-path':'wrong-locale-tour'):'other-or-invalid';
  observations.push({menuId:Number(item.menus),sourceLanguage,targetLanguage:lang,kind,
   url:item.url});
 }
 const keys=observations.map(x=>x.sourceLanguage+'>'+x.targetLanguage);
 const observed=new Set(keys);
 const expected=LANGUAGE_KEYS.flatMap(from=>LANGUAGE_KEYS.filter(to=>to!==from).map(to=>from+'>'+to));
 const missing=expected.filter(x=>!observed.has(x));
 const duplicates=[...new Set(keys.filter((key,i)=>keys.indexOf(key)!==i))];
 const invalid=observations.filter(x=>x.kind==='other-or-invalid'||x.kind==='wrong-locale-tour');
 const staticHome=observations.filter(x=>x.kind==='static-home');
 const fixedTour=observations.filter(x=>x.kind==='tour-path');
 const problems=[...missing.map(x=>'MISSING_LANGUAGE_SELECTOR:'+x),
  ...duplicates.map(x=>'DUPLICATE_LANGUAGE_SELECTOR:'+x),
  ...invalid.map(x=>'INVALID_LANGUAGE_TARGET:'+x.sourceLanguage+'>'+x.targetLanguage)];
 return {status:problems.length?'inconclusive':staticHome.length?'static-home-menu-risk':
   fixedTour.length?'fixed-tour-language-menu-risk':'no-static-home-items-detected',
  staticHomeCount:staticHome.length,fixedTourCount:fixedTour.length,observations,missing,
  duplicates,problems,
  publicHeaderObserved:false,
  caution:'Admin menu entries do not prove that the public PHP/Polylang header renders these exact menu items. Source/Work readback is required.'};
}
function selfTest(){
 const graph=buildGraph(manifest);
 assert.equal(graph.status,'complete');
 assert.equal(Object.keys(graph.routes).length,7);
 let paths=0;
 for(const group of manifest.families){
  for(const from of LANGUAGE_KEYS){
   for(const to of LANGUAGE_KEYS.filter(x=>x!==from)){
    const result=localeLink(manifest,group[from].id,to);
    assert.equal(result.family,group.family);
    assert.equal(result.targetId,group[to].id);
    assert.equal(result.targetPath,graph.routes[group.family][to].path);
    paths++;
   }
  }
 }
 assert.equal(paths,42);
 const fakeMenus=[];
 const title={en:'EN',hu:'HU',he:'עברית'};
 for(const from of LANGUAGE_KEYS){
  for(const to of LANGUAGE_KEYS.filter(x=>x!==from)){
   fakeMenus.push({menus:MAIN_MENUS[from],title:title[to],
    url:'https://ezraidereu.com'+manifest.homes[to]});
  }
 }
 const risk=inspectAdminMenus(manifest,fakeMenus);
 assert.equal(risk.status,'static-home-menu-risk');
 assert.equal(risk.staticHomeCount,6);
 assert.equal(risk.publicHeaderObserved,false);
 const missing=inspectAdminMenus(manifest,fakeMenus.slice(1));
 assert.equal(missing.status,'inconclusive');
 assert.equal(missing.missing.length,1);
 assert.equal(inspectAdminMenus(manifest,{}).status,'inconclusive');
 assert.equal(localeLink(manifest,999,'he'),null);
 assert.equal(localeLink(manifest,38,'de'),null);
 const dup=JSON.parse(JSON.stringify(manifest));
 dup.families[1].he.id=dup.families[0].he.id;
 assert.equal(buildGraph(dup).status,'invalid');
 const bad=JSON.parse(JSON.stringify(manifest));
 bad.families[0].he.slug='../escape';
 assert.equal(buildGraph(bad).status,'invalid');
 const wrongHost=inspectAdminMenus(manifest,fakeMenus.map(x=>({...x,url:x.url.replace('https://ezraidereu.com','https://example.com')})));
 assert.equal(wrongHost.staticHomeCount,0);
 assert.equal(wrongHost.status,'inconclusive');
 assert.ok(wrongHost.problems.some(x=>x.startsWith('INVALID_LANGUAGE_TARGET:')));
 const wrongLocaleTour=inspectAdminMenus(manifest,fakeMenus.map((x,i)=>
  i===0?{...x,url:'https://ezraidereu.com/budapest/tours/buda-castle-tour/'}:x));
 assert.equal(wrongLocaleTour.status,'inconclusive');
 assert.ok(wrongLocaleTour.observations.some(x=>x.kind==='wrong-locale-tour'));
 const oneFixedTour=inspectAdminMenus(manifest,fakeMenus.map((x,i)=>
  i===0?{...x,url:'https://ezraidereu.com/budapest/tours/budavari-tura/'}:x));
 assert.equal(oneFixedTour.status,'static-home-menu-risk');
 assert.equal(oneFixedTour.fixedTourCount,1);
 const allFixedTours=inspectAdminMenus(manifest,fakeMenus.map(x=>({
  ...x,url:'https://ezraidereu.com/budapest/tours/'+
    (x.title==='EN'?'buda-castle-tour':x.title==='HU'?'budavari-tura':'סיור-לטירת-בודהה')+'/'
 })));
 assert.equal(allFixedTours.status,'fixed-tour-language-menu-risk');
 const duplicateSelector=inspectAdminMenus(manifest,[...fakeMenus,fakeMenus[0]]);
 assert.equal(duplicateSelector.status,'inconclusive');
 assert.deepEqual(duplicateSelector.duplicates,['en>hu']);
 // "No risk detected" is deliberately not a proof of working live header.
 assert.equal(wrongHost.publicHeaderObserved,false);
 console.log('PASS: 42 same-tour language routes + 15 isolated safety cases including invalid/duplicate menu targets');
}
if(process.argv.includes('--self-test'))selfTest();
else if(process.argv.includes('--menus')){
 const pos=process.argv.indexOf('--menus');
 if(!process.argv[pos+1]){console.error('Supply a local sanitized menu items JSON file');process.exitCode=2;}
 else{
  const result=inspectAdminMenus(manifest,JSON.parse(readFileSync(process.argv[pos+1],'utf8')));
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.status==='static-home-menu-risk'?1:result.status==='inconclusive'?2:0;
 }
}else{console.error('Run --self-test or --menus /local/sanitized-menu-items.json');process.exitCode=2;}

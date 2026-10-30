#!/usr/bin/env node
/**
 * Read-only EZRaiderEU legacy mobile header geometry gate.
 * Takes real, sanitized browser measurements. Never modifies WordPress.
 *
 * node scripts/check-legacy-ezraidereu-mobile-header-geometry.mjs --self-test
 * node scripts/check-legacy-ezraidereu-mobile-header-geometry.mjs --input /private/measurements.json
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ORIGIN='https://ezraidereu.com';
const REFERENCE=['/budapest/tours/buda-castle-tour/','/budapest/tours/citadella-tour/'];
const LANGS=['en','hu','he'];
function validRect(r){return r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0}
const edge=(r,axis)=>r[axis]+r[axis==='x'?'width':'height'];
function overlaps(a,b){return Math.min(edge(a,'x'),edge(b,'x'))>Math.max(a.x,b.x)&&Math.min(edge(a,'y'),edge(b,'y'))>Math.max(a.y,b.y)}
export function auditMeasurements(input){
 const items=input?.measurements;
 if(!Array.isArray(items)||!items.length)return {status:'inconclusive',problems:['NO_MEASUREMENTS'],coverage:[],mayPublishAutomatically:false};
 const problems=[],coverage=[],keys=new Set();
 for(const [n,v] of items.entries()){
  const tag='row'+n;
  let u;try{u=new URL(v?.url)}catch{problems.push(tag+':INVALID_URL');continue}
  if(u.origin!==ORIGIN||!u.pathname.startsWith('/budapest/tours/')){problems.push(tag+':INVALID_ORIGIN_OR_PATH');continue}
  const width=v?.viewportWidth;
  if(!LANGS.includes(v.locale)||!Number.isInteger(width)||width<300||width>2500||!Number.isFinite(v.documentWidth)){
   problems.push(tag+':INVALID_VIEWPORT');continue;
  }
  if(![v.logo,v.title,v.menu,v.header].every(validRect)){problems.push(tag+':MISSING_RECT');continue}
  const key=v.locale+'|'+width+'|'+u.pathname;
  if(keys.has(key)){problems.push(tag+':DUPLICATE');continue}keys.add(key);
  coverage.push({locale:v.locale,width,path:u.pathname});
  if(v.documentWidth>width+1)problems.push(tag+':HORIZONTAL_OVERFLOW');
  if([v.logo,v.title,v.menu].some(r=>r.x< -1||edge(r,'x')>width+1))problems.push(tag+':OUTSIDE_VIEWPORT');
  if(overlaps(v.logo,v.title))problems.push(tag+':LOGO_OVERLAPS_TITLE');
  if(overlaps(v.logo,v.menu))problems.push(tag+':LOGO_OVERLAPS_MENU');
  if(overlaps(v.menu,v.title))problems.push(tag+':MENU_OVERLAPS_TITLE');
  if(width<=480 && v.title.y<edge(v.header,'y')+8)problems.push(tag+':TITLE_NOT_CLEAR_OF_HEADER');
 }
 const mobile=coverage.filter(r=>r.width<=480);
 for(const l of LANGS)if(!mobile.some(r=>r.locale===l))problems.push('MISSING_MOBILE_LOCALE:'+l);
 for(const p of REFERENCE)if(!mobile.some(r=>r.path===p))problems.push('MISSING_REFERENCE_TOUR:'+p);
 if(!mobile.some(r=>r.width<=340))problems.push('MISSING_NARROW_MOBILE');
 if(!mobile.some(r=>r.width>=375))problems.push('MISSING_STANDARD_MOBILE');
 if(!coverage.some(r=>r.width>=700))problems.push('MISSING_TABLET_DESKTOP');
 const fail=problems.some(x=>/OVERLAPS|OVERFLOW|OUTSIDE_VIEWPORT|TITLE_NOT_CLEAR/.test(x));
 return {status:fail?'fail':problems.length?'inconclusive':'pass',problems,coverage,mayPublishAutomatically:false,
  caution:'Does not verify PHP/CSS source, RTL navigation, restore or public release'};
}
function selfTest(){
 const make=(locale,width,path=REFERENCE[0])=>({
  url:ORIGIN+path,locale,viewportWidth:width,documentWidth:width,
  header:{x:0,y:0,width,height:100},
  logo:{x:10,y:10,width:100,height:76},
  menu:{x:width-52,y:20,width:40,height:40},
  title:{x:16,y:132,width:width-32,height:42}
 });
 const clean={measurements:[make('en',375),make('en',390,REFERENCE[1]),make('hu',320),make('he',414),make('en',768)]};
 const dup=()=>JSON.parse(JSON.stringify(clean));
 assert.equal(auditMeasurements(clean).status,'pass');
 const overlap=dup();overlap.measurements[0].title.y=40;
 assert.ok(auditMeasurements(overlap).problems.some(x=>x.includes('LOGO_OVERLAPS_TITLE')));
 assert.equal(auditMeasurements(overlap).status,'fail');
 const menu=dup();menu.measurements[0].menu.x=90;
 assert.ok(auditMeasurements(menu).problems.some(x=>x.includes('LOGO_OVERLAPS_MENU')));
 const clearance=dup();clearance.measurements[0].title.y=102;
 assert.ok(auditMeasurements(clearance).problems.some(x=>x.includes('TITLE_NOT_CLEAR_OF_HEADER')));
 const scroll=dup();scroll.measurements[0].documentWidth=500;
 assert.ok(auditMeasurements(scroll).problems.some(x=>x.includes('HORIZONTAL_OVERFLOW')));
 const missing=dup();delete missing.measurements[0].logo;
 assert.equal(auditMeasurements(missing).status,'inconclusive');
 const lang=dup();lang.measurements=lang.measurements.filter(x=>x.locale!=='he');
 assert.equal(auditMeasurements(lang).status,'inconclusive');
 const origin=dup();origin.measurements[0].url='https://evil.example/budapest/tours/buda-castle-tour/';
 assert.equal(auditMeasurements(origin).status,'inconclusive');
 assert.equal(auditMeasurements({measurements:[]}).status,'inconclusive');
 const duplicates=dup();duplicates.measurements.push(duplicates.measurements[0]);
 assert.equal(auditMeasurements(duplicates).status,'inconclusive');
 assert.equal(auditMeasurements(clean).mayPublishAutomatically,false);
 console.log('PASS: 11 fail-closed mobile geometry and coverage checks');
}
if(process.argv.includes('--self-test'))selfTest();
else if(process.argv.includes('--input')){
 const file=process.argv[process.argv.indexOf('--input')+1];
 if(!file){console.error('Missing input JSON path');process.exitCode=2}
 else{const report=auditMeasurements(JSON.parse(readFileSync(file,'utf8')));
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.status==='pass'?0:report.status==='fail'?1:2;
 }
}else{console.error('Use --self-test or --input /private/measurements.json');process.exitCode=2}

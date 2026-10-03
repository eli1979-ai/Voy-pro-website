import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';

const failures=[];
const roots=[
  'site/budapest',
  'site/he/budapest',
  'site/hu/budapest',
];

function walk(dir){
  const out=[];
  for(const name of readdirSync(dir)){
    const full=path.join(dir,name);
    const stat=statSync(full);
    if(stat.isDirectory())out.push(...walk(full));
    else if(name.endsWith('.html'))out.push(full);
  }
  return out;
}

function inspectJsonLd(file,html){
  const re=/<script type="application\/ld\+json">([^<]+)<\/script>/g;
  for(const match of html.matchAll(re)){
    try{
      const data=JSON.parse(match[1]);
      const visit=(value,trail='root')=>{
        if(Array.isArray(value)){value.forEach((item,index)=>visit(item,trail+'.'+index));return;}
        if(!value||typeof value!=='object')return;
        if(value.offers&&typeof value.offers==='object'&&Object.prototype.hasOwnProperty.call(value.offers,'price')){
          failures.push(file+': JSON-LD contains static offers.price at '+trail);
        }
        for(const [key,item] of Object.entries(value))visit(item,trail+'.'+key);
      };
      visit(data);
    }catch{
      failures.push(file+': invalid JSON-LD after A9.2c rewrite');
    }
  }
}

const forbidden=[
  ['From €70','English static tour price'],
  ['החל מ־€70','Hebrew static tour price'],
  ['€70-tól','Hungarian static tour price'],
  ['€120','static extended-tour price'],
  ['+€30','static private-tour surcharge'],
  ['Riders 16+','English static rider age label'],
  ['Children 3–15','English static child age label'],
  ['Children 3-15','English static child age label'],
  ['Babies 1–2','English static baby age label'],
  ['Babies 1-2','English static baby age label'],
  ['רוכבים 16+','Hebrew static rider age label'],
  ['ילדים 3–15','Hebrew static child age label'],
  ['פעוטות 1–2','Hebrew static baby age label'],
  ['Vezetők 16+','Hungarian static rider age label'],
  ['Gyermekek 3–15','Hungarian static child age label'],
  ['Kisgyermekek 1–2','Hungarian static baby age label'],
];

const forbiddenPatterns=[
  [/~\s*2 hours/i,'English static tour duration'],
  [/About 2 hours/i,'English static tour duration'],
  [/\b2-hour\b/i,'English static tour duration'],
  [/Independent riders[^<.\n]{0,30}16/i,'English static rider age'],
  [/Independent riding[^<.\n]{0,30}16/i,'English static rider age'],
  [/\bage\s*16\b/i,'English static rider age'],
  [/(?:Minimum|From)\s+2\s+riders/i,'English static private-tour minimum'],
  [/\b12\s+riders\b/i,'English static rider capacity'],
  [/18:00/,'Static Budapest departure time'],
  [/כ[־-]?2 שעות|כשעתיים/,'Hebrew static tour duration'],
  [/מגיל\s*16|16\+/,'Hebrew static rider age'],
  [/2\s*רוכבים/,'Hebrew static private-tour minimum'],
  [/12\s*רוכבים/,'Hebrew static rider capacity'],
  [/Kb\.\s*2 óra|~\s*2 óra/i,'Hungarian static tour duration'],
  [/16 éves|16\+/i,'Hungarian static rider age'],
  [/2\s*vezető/i,'Hungarian static private-tour minimum'],
  [/12\s*fő/i,'Hungarian static rider capacity'],
];

let checked=0;
for(const root of roots){
  for(const file of walk(root)){
    const html=readFileSync(file,'utf8');
    checked++;
    for(const [needle,label] of forbidden){
      if(html.includes(needle))failures.push(file+': '+label+' remained: '+needle);
    }
    for(const [pattern,label] of forbiddenPatterns){
      if(pattern.test(html))failures.push(file+': '+label+' remained: '+pattern);
    }
    const priceMarker=/<[^>]+data-(?:runtime|tour)-price[^>]*>[^<]*€[^<]*<\//i;
    if(priceMarker.test(html))failures.push(file+': price marker contains a static euro amount');
    inspectJsonLd(file,html);
  }
}

const runtimeJs=readFileSync('site/assets/site.js','utf8');
const runtimeForbidden=[
  ['BUDAPEST_GUIDE_LANGUAGES','static Budapest guide-language fallback'],
  ['Children 3–15:','static child-age label in runtime messaging'],
  ['Babies 1–2:','static baby-age label in runtime messaging'],
  ['budapestDate(365)','static booking horizon'],
  ['From €70','static price translation'],
  ['privateMinRiders||2','static private minimum fallback'],
  ['durationMinutes||120','static duration fallback'],
  ['maxIndependentRiders:12','static capacity fallback'],
  ['const riderOptions=Array.from({length:11}','static special-request rider range'],
  ['18:00','static Budapest departure time in runtime copy'],
];
for(const [needle,label] of runtimeForbidden){
  if(runtimeJs.includes(needle))failures.push('site/assets/site.js: '+label+' remained: '+needle);
}
for(const required of [
  'destinationRuntime?.booking_horizon_days',
  'form._updateGuideLanguages=(products=[])=>',
  'function riderPolicyLabels()',
  'function applyDestinationRuntimeUI()',
]){
  if(!runtimeJs.includes(required))failures.push('site/assets/site.js: required live business-data marker missing: '+required);
}

if(checked<30)failures.push('Budapest HTML coverage unexpectedly low: '+checked);

if(failures.length){
  console.error('A9.2c static Budapest business fallback guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('A9.2c static Budapest business fallback guard OK: '+checked+' pages checked.');

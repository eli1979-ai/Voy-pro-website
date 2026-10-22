import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root='site';
const listHtml=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const file=path.join(dir,e.name);
  return e.isDirectory()?listHtml(file):e.isFile()&&e.name.endsWith('.html')?[file]:[];
}):[];
const pages=[
  ...listHtml(path.join(root,'budapest')).map(file=>({file,lang:'en'})),
  ...['he','hu','pt'].flatMap(lang=>listHtml(path.join(root,lang)).map(file=>({file,lang})))
];
const englishUI=/\b(?:check availability|book now|continue booking|frequently asked questions|view original review|read original review|customer reviews|tour details|guide languages unavailable|live price unavailable|coupon applied|retry card payment)\b/gi;
let tested=0;
for(const {file,lang} of pages){
  const html=fs.readFileSync(file,'utf8');
  const declared=html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1]?.split('-')[0];
  assert.equal(declared,lang,`HTML language must match locale route: ${file}`);
  const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||'';
  if(lang!=='en'){
    const content=main.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
      .replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|lt|gt);/g,' ').replace(/\s+/g,' ');
    assert.equal((content.match(englishUI)||[]).length,0,
      `English booking/review UI text leaked into ${lang} page: ${file}`);
    if(lang==='he')assert(/[א-ת]{3}/.test(content),`Hebrew main content missing: ${file}`);
    if(lang==='hu')assert(/[őűŐŰ]/.test(content),`Hungarian main content missing: ${file}`);
  }
  tested++;
}
assert(tested>=35,`Expected a full localized website scan, found only ${tested} pages`);

// Hungarian strings generated during bookings are translated via t(en,he)
// and a Hungarian lookup. Guard all *literal* fallback messages, including
// error states that do not appear in the initial HTML.
const runtime=fs.readFileSync(path.join(root,'assets','site.js'),'utf8');
const begin=runtime.indexOf('const HU={');
const end=runtime.indexOf('function huDynamic(en)',begin);
assert(begin>=0&&end>begin,'Hungarian dynamic translation dictionary missing');
const hungarian=runtime.slice(begin,end);
const literals=[...runtime.matchAll(/\bt\(\s*(['"])\s*([^'"\n]*?)\1\s*,/g)].map(match=>match[2]);
for(const original of new Set(literals)){
  if(original.length>3)assert(hungarian.includes("'"+original+"':")||hungarian.includes('"'+original+'":'),
    `Missing Hungarian runtime text for: ${original}`);
}
for(const label of ['Price item','Selected:','Preferred date:','Guide language:','Independent riders:']){
  assert(runtime.includes('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    `Missing Hungarian dynamic fallback for ${label}`);
}
console.log(`Locale consistency QA OK: ${tested} static EN/HE/HU/PT pages and ${new Set(literals).size} runtime phrase keys checked.`);

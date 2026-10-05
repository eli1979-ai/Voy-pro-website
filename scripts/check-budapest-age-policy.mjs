import fs from 'node:fs';
import path from 'node:path';

const roots=['site/budapest','site/he/budapest','site/hu/budapest'];
const failures=[];
let checked=0;

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
    const p=path.join(dir,ent.name);
    return ent.isDirectory()?walk(p):(ent.isFile()&&ent.name.endsWith('.html')?[p]:[]);
  });
}

for(const file of roots.flatMap(walk)){
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('data-faq="age"')) continue;
  checked++;
  const block=html.match(/<details data-faq="age">[\s\S]*?<\/details>/)?.[0]||'';
  if(!block.includes('data-runtime-age-policy')){
    failures.push(file+': age FAQ is not wired to the FBM runtime policy');
  }
  if(/confirmed live during booking|מאושרת בזמן אמת במהלך ההזמנה|foglalás során élőben kerül megerősítésre/.test(block)){
    failures.push(file+': stale ambiguous age-policy copy remains');
  }
}

const runtime=fs.readFileSync('site/assets/site.js','utf8');
for(const marker of [
  'function agePolicyText()',
  'policy.standard_min_age',
  'policy.assessment_min_age',
  'policy.baby_passenger_min_age',
  'policy.child_passenger_max_age',
  "document.querySelectorAll('[data-runtime-age-policy]')",
  "if(!policy)return null;",
]){

  if(!runtime.includes(marker)) failures.push('site/assets/site.js: missing age-policy runtime marker: '+marker);
}

const renderer=fs.readFileSync('scripts/render-budapest-age-policy.mjs','utf8');
for(const marker of [
  "destination.budapest",
  "data-runtime-age-policy",
  "dist/budapest",
  "dist/he/budapest",
  "dist/hu/budapest",
]){
  if(!renderer.includes(marker)) failures.push('age-policy renderer missing marker: '+marker);
}

const contract=fs.readFileSync('contracts/fbm-consumer-contract.json','utf8');
for(const marker of [
  '"standard_min_age": 16',
  '"assessment_min_age": 15',
  '"baby_passenger_min_age": 1',
  '"child_passenger_max_age": 15',
]){
  if(!contract.includes(marker)) failures.push('FBM consumer contract no longer reflects current Budapest age policy: '+marker);
}

if(!checked) failures.push('No Budapest age FAQ blocks found');
if(failures.length){
  console.error('Budapest age policy guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest age policy guard OK: '+checked+' FAQ blocks hydrate the canonical FBM policy (16+ standard, age-15 exception path, passengers 1–15).');

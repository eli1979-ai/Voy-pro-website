import fs from 'node:fs';
import path from 'node:path';

const snapshot=JSON.parse(fs.readFileSync('site/assets/budapest-reputation.json','utf8'));
const roots=['site/budapest','site/he/budapest','site/hu/budapest'];
const failures=[];

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
    const p=path.join(dir,ent.name);
    return ent.isDirectory()?walk(p):(ent.isFile()&&ent.name.endsWith('.html')?[p]:[]);
  });
}

const pages=roots.flatMap(walk);
const googleForms=['1,299','1 299'];
const trip=String(snapshot.tripadvisor.review_count);

for(const file of pages){
  const html=fs.readFileSync(file,'utf8');
  if(/trust-source">Google/.test(html)&&!googleForms.some(v=>html.includes(v))){
    failures.push(file+': Google review count is not synchronized with snapshot');
  }
  if(/trust-source">Tripadvisor/.test(html)&&!html.includes(trip)){
    failures.push(file+': Tripadvisor review count is not synchronized with snapshot');
  }
  if(/1,267|1 267|657 reviews|657 ביקורות|657 értékelés/.test(html)){
    failures.push(file+': stale reputation count remains');
  }
}

for(const file of ['site/budapest/with-kids/index.html','site/he/budapest/with-kids/index.html','site/hu/budapest/with-kids/index.html']){
  const html=fs.readFileSync(file,'utf8');
  if(!googleForms.some(v=>html.includes(v))||!html.includes('659')||!html.includes('#1')||!html.includes('Travelers’ Choice 2026')){
    failures.push(file+': family reputation proof is incomplete');
  }
  if(/trust-source">GetYourGuide/.test(html)){
    failures.push(file+': unverified GetYourGuide headline proof must not appear in family trust strip');
  }
  if(!html.includes('"@type":"FAQPage"')){
    failures.push(file+': family FAQ structured data missing');
  }
}

if(failures.length){
  console.error('Budapest reputation snapshot check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Budapest reputation snapshot OK: Google 5.0 / 1,299; Tripadvisor 5.0 / 659; family pages surface #1 + Travelers’ Choice 2026.');

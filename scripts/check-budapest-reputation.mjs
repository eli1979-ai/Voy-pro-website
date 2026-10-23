import './check-budapest-review-ticker.mjs';
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
const googleForms=[String(snapshot.google.review_count).replace(/\B(?=(\d{3})+(?!\d))/g,','),
  String(snapshot.google.review_count).replace(/\B(?=(\d{3})+(?!\d))/g,' ')];
const trip=String(snapshot.tripadvisor.review_count);
const gyg=String(snapshot.getyourguide.review_count);
const gygForms=[gyg+' ratings',gyg+' דירוגים',gyg+' értékelés'];

for(const file of pages){
  const raw=fs.readFileSync(file,'utf8');
  // Count-only spans on the Budapest landing page preserve a single snapshot;
  // strip their markup before running the legacy text-based reputation checks.
  const html=raw.replace(/<span data-review-count="(?:google|tripadvisor|getyourguide)">([^<]+)<\/span>/g,'$1');
  if(/trust-source">Google/.test(html)&&!googleForms.some(v=>html.includes(v))){
    failures.push(file+': Google review count is not synchronized with snapshot');
  }
  if(/trust-source">Tripadvisor/.test(html)&&!html.includes(trip)){
    failures.push(file+': Tripadvisor review count is not synchronized with snapshot');
  }
  if(/trust-source">GetYourGuide/.test(html)&&!gygForms.some(v=>html.includes(v))){
    failures.push(file+': GetYourGuide rating count is not synchronized with snapshot');
  }
  if(/1,267|1 267|657 reviews|657 ביקורות|657 értékelés|4 ratings|4 דירוגים|4 értékelés/.test(html)){
    failures.push(file+': stale reputation count remains');
  }
}

for(const file of ['site/budapest/with-kids/index.html','site/he/budapest/with-kids/index.html','site/hu/budapest/with-kids/index.html']){
  const html=fs.readFileSync(file,'utf8');
  if(!googleForms.some(v=>html.includes(v))||!html.includes(trip)||!html.includes('#1')||!html.includes('Travelers’ Choice 2026')||!/trust-source">GetYourGuide/.test(html)||!gygForms.some(v=>html.includes(v))){
    failures.push(file+': family reputation proof is incomplete');
  }
  if(!html.includes('data-review-source="getyourguide"')||!gygForms.some(v=>html.includes(v))){
    failures.push(file+': family external GetYourGuide source card is missing or stale');
  }
  if(!html.includes('"@type":"FAQPage"')){
    failures.push(file+': family FAQ structured data missing');
  }
  for(const marker of ['Thule Yepp 2 Maxi','12041302','Thule Yepp Junior','/assets/images/budapest/family-child-seat-closeup.jpg','/assets/images/budapest/family-kids-ride.jpg','/assets/images/budapest/family-group-ride.jpg']){
    if(!html.includes(marker))failures.push(file+': family child-seat model/media marker missing: '+marker);
  }
}

if(failures.length){
  console.error('Budapest reputation snapshot check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Budapest reputation snapshot OK: Google '+snapshot.google.rating+'.0 / '+snapshot.google.review_count+
  '; Tripadvisor '+snapshot.tripadvisor.rating+'.0 / '+trip+
  '; GetYourGuide '+snapshot.getyourguide.rating+'.0 / '+gyg+
  '; family pages surface #1 + Travelers’ Choice 2026.');

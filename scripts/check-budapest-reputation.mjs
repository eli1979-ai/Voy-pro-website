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
const gyg=String(snapshot.getyourguide.review_count);
const gygForms=[gyg+' ratings',gyg+' דירוגים',gyg+' értékelés'];

for(const file of pages){
  const html=fs.readFileSync(file,'utf8');
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
  if(!googleForms.some(v=>html.includes(v))||!html.includes('659')||!html.includes('#1')||!html.includes('Travelers’ Choice 2026')||!/trust-source">GetYourGuide/.test(html)||!gygForms.some(v=>html.includes(v))){
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

// Do not publish fabricated quotes, snippets presented as full reviews, or incomplete sets.
const reviewsAsset='site/assets/budapest-approved-reviews.json';
const reviewData=JSON.parse(fs.readFileSync(reviewsAsset,'utf8'));
const reviewRuntime=fs.readFileSync('site/assets/budapest-review-ticker.js','utf8');
const reviewCss=fs.readFileSync('site/assets/budapest-review-ticker.css','utf8');
if(reviewData.schema_version!==1||!Array.isArray(reviewData.reviews))
  failures.push('Review ticker data contract is malformed');
if(reviewData.publication_status==='approved'){
  if(reviewData.reviews.length!==20)
    failures.push('Only 20 complete, verified reviews may be published');
  for(const item of reviewData.reviews){
    if(!item||!item.reviewer||!item.review_url||!item.platform||!item.date||
       item.rating!==5||typeof item.text!=='string'||item.text.trim().length<20)
      failures.push('Approved review is incomplete or unattributed');
  }
}else if(reviewData.reviews.length>0){
  failures.push('Unapproved reviews must not be retained in the public review dataset');
}
for(const marker of ["data?.publication_status!=='approved'","reviews.length!==20","reviews.every(valid)","textContent=value","setInterval","prefers-reduced-motion"]){
  if(!reviewRuntime.includes(marker))
    failures.push('Review ticker runtime missing integrity or accessibility guard: '+marker);
}
for(const marker of ['.voy-reviews[hidden]','.voy-review-card','.voy-review-quote','.voy-review-track','@media(max-width:620px)']){
  if(!reviewCss.includes(marker))failures.push('Review ticker stylesheet missing: '+marker);
}
for(const file of ['site/budapest/index.html','site/he/budapest/index.html','site/hu/budapest/index.html']){
  const html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('<section class="trust">');
  const end=html.indexOf('</section>',start)+10;
  const pos=html.indexOf('data-review-ticker');
  if(start<0||end<10||pos<end||pos>end+250)
    failures.push(file+': reviews strip must sit directly after reputation ratings');
  for(const token of ['class="voy-reviews"','data-review-ticker','data-review-track','data-review-prev','data-review-next','data-review-pause','hidden','/assets/budapest-review-ticker.css','/assets/budapest-review-ticker.js']){
    if(!html.includes(token))failures.push(file+': missing full-review ticker element '+token);
  }
  if((html.match(/data-review-ticker/g)||[]).length!==1)
    failures.push(file+': expected exactly one reviews ticker');
}

if(failures.length){
  console.error('Budapest reputation snapshot check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Budapest reputation snapshot OK: Google 5.0 / 1,299; Tripadvisor 5.0 / 659; GetYourGuide 5.0 / 5; family pages surface #1 + Travelers’ Choice 2026.');

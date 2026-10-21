import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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


// Customer testimonials may only appear when all 20 original full texts and
// individual source links are reviewed. An incomplete roster stays hidden.
const candidates=JSON.parse(fs.readFileSync('site/assets/budapest-review-candidates.json','utf8'));
const reviewScript=fs.readFileSync('site/assets/budapest-review-ticker.js','utf8');
const reviewStyle=fs.readFileSync('site/assets/budapest-review-ticker.css','utf8');
try{new vm.Script(reviewScript,{filename:'budapest-review-ticker.js'});}
catch(error){failures.push('Review ticker script does not parse: '+error.message);}
if(candidates.schema!=='voy-pro.review-strip-candidates.v1'||candidates.reviews?.length!==20)
  failures.push('Exactly 20 curated reviewer identities are required');
const counts={tripadvisor:0,google:0,getyourguide:0};
const seen=new Set();
for(const review of candidates.reviews||[]){
  if(seen.has(review.id))failures.push('Duplicate review candidate: '+review.id);
  seen.add(review.id);
  if(!Object.prototype.hasOwnProperty.call(counts,review.platform))
    failures.push('Unexpected review source: '+review.platform);
  else counts[review.platform]++;
  if(!review.reviewer||!review.source_profile_url?.startsWith('https://'))
    failures.push('Incomplete reviewer identity or platform profile: '+review.id);
}
if(counts.tripadvisor!==10||counts.google!==7||counts.getyourguide!==3)
  failures.push('Curated reviews must preserve the 10/7/3 platform mix');
const reviewReady=(candidates.reviews||[]).every(r=>
  r.approved===true&&r.verified===true&&typeof r.original_full_text==='string'&&
  r.original_full_text.trim().length>15&&r.verified_review_url?.startsWith('https://')&&
  /^\d{4}-\d{2}-\d{2}$/.test(r.review_date||''));
if(!reviewReady&&(candidates.reviews||[]).some(r=>r.approved===true))
  failures.push('Do not approve a partial or unverified review strip');
if(!reviewScript.includes('data-budapest-review-ticker')||
   !reviewScript.includes('data.reviews.length!==20')||
   !reviewScript.includes('data.reviews.every(reviewIsPublishable)'))
  failures.push('Fail-closed full-review strip validation is missing');
if(!reviewStyle.includes('.voy-review-section[hidden]'))
  failures.push('Unverified review strip must remain hidden even under CSS styling');
for(const home of ['site/budapest/index.html','site/he/budapest/index.html','site/hu/budapest/index.html']){
  const html=fs.readFileSync(home,'utf8');
  const anchor=html.indexOf('class="trust"');
  const slider=html.indexOf('data-budapest-review-ticker hidden');
  const vehicle=html.indexOf('class="section ez-vehicle-bridge"');
  if(anchor<0||slider<=anchor||vehicle<=slider)
    failures.push(home+': review strip is not directly after reputation and before vehicle');
  if(!html.includes('href="/assets/budapest-review-ticker.css"')||
     !html.includes('src="/assets/budapest-review-ticker.js"')||
     !html.includes('data-review-track')||!html.includes('data-review-pause'))
    failures.push(home+': review strip stylesheet, script or accessible controls missing');
}

if(failures.length){
  console.error('Budapest reputation snapshot check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Budapest reputation snapshot OK: Google 5.0 / 1,299; Tripadvisor 5.0 / 659; GetYourGuide 5.0 / 5; family pages surface #1 + Travelers’ Choice 2026.');

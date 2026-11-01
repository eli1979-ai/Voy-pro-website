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
  // Canonical source strip uses count-only spans; read the visible text as the
  // user sees it (same convention as the broad snapshot check above).
  const visible=html.replace(/<span data-review-count="(?:google|tripadvisor|getyourguide)">([^<]+)<\/span>/g,'$1');
  if(!googleForms.some(v=>visible.includes(v))||!visible.includes(trip)||!visible.includes('Travelers’ Choice 2026')||!/trust-source">GetYourGuide/.test(visible)||!gygForms.some(v=>visible.includes(v))){
    failures.push(file+': family canonical review proof is incomplete');
  }
  if(!html.includes('data-review-source="getyourguide"')||!gygForms.some(v=>visible.includes(v))){
    failures.push(file+': family external GetYourGuide source card is missing or stale');
  }
  if(!html.includes('"@type":"FAQPage"')){
    failures.push(file+': family FAQ structured data missing');
  }
  for(const marker of ['Thule Yepp 2 Maxi','12041302','Thule Yepp Junior','/assets/images/budapest/family-child-seat-closeup.jpg','/assets/images/budapest/family-kids-ride.jpg','/assets/images/budapest/family-group-ride.jpg']){
    if(!html.includes(marker))failures.push(file+': family child-seat model/media marker missing: '+marker);
  }
}


// Review surface is consistent across all 42 Budapest destination pages: exactly
// one top 3-platform summary and one closing linkable 3-platform summary followed
// by the same 20-approved-reviews ticker. Marvão is a separate operator and must
// never inherit Budapest's ratings.
for(const file of pages){
 const s=fs.readFileSync(file,'utf8');
 const itemCount=(s.match(/<div class="trust-item">/g)||[]).length;
 const sourceCount=(s.match(/class="review-source-card" data-review-source="/g)||[]).length;
 const tickerCount=(s.match(/<section class="vp-reviews" data-vp-reviews-root hidden/g)||[]).length;
 const bottomCount=(s.match(/<section class="section budapest-review-sources/g)||[]).length;
 if(itemCount!==3||sourceCount!==3||tickerCount!==1||bottomCount!==1){
  failures.push(file+': expected 3 opening sources + 3 linked closing sources + 1 ticker, got '+[itemCount,sourceCount,bottomCount,tickerCount].join('/'));
 }
 if((s.match(/<script src="\/assets\/budapest-review-ticker.js/g)||[]).length!==1||
    !s.includes('/assets/budapest-review-ticker.css')||
    !s.includes('/assets/budapest-review-sources-compact.css')){
  failures.push(file+': review renderer/styles must appear exactly once');
 }
 const top=s.indexOf('<section class="trust">'),bottom=s.indexOf('<section class="section budapest-review-sources'),
   ticker=s.indexOf('<section class="vp-reviews"');
 if(top<0||bottom<=top||ticker<=bottom||ticker>s.indexOf('</main>'))failures.push(file+': review summary ordering incorrect');
 if(s.includes('four-review-sources')||s.includes('family-trust-grid')||s.includes('Tripadvisor ranking')||
    /<section class="section"><div class="wrap proof"><div><strong>5[.,]0/.test(s)){
  failures.push(file+': duplicate legacy rating card or four-column summary remains');
 }
 for(const source of ['google_maps','tripadvisor','getyourguide'])
  if((s.match(new RegExp('data-review-source="'+source+'"','g'))||[]).length!==1)
   failures.push(file+': missing/duplicated audited '+source+' link');
}
for(const locale of ['','he/','pt/']){
 const p='site/'+locale+'portugal/index.html',s=fs.readFileSync(p,'utf8');
 if(s.includes('budapest-review-ticker.js')||s.includes('budapest-review-sources'))
  failures.push(p+': Budapest ratings must not be attributed to Marvão');
}


// Budapest hub booking CTA must follow tour-planning links BEFORE the closing ratings.
for(const locale of ['', 'he/', 'hu/']){
 const path='site/'+locale+'budapest/index.html';
 const html=fs.readFileSync(path,'utf8');
 const plan=html.match(/<section class="section budapest-seo-links">[\s\S]*?<\/section>/)?.[0]||'';
 const reviews=html.match(/<section class="section budapest-review-sources">[\s\S]*?<\/section>/)?.[0]||'';
 const cta=/<div class="review-source-actions"><a class="btn" data-track="booking_cta" href="\/(?:he\/|hu\/)?budapest\/#booking">[^<]+<\/a><\/div>/;
 if(!cta.test(plan)||reviews.includes('review-source-actions'))failures.push(path+': availability CTA must follow planner links, ahead of closing ratings');
 if((html.match(/<div class="review-source-actions">/g)||[]).length!==1)failures.push(path+': duplicate or missing booking CTA');
}

if(failures.length){
  console.error('Budapest reputation snapshot check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Budapest reputation snapshot OK: Google '+snapshot.google.rating+'.0 / '+snapshot.google.review_count+
  '; Tripadvisor '+snapshot.tripadvisor.rating+'.0 / '+trip+
  '; GetYourGuide '+snapshot.getyourguide.rating+'.0 / '+gyg+
  '; family pages use canonical three-source ratings and Travelers’ Choice 2026.');

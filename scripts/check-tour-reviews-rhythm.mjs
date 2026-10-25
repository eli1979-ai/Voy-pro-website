// Regression coverage: all live Budapest tour details use one opening compact
// trust strip and one closing compact linked review strip + approved testimonial ticker.
// No external review scraping, no unverified testimonial content or FBM requests.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const paths=[
  "site/budapest/tours/buda-castle-ezraider-tour/index.html",
  "site/budapest/tours/margaret-island-ezraider-tour/index.html",
  "site/budapest/tours/buda-margaret-extended-tour/index.html",
  "site/budapest/tours/heroes-square-city-ezraider-tour/index.html",
  "site/budapest/tours/citadella-advanced-ezraider-tour/index.html",
  "site/budapest/private-tours/index.html",
  "site/he/budapest/tours/buda-castle-ezraider-tour/index.html",
  "site/he/budapest/tours/margaret-island-ezraider-tour/index.html",
  "site/he/budapest/tours/buda-margaret-extended-tour/index.html",
  "site/he/budapest/tours/heroes-square-city-ezraider-tour/index.html",
  "site/he/budapest/tours/citadella-advanced-ezraider-tour/index.html",
  "site/he/budapest/private-tours/index.html",
  "site/hu/budapest/tours/buda-castle-ezraider-tour/index.html",
  "site/hu/budapest/tours/margaret-island-ezraider-tour/index.html",
  "site/hu/budapest/tours/buda-margaret-extended-tour/index.html",
  "site/hu/budapest/tours/heroes-square-city-ezraider-tour/index.html",
  "site/hu/budapest/tours/citadella-advanced-ezraider-tour/index.html",
  "site/hu/budapest/private-tours/index.html"
];
const snapshot=JSON.parse(fs.readFileSync('site/assets/budapest-reputation.json','utf8'));
const providerOrder=[['google','Google'],['tripadvisor','Tripadvisor'],['getyourguide','GetYourGuide']];
for(const [key] of providerOrder)assert(Number.isSafeInteger(snapshot[key]?.review_count),key+': missing audited count');
// Read the number from a rendered trust-sub value, whether plain text or a
// nested data-review-count span, so older tour pages cannot silently drift.
const readVisibleCount=(card,path,key)=>{
 const attr=card.indexOf('class="trust-sub"');
 assert(attr>=0,path+': '+key+' review count container missing');
 const raw=card.slice(attr).replace(/^[^>]*>/,'').replace(/<[^>]*>/g,' ');
 const found=raw.match(/\d[\d ,]*/);
 assert(found,path+': '+key+' visible review count missing');
 return Number(found[0].replace(/[ ,]/g,''));
};
const style=fs.readFileSync('site/assets/budapest-tour-rhythm.css','utf8');
assert(style.includes('.tour-detail-page .trust-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'));
assert(style.includes('.tour-detail-page .section:not(.booking):not(.tour-review-compact){padding-block:23px}'));
for(const p of paths){
 const html=fs.readFileSync(p,'utf8');
 const trust=html.indexOf('<section class="trust">');
 const lower=html.indexOf('<section class="section budapest-review-sources tour-review-compact"');
 const ticker=html.indexOf('<section class="vp-reviews"');
 assert(trust>=0&&lower>trust&&ticker>lower&&html.indexOf('</main>')>ticker,p+': top trust, bottom compact proof and reviews order');
 assert(/<body[^>]*class="[^"]*tour-detail-page/.test(html),p+': localized style scope missing');
 assert((html.match(/<section class="trust">/g)||[]).length===1,p+': exactly one top trust strip');
 assert((html.match(/class="review-source-grid"/g)||[]).length===1,p+': only one closing source strip');
 // Verify the exact same, audited count is visible in the top compact
 // trust grid and in the closing original-source cards for all 18 pages.
 // A static old tour count must not survive when the main location changes.
 const topHtml=html.slice(trust,html.indexOf('</section>',trust));
 const lowerHtml=html.slice(lower,ticker);
 const topCards=[...topHtml.matchAll(/<div class="trust-item">([\s\S]*?)<\/div><\/div>/g)].map(m=>m[1]);
 const lowerCards=[...lowerHtml.matchAll(/<a class="review-source-card" data-review-source="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
   .map(m=>({source:m[1],body:m[2]}));
 assert.equal(topCards.length,3,p+': expected exactly three top trust cards');
 assert.equal(lowerCards.length,3,p+': expected exactly three linked review-source cards');
 for(let i=0;i<providerOrder.length;i++){
   const [key,label]=providerOrder[i],expected=snapshot[key].review_count;
   assert(topCards[i].includes('class="trust-source">'+label+'</div>'),p+': top trust order differs at '+key);
   assert.equal(readVisibleCount(topCards[i],p,key),expected,p+': stale opening trust count '+key);
   assert.equal(lowerCards[i].source,key==='google'?'google_maps':key,p+': wrong closing source/order '+key);
   assert.equal(readVisibleCount(lowerCards[i].body,p,key),expected,p+': stale closing review count '+key);
 }
 const endOfMain=html.indexOf('</main>',ticker);
 assert(endOfMain>ticker,p+': ticker must finish inside main');
 assert.equal((html.slice(lower,endOfMain).match(/<section\b/g)||[]).length,2,
   p+': compact source strip and testimonial ticker must be the final two main sections');

 assert((html.match(/data-review-source="/g)||[]).length===3,p+': 3 source links');
 assert((html.match(/data-vp-reviews-root hidden/g)||[]).length===1,p+': only one ticker root');
 assert((html.match(/<script src="\/assets\/budapest-review-ticker.js/g)||[]).length===1,p+': only one verified review renderer');
 assert(!/class="wrap proof"><div><strong>5\.0/.test(html),p+': redundant mid-page proof still present');
 assert(!/EXTERNAL REVIEW SOURCES|מקורות ביקורות חיצוניים|KÜLSŐ ÉRTÉKELÉSI FORRÁSOK/.test(html),p+': old tall external sources still present');
 for(const file of ['budapest-review-ticker.css?v=20261023r6','budapest-review-sources-compact.css?v=20261023r2','budapest-tour-rhythm.css?v=20261024r1'])assert(html.includes(file),p+': style missing '+file);
 for(const source of ['google_maps','tripadvisor','getyourguide'])assert(new RegExp('class="review-source-card" data-review-source="'+source+'" href="https://').test(html),p+': authentic outbound source '+source+' missing');
 for(const token of ['data-vp-reviews-left','data-vp-reviews-right','data-vp-reviews-pause','data-vp-reviews-viewport','data-vp-reviews-track'])assert(html.includes(token),p+': review control missing '+token);
 if(p.includes('/tours/')){
   assert(!/<section[^>]*class="[^"]*\broute-compare\b/.test(html),p+': comparison cards must not appear inside an individual tour page');
 }else{
   assert(/<section class="section route-compare">/.test(html),p+': private route chooser must remain on private tour landing');
 }
 assert(html.includes('id="main-content"'),p+': main landmark missing');
}
assert(paths.length===18,'Expected six Budapest tour/private pages in three languages');
console.log('18 Budapest tour pages: compact trust, end review sources, approved ticker and spacing OK');

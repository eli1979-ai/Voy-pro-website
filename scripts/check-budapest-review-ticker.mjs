import fs from 'node:fs';
import vm from 'node:vm';

const failures=[];
const assert=(ok,message)=>{if(!ok)failures.push(message);};
const manifest=JSON.parse(fs.readFileSync('site/assets/budapest-approved-reviews.json','utf8'));
const script=fs.readFileSync('site/assets/budapest-review-ticker.js','utf8');
const css=fs.readFileSync('site/assets/budapest-review-ticker.css','utf8');
const locales=[
  ['site/budapest/index.html','en'],
  ['site/he/budapest/index.html','he'],
  ['site/hu/budapest/index.html','hu']
];
const validSource={google:'google.com',tripadvisor:'tripadvisor.com',getyourguide:'getyourguide.com'};
const isValidSource=(review)=>{
  if(!validSource[review.source]||!review.review_url)return false;
  try {
    const u=new URL(review.review_url);
    const host=validSource[review.source];
    return u.protocol==='https:'&&(u.hostname===host||u.hostname.endsWith('.'+host));
  }catch{return false;}
};
const reviewValid=(review)=>review?.approved===true
  &&typeof review.id==='string'&&review.id.trim().length>=2
  &&typeof review.author==='string'&&review.author.trim().length>=2
  &&typeof review.full_text==='string'&&review.full_text.trim().length>=35
  &&/^\d{4}-\d{2}-\d{2}$/.test(review.date||'')
  &&Number.isInteger(review.rating)&&review.rating>=1&&review.rating<=5
  &&isValidSource(review);
assert(manifest.schema_version===1&&manifest.location==='Budapest'&&manifest.expected_count===20,
  '20-review Budapest manifest contract missing');
assert(Array.isArray(manifest.reviews),'review manifest must be an array');
assert(['approved','awaiting_verified_approval'].includes(manifest.status),'unexpected review approval status');
if(manifest.status==='approved'){
  assert(manifest.reviews.length===20,'approved review list must contain exactly 20 entries');
  assert(manifest.reviews.every(reviewValid),'approved reviews need full original text, reviewer, source URL, date, rating and approval');
  assert(new Set(manifest.reviews.map(x=>x.id)).size===20,'approved reviews need unique IDs');
}else{
  assert(manifest.reviews.length===0,'unapproved, incomplete testimonial sets must never be published');
}
for(const [page,locale] of locales){
  const html=fs.readFileSync(page,'utf8');
  assert(html.includes('lang="'+locale+'"'),'wrong locale: '+page);
  const trust=html.indexOf('<section class="trust">');
  const ticker=html.indexOf('data-vp-reviews-root hidden');
  const next=html.indexOf('class="section ez-vehicle-bridge"');
  assert(trust>=0&&ticker>trust&&next>ticker,'ticker must appear right after trusted platform ratings: '+page);
  for(const marker of ['data-vp-reviews-track','data-vp-reviews-pause','data-vp-reviews-viewport',
    '/assets/budapest-review-ticker.css','/assets/budapest-review-ticker.js']){
    assert(html.includes(marker),'missing review ribbon dependency or control: '+page+' '+marker);
  }
  assert(!html.includes('class="vp-review-card"'),'review cards must be generated only from verified manifest: '+page);
}
for(const marker of ['prefers-reduced-motion','animation-play-state:paused','vp-reviews-scroll','vp-review-text','white-space:pre-line']){
  assert(css.includes(marker),'accessible complete-text ticker style missing '+marker);
}
for(const marker of ['payload.status!==','payload.reviews.length!==20','validReview','aria-hidden',
  "setAttribute('inert'","'is-paused'","textContent=text"]){
  assert(script.includes(marker),'missing safe review rendering behavior '+marker);
}
assert(!/\binnerHTML\s*=|document\.write|eval\s*\(/.test(script),
  'review ticker must render safely using DOM text nodes');
try{new vm.Script(script,{filename:'budapest-review-ticker.js'});}
catch(err){failures.push('review ticker script syntax: '+err.message);}

// Runtime harness: synthetic data stays inside the regression test, NEVER on the website.
function node(tag){
  return {
    tagName:tag, children:[], attrs:{}, events:{},hidden:false,
    classList:{states:new Set(),toggle(k){if(this.states.has(k)){this.states.delete(k);return false;}this.states.add(k);return true;},add(k){this.states.add(k);}},
    setAttribute(k,v){this.attrs[k]=v;},
    append(...els){this.children.push(...els);},
    replaceChildren(...els){this.children=[...els];},
    addEventListener(k,fn){this.events[k]=fn;},
    get lastChild(){return this.children[this.children.length-1];}
  };
}
async function simulate(payload,lang='en'){
  const track=node('div'),viewport=node('div'),pause=node('button'),root=node('section');
  root.hidden=true;
  root.querySelector=(s)=>s==='[data-vp-reviews-track]'?track:
    s==='[data-vp-reviews-viewport]'?viewport:s==='[data-vp-reviews-pause]'?pause:null;
  const doc={documentElement:{lang},
    querySelector:(s)=>s==='[data-vp-reviews-root]'?root:null,
    createElement:node
  };
  const context={document:doc,window:{matchMedia:()=>({matches:false})},
    fetch:async()=>({ok:true,json:async()=>payload}),Set,URL,Number,Object};
  vm.runInNewContext(script,context,{timeout:1500});
  // Let both promise continuations complete.
  for(let i=0;i<6;i++)await Promise.resolve();
  return{root,track,pause};
}
const sample=Array.from({length:20},(_,i)=>({
  approved:true,id:'synthetic-review-'+i,
  author:'Test reviewer '+i,
  full_text:'Regression test fixture, not a real guest review. Complete quote number '+i+'. No part of this is shipped as website content.',
  date:'2026-10-01',rating:5,source:'tripadvisor',
  review_url:'https://www.tripadvisor.com/ShowUserReviews-test-'+i+'.html',
  language:'en'
}));
const pending=await simulate(manifest);
if(manifest.status==='awaiting_verified_approval'){
  assert(pending.root.hidden===true&&pending.track.children.length===0,'incomplete manifest must remain entirely hidden');
}
const approved=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample});
assert(approved.root.hidden===false,'approved 20-item list must activate the ticker');
assert(approved.track.children.length===2,'approved ticker must duplicate the ribbon for seamless movement');
assert(approved.track.children[0]?.children?.length===20,'all 20 authentic review slots must display');
assert(approved.track.children[1]?.attrs?.['aria-hidden']==='true','duplicate ribbon must be hidden from screen readers');
assert(approved.track.children[1]?.attrs?.inert==='','duplicate ribbon must not be tabbable');
const firstCard=approved.track.children[0]?.children[0];
assert(firstCard?.children[1]?.textContent===sample[0].full_text,'display full review text without shortening');
assert(firstCard?.children[2]?.children[1]?.href===sample[0].review_url,'original review source must be linked');
assert(typeof approved.pause.events.click==='function','pause control must work without hover');
approved.pause.events.click?.();
assert(approved.root.classList.states.has('is-paused'),'pause button must stop the ticker');
const invalid=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample.slice(0,19)});
assert(invalid.root.hidden===true,'19 reviews must not be represented as the approved set of 20');

if(failures.length){console.error('Budapest review ticker QA failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Budapest review ticker QA OK: localized placement, full-text accessibility, strict 20-source approval, safe withheld state.');

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


// Keep verified source-presence distinct from permission to republish full text.
// The 20-person shortlist lives under docs/, outside publicly served site assets.
const sourceAudit=JSON.parse(fs.readFileSync('docs/budapest-review-20-candidates.json','utf8'));
assert(sourceAudit.candidates?.length===20,'curated source audit must retain all 20 original reviewers');
assert(sourceAudit.source_audit?.records_total===20,'source audit count inconsistent');
const evidenceKinds={platform_review_found:0,third_party_google_copy_found:0};
let directPermalinks=0;
let supplierOriginals=0;
const uniqueCandidates=new Set();
for(const c of sourceAudit.candidates||[]){
  if(!c?.id||uniqueCandidates.has(c.id)||!c.reviewer||!c.platform)
    failures.push('review audit contains a duplicate or missing reviewer identity');
  if(c?.id)uniqueCandidates.add(c.id);
  if(c.approved!==false||c.full_text!==null)
    failures.push('source presence must never substitute for an approved original full review');
  const ev=c.source_evidence;
  if(!ev||!Object.hasOwn(evidenceKinds,ev.presence_status)||
      typeof ev.evidence_url!=='string'||!ev.evidence_url.startsWith('https://')||
      ev.publication_rights_status!=='owner_authorized'||
      ev.owner_authorization_confirmed_on!=='2026-10-21')
    failures.push('review source audit lacks provenance/republishing caution for '+c.id);
  else evidenceKinds[ev.presence_status]++;
  if(ev?.direct_review_url){
    // Review IDs from indexed listings do not prove a constructed URL is a real permalink.
    if(!ev.direct_review_url.startsWith('https://www.tripadvisor.co.il/ShowUserReviews-')||
       ev.direct_review_url_status!=='unverified_candidate')
      failures.push('uncorroborated direct review link cannot be marked verified: '+c.id);
    directPermalinks++;
  }else if(ev?.direct_review_url_status!=='not_identified'){
    failures.push('review without a permalink must explicitly declare no link verified: '+c.id);
  }
  const expectedStatus=ev?.operator_original_text_evidence?.original_text
    ?'owner_rights_confirmed_verbatim_original_recovered'
    :'owner_rights_confirmed_original_verbatim_pending';
  if(ev?.publication_status!==expectedStatus)
    failures.push('review must retain correct rights and source-text validation status: '+c.id);
  const notification=ev?.operator_original_text_evidence;
  if(notification){
    if(c.platform!=='getyourguide'||notification.source_text_language!==ev.original_language_hint||
       !/^[0-9]{7,10}$/.test(notification.review_notification_reference||'')||
       !/^\d{4}-\d{2}-\d{2}$/.test(notification.notification_received_on||'')||
       notification.matched_against_official_platform_reviewer_and_date!==true||
       !notification.original_text?.trim()||
       notification.original_text.trim().length<70||
       notification.permission_to_republish!=='confirmed_by_owner')
      failures.push('original supplier review evidence incomplete, unverified or prematurely approved: '+c.id);
    supplierOriginals++;
  }
  if(ev?.observed_platform_date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(ev?.observed_platform_date||''))
    failures.push('invalid observed review publication date '+c.id);
}
assert(sourceAudit.source_audit.first_party_platform_reviews_located===evidenceKinds.platform_review_found,
  'first-party source audit count mismatch');
assert(sourceAudit.source_audit.third_party_mirrors_located===evidenceKinds.third_party_google_copy_found,
  'Google mirrored reviews must not be counted as first-party verified');
assert(sourceAudit.source_audit.individual_source_permalink_candidates===directPermalinks,
  'candidate source link count mismatch');
assert(sourceAudit.source_audit.individual_source_permalinks_verified===0,
  'unopened, synthetically constructed review URLs must never be counted as verified');
assert(sourceAudit.source_audit.original_review_texts_recovered_from_operator_notifications===supplierOriginals &&
  supplierOriginals===3, 'three original-language GetYourGuide supplier reviews must stay attributed and unpublished');

assert(sourceAudit.owner_republication_authorization?.status==='approved_by_owner',
  'business owner has authorized reuse of all platform reviews');
assert(sourceAudit.source_audit.original_full_texts_cleared_for_republication===supplierOriginals &&
  sourceAudit.source_audit.original_full_texts_missing_or_unconfirmed===20-supplierOriginals,
  'recovered original-text count is inconsistent');
if(sourceAudit.source_audit.original_full_texts_missing_or_unconfirmed>0){
  assert(manifest.status==='awaiting_verified_approval'&&manifest.reviews.length===0,
    'do not activate 20-review ticker before all original texts and source records are ready');
}

if(failures.length){console.error('Budapest review ticker QA failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Budapest review ticker QA OK: localized placement, full-text accessibility, strict 20-source approval, safe withheld state.');

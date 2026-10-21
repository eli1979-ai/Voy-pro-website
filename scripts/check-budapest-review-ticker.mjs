import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

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
    const hosts=review.source==='tripadvisor'
      ?['tripadvisor.com','tripadvisor.co.uk','tripadvisor.co.il','tripadvisor.ie']
      :[validSource[review.source]];
    return u.protocol==='https:'&&hosts.some(host=>
      u.hostname===host||u.hostname.endsWith('.'+host));
  }catch{return false;}
};
const reviewValid=(review)=>review?.approved===true
  &&typeof review.id==='string'&&review.id.trim().length>=2
  &&typeof review.author==='string'&&review.author.trim().length>=2
  &&typeof review.full_text==='string'&&review.full_text.trim().length>=35
  &&(review.date===null||/^\d{4}-\d{2}-\d{2}$/.test(review.date||''))
  &&['review','listing'].includes(review.link_kind)
  &&review.source_verified===true&&review.full_text_verified===true
  &&Number.isInteger(review.rating)&&review.rating>=1&&review.rating<=5
  &&isValidSource(review);
assert(manifest.schema_version===1&&manifest.location==='Budapest'&&manifest.expected_count===20,
  '20-review Budapest manifest contract missing');
assert(Array.isArray(manifest.reviews),'review manifest must be an array');
assert(['approved','awaiting_verified_approval'].includes(manifest.status),'unexpected review approval status');
if(manifest.status==='approved'){
  assert(manifest.reviews.length===20,'approved review list must contain exactly 20 entries');
  assert(manifest.reviews.every(reviewValid),'approved reviews need a source-verified original full text, truthful source URL and link kind, optional verified date, rating and approval');
  assert(new Set(manifest.reviews.map(x=>x.id)).size===20,'approved reviews need unique IDs');
  assert(manifest.reviews.filter(x=>x.source==='tripadvisor').length===10&&
    manifest.reviews.filter(x=>x.source==='google').length===7&&
    manifest.reviews.filter(x=>x.source==='getyourguide').length===3,
    'approved reviews must retain the original 10 Tripadvisor / 7 Google / 3 GetYourGuide selection');
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
  date:'2026-10-01',rating:5,source:'tripadvisor',link_kind:'review',
  source_verified:true,full_text_verified:true,
  review_url:'https://www.tripadvisor.com/ShowUserReviews-test-'+i+'.html',
  language:'en'
}));
for(let i=10;i<20;i++){
  sample[i].source=i<17?'google':'getyourguide';
  sample[i].link_kind='listing';
  sample[i].review_url=i<17
    ?'https://www.google.com/maps/search/?api=1&query=EZRaider%20Budapest'
    :'https://www.getyourguide.com/budapest-l29/';
}
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

// A confirmed platform review may lack an exact day or individual permalink.
// Show only truthful metadata, and label a platform listing link as a listing.
const listingSample=sample.map(x=>({...x}));
listingSample[10]={...listingSample[10],date:null,link_kind:'listing',
  review_url:'https://www.google.com/maps/search/?api=1&query=EZRaider%20Budapest'};
const listing=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:listingSample},'he');
const listingCard=listing.track.children[0]?.children[10];
assert(listing.root.hidden===false,'platform-verified review with no exact date may appear');
assert(listingCard?.children[2]?.children[0]?.children.length===1,'never invent a date when the provider does not confirm it');
assert(listingCard?.children[2]?.children[1]?.textContent==='לכל הביקורות באתר המקור',
  'a listing link must not claim to point at an individual review');
const unverified=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:listingSample.map((x,i)=>i===10?{...x,source_verified:false}:x)});
assert(unverified.root.hidden===true,'mirrored or unverified reviews must never activate the public ticker');
const misleading=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:listingSample.map((x,i)=>i===10?{...x,review_url:'https://www.google.com.evil.example/reviews'}:x)});
assert(misleading.root.hidden===true,'reject forged platform URLs');
const missingKind=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:listingSample.map((x,i)=>i===10?{...x,link_kind:undefined}:x)});
assert(missingKind.root.hidden===true,'all source links must declare whether they lead to a review or listing');
// Real regional Tripadvisor permalinks must work, but spoofed hosts must fail.
const regionalSample=sample.map(x=>({...x}));
regionalSample[0]={...regionalSample[0],review_url:
  'https://www.tripadvisor.co.il/ShowUserReviews-g274887-d24081931-r1072099249-test.html'};
const region=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:regionalSample});
assert(region.root.hidden===false,'allow an official Tripadvisor regional permalink');
const fakeRegion=regionalSample.map((x,i)=>i===0?{...x,
  review_url:'https://www.tripadvisor.co.il.attacker.example/fake'}:x);
const rejectedRegion=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:fakeRegion});
assert(rejectedRegion.root.hidden===true,'do not accept spoofed Tripadvisor regional hosts');
const wrongMix=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:sample.map((x,i)=>i===10?{...x,source:'tripadvisor',
    review_url:'https://www.tripadvisor.com/ShowUserReviews-fixture'}:x)});
assert(wrongMix.root.hidden===true,'must not publish 20 reviews from the wrong source mix');

// Keep verified source-presence distinct from permission to republish full text.
// The 20-person shortlist lives under docs/, outside publicly served site assets.
const sourceAudit=JSON.parse(fs.readFileSync('docs/budapest-review-20-candidates.json','utf8'));
assert(sourceAudit.candidates?.length===20,'curated source audit must retain all 20 original reviewers');
assert(sourceAudit.source_audit?.records_total===20,'source audit count inconsistent');
const evidenceKinds={platform_review_found:0,third_party_google_copy_found:0};
let directPermalinks=0;
let openedTripadvisorPages=0;
let mirroredGoogleBodies=0;
let officialTripadvisorOriginals=0;
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
  if(c.platform==='tripadvisor'){
    if(!ev?.direct_review_url?.match(/^https:\/\/www\.tripadvisor\.(?:co\.il|co\.uk|ie)\/ShowUserReviews-g274887-d24081931-r[0-9]+-/)||
       ev?.platform_permalink_source!=='official Tripadvisor review title hyperlink, not synthesized'||
       ev?.full_review_status!=='complete_original_visible_on_official_listing'||
       !['individually_opened','officially_linked_but_not_independently_opened'].includes(ev?.direct_review_url_status))
      failures.push('Tripadvisor review requires its original page title hyperlink, honest fetch status and full listing: '+c.id);
    directPermalinks++;officialTripadvisorOriginals++;
    if(ev?.direct_review_url_status==='individually_opened')openedTripadvisorPages++;
  }else if(c.platform==='google'){
    if(ev?.full_review_status!=='original_language_text_recovered_directly_via_google_business_profile'||
       ev?.platform_review_verification!=='confirmed_directly_in_google_business_profile'||
       !ev?.operator_original_text_evidence?.original_text||
       ev?.exact_calendar_date_status!=='confirmed_by_google_api')
       failures.push('Google Business Profile original review verification missing: '+c.id);
    }else if(c.platform==='getyourguide'&&
       ev?.full_review_status!=='original_language_text_recovered_from_supplier_notification'){
    failures.push('GetYourGuide original body source evidence missing: '+c.id);
  }
  const expectedStatus=ev?.operator_original_text_evidence?.original_text
    ?'owner_rights_confirmed_verbatim_original_recovered'
    :'owner_rights_confirmed_original_verbatim_pending';
  if(ev?.publication_status!==expectedStatus)
    failures.push('review must retain correct rights and source-text validation status: '+c.id);
  const notification=ev?.operator_original_text_evidence;
  if(notification){
    if(notification.source_text_language!==ev.original_language_hint||
       notification.matched_against_official_platform_reviewer_and_date!==true||
       !notification.original_text?.trim()||
       notification.original_text.trim().length<35||
       notification.permission_to_republish!=='confirmed_by_owner')
       failures.push('original review evidence incomplete: '+c.id);
    if(c.platform==='getyourguide'&&(!/^[0-9]{7,10}$/.test(notification.review_notification_reference||'')||
       !/^\\d{4}-\\d{2}-\\d{2}$/.test(notification.notification_received_on||'')))
       failures.push('GetYourGuide notification evidence incomplete: '+c.id);


import fs from 'node:fs';
import assertStrict from 'node:assert/strict';
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
  &&review.translations_approved===true&&review.translations&&
    ['en','he','hu'].every(lang=>typeof review.translations[lang]==='string'&&
      review.translations[lang].trim().length>=35)
  &&(!['en','he','hu'].includes(review.language)||review.translations[review.language]===review.full_text)
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
  const bridge=html.indexOf('class="section ez-vehicle-bridge"');
  const externalSources=html.indexOf('class="review-source-grid"');
  const ticker=html.indexOf('data-vp-reviews-root hidden');
  const faq=html.indexOf('data-faq="experience"');
  assert(trust>=0&&bridge>trust&&externalSources>bridge&&ticker>externalSources&&faq>ticker,
    'compact ticker must appear below external review sources and above FAQ: '+page);
  assert(html.split('data-vp-reviews-root hidden').length===2,
    'each localized Budapest page must have exactly one review ribbon: '+page);
  const names={en:['Scroll reviews left','Scroll reviews right','The full stories behind the five stars'],
    he:['הזזת ביקורות שמאלה','הזזת ביקורות ימינה','הסיפורים המלאים מאחורי חמשת הכוכבים'],
    hu:['Értékelések balra görgetése','Értékelések jobbra görgetése','Teljes vendégértékelések az öt csillag mögött']};
  assert(names[locale].every(label=>html.includes(label)),
    'review navigation and heading must use page-localized text: '+page);
  const leftButton=html.match(/<button[^>]*data-vp-reviews-left[^>]*>([\s\S]*?)<\/button>/)?.[1];
  const rightButton=html.match(/<button[^>]*data-vp-reviews-right[^>]*>([\s\S]*?)<\/button>/)?.[1];
  assert(leftButton&&rightButton&&
    leftButton.includes('<path d="M20 12H4m7-7-7 7 7 7"')&&
    rightButton.includes('<path d="M4 12h16m-7-7 7 7-7 7"')&&
    leftButton.includes('aria-hidden="true"')&&
    rightButton.includes('aria-hidden="true"'),
    'left and right arrows must point in opposite directions in SVG markup without CSS: '+page);
  assert(html.includes('/assets/budapest-review-ticker.js?v=20261023r7')&&
    html.includes('/assets/budapest-review-ticker.css?v=20261023r6'),
    'every localized page must load current versioned review JavaScript and CSS: '+page);
  assert(!html.includes('data-vp-reviews-left')===false&&
    !html.includes('data-vp-reviews-right')===false,
    'both directional buttons must exist in each locale: '+page);
  for(const marker of ['data-vp-reviews-track','data-vp-reviews-pause','data-vp-reviews-left','data-vp-reviews-right','data-vp-reviews-viewport',
    '/assets/budapest-review-ticker.css','/assets/budapest-review-ticker.js']){
    assert(html.includes(marker),'missing review ribbon dependency or control: '+page+' '+marker);
  }
  assert(!html.includes('class="vp-review-card"'),'review cards must be generated only from verified manifest: '+page);
}
for(const marker of ['.vp-reviews-nav svg{display:block;width:18px;height:18px',
  'prefers-reduced-motion','overflow-x:auto','direction:ltr','scrollbar-width:none','vp-review-text','white-space:pre-line','vp-review-translated','overflow-y:auto','overscroll-behavior:contain','height:278px','height:282px','clamp(245px,25vw,310px)']){
  assert(css.includes(marker),'accessible complete-text ticker style missing '+marker);
}
assert(css.includes('.vp-reviews .vp-reviews-heading{')&&
  css.includes('flex-direction:column;')&&
  css.includes('.vp-reviews .vp-reviews-controls{')&&
  css.includes('align-self:flex-start;')&&
  css.includes('justify-content:flex-start;')&&
  css.includes('max-width:calc(100% - 72px);'),
  'mobile review controls must be in their own row on the logical start side, away from floating WhatsApp in LTR and RTL');
assert(!css.includes('.vp-reviews-nav[data-vp-reviews-left] svg{transform:rotate(180deg)}'),
  'left arrow must not be flipped back to the right by CSS');
for(const marker of ['payload.status!==','payload.reviews.length!==20','validReview','aria-hidden',
  "'is-paused'","textContent=text","viewport.scrollLeft","requestAnimationFrame","normalize"]){
  assert(script.includes(marker),'missing safe review rendering behavior '+marker);
}
assert(!/\binnerHTML\s*=|document\.write|eval\s*\(/.test(script),
  'review ticker must render safely using DOM text nodes');
try{new vm.Script(script,{filename:'budapest-review-ticker.js'});}
catch(err){failures.push('review ticker script syntax: '+err.message);}

// Runtime harness: synthetic data stays inside the regression test, NEVER on the website.
function node(tag){
  return {
    tagName:tag, children:[], attrs:{}, events:{},eventOptions:{},hidden:false,
    classList:{states:new Set(),toggle(k){if(this.states.has(k)){this.states.delete(k);return false;}this.states.add(k);return true;},add(k){this.states.add(k);},remove(k){this.states.delete(k);},contains(k){return this.states.has(k);}},
    offsetWidth:1200,clientWidth:500,scrollLeft:0,
    setAttribute(k,v){this.attrs[k]=v;},
    focus(){this.focused=true;},
    showModal(){this.open=true;},
    close(){this.open=false;this.events.close?.();},
    append(...els){this.children.push(...els);},
    appendChild(el){this.children.push(el);return el;},
    replaceChildren(...els){this.children=[...els];},
    addEventListener(k,fn,options){this.events[k]=fn;this.eventOptions[k]=options;},
    get lastChild(){return this.children[this.children.length-1];}
  };
}
async function simulate(payload,lang='en',reducedMotion=false){
  const track=node('div'),viewport=node('div'),pause=node('button'),root=node('section');
  root.hidden=true;
  const left=node('button'),right=node('button');
  root.querySelector=(s)=>s==='[data-vp-reviews-track]'?track:
    s==='[data-vp-reviews-viewport]'?viewport:s==='[data-vp-reviews-pause]'?pause:
    s==='[data-vp-reviews-left]'?left:s==='[data-vp-reviews-right]'?right:null;
  // Emulate a pointer hovering over the resumed button AND keyboard focus
  // remaining inside the carousel: neither condition may prevent Resume.
  root.matches=()=>true;
  const doc={documentElement:{lang},visibilityState:'visible',body:node('body'),
    querySelector:(s)=>s==='[data-vp-reviews-root]'?root:null,
    createElement:node
  };
  const frames=[];
  let motionListener;
  const media={
    matches:reducedMotion,
    addEventListener(type,listener){
      assertStrict.equal(type,'change','ticker must listen for OS motion preference changes');
      motionListener=listener;
    }
  };
  const win={matchMedia:query=>{
    assert(query==='(prefers-reduced-motion: reduce)','ticker must read OS reduced-motion setting');
    return media;
  },requestAnimationFrame:fn=>{frames.push(fn);}};
  const context={document:doc,window:win,
    fetch:async()=>({ok:true,json:async()=>payload}),Set,URL,Number,Object};
  vm.runInNewContext(script,context,{timeout:1500});
  // Let both promise continuations complete.
  for(let i=0;i<6;i++)await Promise.resolve();
  return{root,track,pause,viewport,left,right,frames,body:doc.body,
    changeMotion(next){
      assertStrict.equal(typeof motionListener,'function','OS motion listener must be registered');
      media.matches=next;
      motionListener({matches:next});
    }
  };
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
for(const review of sample){
  review.translations_approved=true;
  review.translations={
    en:review.full_text,
    he:'זהו נוסח בדיקה בעברית עבור '+review.id+' בלבד. הטקסט הזה לא יתפרסם באתר והוא נועד לאימות בחירת השפה.',
    hu:'Ez kizárólag tesztszöveg magyarul, azonosító: '+review.id+'. Ez a szöveg nem jelenik meg az éles honlapon.'
  };
}
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

// Native review-dialog focus: the middle group is accessible, but the
// two endless-scroll replicas are aria-hidden even though their buttons
// intentionally remain pointer-clickable. Closing a replica's modal must
// never return keyboard focus to an accessibility-hidden subtree.
for(const language of ['en','he','hu']){
  const state=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},language);
  const expandIn=groupIndex=>{
    const group=state.track.children[groupIndex];
    const card=group.children[0];
    const button=card.children[2].children[0].lastChild;
    assertStrict.equal(button.tagName,'button');
    button.closest=selector=>
      selector==='.vp-review-group[aria-hidden="true"]'&&group.attrs['aria-hidden']==='true'
        ?group:null;
    return button;
  };
  const original=expandIn(1);
  original.events.click();
  const dialog=state.body.lastChild;
  assertStrict.equal(dialog?.open,true,language+' original review modal opens');
  dialog.close();
  assertStrict.equal(original.focused,true,
    language+' original review modal returns focus to original accessible button');
  for(const groupIndex of [0,2]){
    const clone=expandIn(groupIndex);
    state.pause.focused=false;
    clone.events.click();
    assertStrict.equal(dialog.open,true,language+' duplicate review modal opens');
    dialog.close();
    assertStrict.equal(state.pause.focused,true,
      language+' duplicate modal restores focus to visible Pause/Resume control');
    assertStrict.equal(Boolean(clone.focused),false,
      language+' duplicate modal must not focus an aria-hidden button');
  }
  const reduced=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},language,true);
  const group=reduced.track.children[0];
  const clone=group.children[0].children[2].children[0].lastChild;
  clone.closest=selector=>selector==='.vp-review-group[aria-hidden="true"]'?group:null;
  assertStrict.equal(reduced.pause.hidden,true);
  clone.events.click();
  const dialogReduced=reduced.body.lastChild;
  assertStrict.equal(dialogReduced?.open,true,language+' reduced-motion duplicate modal opens');
  dialogReduced.close();
  assertStrict.equal(reduced.right.focused,true,
    language+' reduced-motion dialog focuses visible manual scroll control');
  assertStrict.equal(Boolean(clone.focused),false,
    language+' reduced-motion dialog never focuses accessibility-hidden clone');
}

// Keyboard focus on a review quote, expansion button or source link must
// pause the moving strip. Merely focusing outside review cards (including
// the distinct Resume control) must never cancel a user's choice to resume.
for(const language of ['en','he','hu']){
  const keyboard=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},language);
  assert(typeof keyboard.viewport.events.focusin==='function',
    language+' review viewport must listen for keyboard focus');
  keyboard.viewport.events.focusin({target:{closest:()=>null}});
  assert(!keyboard.root.classList.states.has('is-paused'),
    language+' non-card focus must not pause reviews');
  const start=keyboard.viewport.scrollLeft;
  keyboard.viewport.events.focusin({target:{closest:selector=>
    selector==='.vp-review-card'?keyboard.track.children[1].children[0]:null}});
  assert(keyboard.root.classList.states.has('is-paused'),
    language+' review-card keyboard focus must pause automatic scrolling');
  assert(keyboard.pause.attrs['aria-pressed']==='true',
    language+' focus-triggered pause must expose the pressed state');
  assert(keyboard.pause.textContent===({en:'Resume reviews',he:'המשך גלילת ביקורות',hu:'Értékelések folytatása'}[language]),
    language+' pause control must show the localized Resume label');
  const initialFrame=keyboard.frames[0];
  initialFrame?.(1000);
  keyboard.frames.at(-1)?.(1070);
  assert(keyboard.viewport.scrollLeft===start,
    language+' queued animation frames must not advance while a review has keyboard focus');
  keyboard.pause.events.click?.();
  assert(!keyboard.root.classList.states.has('is-paused'),
    language+' explicit Resume must still restart scrolling after keyboard focus pause');
  const resumed=keyboard.viewport.scrollLeft;
  keyboard.frames.at(-1)?.(1140);
  assert(keyboard.viewport.scrollLeft>resumed,
    language+' explicit Resume must advance the review ribbon normally');
}

// Respect the user's OS accessibility setting without burning animation
// frames for a strip that must never scroll automatically. Manual navigation
// and the real text/source links remain available to all three locales.
for(const language of ['en','he','hu']){
  const motionOff=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},language,true);
  assert(motionOff.root.hidden===false,language+' reduced-motion reviews must remain visible');
  assert(motionOff.pause.hidden===true&&motionOff.root.classList.states.has('is-paused'),
    language+' reduced-motion ribbon must begin paused with unused Resume control hidden');
  assert(motionOff.frames.length===0,
    language+' reduced-motion ribbon must not schedule animation frames');
  const start=motionOff.viewport.scrollLeft;
  motionOff.right.events.click?.();
  assert(motionOff.viewport.scrollLeft>start,
    language+' reduced-motion mode must preserve manual review navigation');
  assert(motionOff.frames.length===0,
    language+' manual navigation must not trigger background auto-scrolling');
  assert(motionOff.track.children[1]?.children?.length===20,
    language+' all original accessible reviews must remain visible in reduced motion');
}

assert(approved.track.children.length===3,'review track must contain a real group with repeated groups on both sides for looping');
// Switching the OS preference while the website is open must cancel *old*
// queued animation frames, never produce parallel loops, and never silently
// restart the moving ribbon without a user's explicit Resume action.
for(const language of ['en','he','hu']){
  const liveMotion=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},language);
  assertStrict.equal(liveMotion.frames.length,1,language+' starts with one scheduled frame');
  const oldFrame=liveMotion.frames[0];
  liveMotion.changeMotion(true);
  assertStrict.equal(liveMotion.pause.hidden,true,language+' hides unnecessary pause button on reduce');
  assertStrict.equal(liveMotion.root.classList.states.has('is-paused'),true);
  const oldFrameCount=liveMotion.frames.length;
  const stoppedAt=liveMotion.viewport.scrollLeft;
  oldFrame(1000);
  assertStrict.equal(liveMotion.frames.length,oldFrameCount,
    language+' invalidated old frame must not reschedule after reduce');
  assertStrict.equal(liveMotion.viewport.scrollLeft,stoppedAt,
    language+' old queued frame must not move reviews after reduce');
  liveMotion.changeMotion(false);
  assertStrict.equal(liveMotion.pause.hidden,false,language+' restores visible resume control');
  assertStrict.equal(liveMotion.root.classList.states.has('is-paused'),true,
    language+' leaving reduced motion must not silently resume');
  assertStrict.equal(liveMotion.frames.length,oldFrameCount+1,
    language+' leaving reduced motion schedules only one new loop');
  const queued=liveMotion.frames.at(-1);
  queued(1000);
  assertStrict.equal(liveMotion.viewport.scrollLeft,stoppedAt,
    language+' a queued frame must not move without explicit Resume');
  liveMotion.pause.events.click();
  assertStrict.equal(liveMotion.root.classList.states.has('is-paused'),false,
    language+' explicit Resume must allow motion again');
  const atResume=liveMotion.viewport.scrollLeft;
  liveMotion.frames.at(-1)(1040);
  assert(liveMotion.viewport.scrollLeft>atResume,
    language+' scrolling must work after explicit Resume');
  liveMotion.changeMotion(true);
  assertStrict.equal(liveMotion.root.classList.states.has('is-paused'),true,
    language+' switching to reduced motion again must re-pause');
}

assert(approved.track.children[1]?.children?.length===20,'all 20 authentic review slots must display in the visible middle group');
assert(approved.track.children[0]?.attrs?.['aria-hidden']==='true'&&
       approved.track.children[2]?.attrs?.['aria-hidden']==='true',
  'before and after groups must be hidden from assistive technology');
assert(approved.viewport.scrollLeft===1200,'scroll position must initialize on middle, accessible group');
assert(!/\.vp-review-group--(?:before|after)\s*\{[^}]*\border\s*:/i.test(css),
  'CSS must not reorder repeated review groups independently from DOM order');
assert(approved.track.children[1]?.attrs?.['aria-hidden']===undefined,
  'visible middle review group must not be hidden from screen readers');
assert(approved.track.children[1]?.children?.[0]?.children?.[1]?.tabIndex===0,
  'the visible complete review text must be keyboard-focusable');
assert(approved.track.children[1]?.children?.[0]?.children?.[2]?.children?.[1]?.tabIndex!==-1,
  'the visible original-source link must remain in the keyboard tab order');
assert(approved.track.children[0]?.children?.[0]?.children?.[1]?.tabIndex===-1&&
       approved.track.children[2]?.children?.[0]?.children?.[1]?.tabIndex===-1,
  'offscreen repeated review quotes must not create duplicate tab stops');

assert(!css.includes('animation:vp-reviews-scroll'),
  'native bidirectional scrolling must replace the animation that could leave Hungarian empty');
assert(approved.track.children[0]?.attrs?.inert===undefined,
  'duplicate visible cards must not be inert or their source links cannot be opened');
assert(approved.track.children[0]?.children?.[0]?.children?.[2]?.children?.[1]?.href===sample[0].review_url,
  'visible repeated review card must link to the same authentic original review');
assert(approved.track.children[0]?.children?.[0]?.children?.[2]?.children?.[1]?.tabIndex===-1,
  'repeated original-review link must not add a duplicate keyboard tab stop');
assert(typeof approved.right.events.click==='function'&&typeof approved.left.events.click==='function',
  'localized manual left/right buttons must be operational');
approved.right.events.click();
assert(approved.viewport.scrollLeft>1200&&approved.root.classList.states.has('is-paused'),
  'right arrow must move horizontally even when auto-scrolling stops');
approved.left.events.click();
assert(approved.viewport.scrollLeft===1200,'left arrow must move horizontally back while paused');
approved.viewport.events.pointerdown?.({pointerType:'mouse',button:0,clientX:400,pointerId:1});
approved.viewport.events.pointermove?.({clientX:350,preventDefault(){}});
assert(approved.viewport.scrollLeft===1250,
  'mouse drag must move reviews horizontally even when carousel is paused');
approved.viewport.events.pointerup?.();
assert(!approved.viewport.classList.states.has('is-dragging'),
  'drag end must restore normal pointer interaction');
// Mobile users must be able to begin a horizontal gesture directly over the
// vertically scrollable review text, rather than aiming for a narrow gap.
assert(css.includes('height:282px;touch-action:pan-y'),
  'review cards must allow native vertical scrolling and JS horizontal swipes');
assert(approved.viewport.eventOptions.touchmove?.passive===false,
  'the card-horizontal swipe handler must be able to cancel native horizontal gestures');
const swipeTarget={closest:selector=>selector==='.vp-review-card'?approved.track.children[1].children[0]:null};
const makeTouch=(id,x,y)=>({identifier:id,clientX:x,clientY:y});
const swipeStart=(model,id,x,y)=>model.viewport.events.touchstart({
  target:swipeTarget,touches:[makeTouch(id,x,y)]
});
const swipeMove=(model,id,x,y,onPrevent)=>model.viewport.events.touchmove({
  touches:[makeTouch(id,x,y)],cancelable:true,preventDefault:onPrevent
});
const afterMouseDrag=approved.viewport.scrollLeft;
let canceledHorizontal=false;
swipeStart(approved,11,400,160);
swipeMove(approved,11,367,162,()=>{canceledHorizontal=true;});
assert(canceledHorizontal&&approved.viewport.scrollLeft===afterMouseDrag+33,
  'swipe left starting inside a text card must scroll the whole ribbon right');
swipeMove(approved,11,339,163,()=>{canceledHorizontal=true;});
assert(approved.viewport.scrollLeft===afterMouseDrag+61,
  'further horizontal touch movement must continue to scroll the review ribbon');
approved.viewport.events.touchend({changedTouches:[makeTouch(11,339,163)]});
const afterTouchEnd=approved.viewport.scrollLeft;
swipeMove(approved,11,300,163,()=>{throw Error('stale swipe gesture');});
assert(approved.viewport.scrollLeft===afterTouchEnd,
  'finished touches must never continue to change horizontal scrolling');
let preventedVertical=false;
const beforeVertical=approved.viewport.scrollLeft;
swipeStart(approved,12,320,120);
swipeMove(approved,12,317,160,()=>{preventedVertical=true;});
swipeMove(approved,12,300,180,()=>{preventedVertical=true;});
assert(!preventedVertical&&approved.viewport.scrollLeft===beforeVertical,
  'vertical scrolling within a long review must remain native and not move the ribbon');
approved.viewport.events.touchcancel();
const beforeRight=approved.viewport.scrollLeft;
swipeStart(approved,13,290,140);
let canceledRight=false;
swipeMove(approved,13,330,140,()=>{canceledRight=true;});
assert(canceledRight&&approved.viewport.scrollLeft===beforeRight-40,
  'swiping right from inside a review must move the ribbon left');
approved.viewport.events.touchend({changedTouches:[makeTouch(13,330,140)]});
const tapPosition=approved.viewport.scrollLeft;
swipeStart(approved,14,220,150);
approved.viewport.events.touchend({changedTouches:[makeTouch(14,220,150)]});
assert(approved.viewport.scrollLeft===tapPosition,
  'simple taps, including taps on original-review links, must not be hijacked');
// Hebrew and Hungarian reviews use the exact same LTR physical gesture math.
for(const language of ['he','hu']){
  const localizedSwipe=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},language);
  const start=localizedSwipe.viewport.scrollLeft;
  swipeStart(localizedSwipe,20,400,180);
  swipeMove(localizedSwipe,20,350,181,()=>{});
  assert(localizedSwipe.viewport.scrollLeft===start+50,
    language+' review-card swipe must preserve physical left/right navigation');
  localizedSwipe.viewport.events.touchend({changedTouches:[makeTouch(20,350,181)]});
}
approved.viewport.scrollLeft=3100;
approved.viewport.events.scroll();
assert(approved.viewport.scrollLeft===1900,'forward loop must wrap before reaching blank space');
approved.viewport.scrollLeft=400;
approved.viewport.events.scroll();
assert(approved.viewport.scrollLeft===1600,'backwards manual scrolling must wrap before reaching blank space');
const huLoop=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},'hu');
huLoop.viewport.scrollLeft=3100;huLoop.viewport.events.scroll();
assert(huLoop.viewport.scrollLeft===1900,'Hungarian full cycle must continuously wrap back into reviews');
const firstQuote=approved.track.children[1]?.children[0]?.children[1];
assert(firstQuote?.tabIndex===0,'long original review text must be keyboard scrollable');
assert(firstQuote?.attrs?.role==='group'&&firstQuote?.attrs?.['aria-label']==='Full review by Test reviewer 0',
  'scrollable text must be labeled with reviewer identity');
assert(approved.track.children[0]?.children?.[0]?.children?.[1]?.tabIndex===-1,
  'duplicated quote must not add another keyboard focus stop');
assert(css.includes('.vp-review-text:focus-visible'),
  'scrollable review text needs a visible keyboard focus indicator');
assert(typeof firstQuote?.events?.touchstart==='function',
  'full-text mobile review must allow pausing the moving ribbon on touch');
firstQuote.events.touchstart();
assert(approved.root.classList.states.has('is-paused'),
  'touching a scrollable long review must pause the ribbon');
assert(approved.pause.textContent==='Resume reviews',
  'mobile reader must have a clearly labeled control to resume the ribbon');
// The pause button should first *resume* after touch, and then pause
// again on a new explicit user action.
const resumeStart=approved.viewport.scrollLeft;
approved.pause.events.click?.();
assert(!approved.root.classList.states.has('is-paused'),
  'resume control must restore movement after touch-based pause');
assert(approved.viewport.scrollLeft>=resumeStart+10,
  'Resume must produce immediate visible horizontal movement without waiting for an animation frame');
const positionBeforeFrame=approved.viewport.scrollLeft;
approved.frames[0]?.(1000);
approved.frames[1]?.(1040);
assert(approved.viewport.scrollLeft>positionBeforeFrame,
  'Resume must restart scrolling even with the pointer over controls and focus inside the carousel');
const continued=approved.viewport.scrollLeft;
approved.frames[2]?.(1080);
assert(approved.viewport.scrollLeft>continued+1,
  'Resume must continue advancing repeatedly rather than only jumping once');
// A lost pointer-up used to leave the internal 'dragging' flag true,
// preventing the animation loop from moving despite clicking Resume.
const unfinishedDrag=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample});
unfinishedDrag.viewport.events.pointerdown?.({pointerType:'mouse',button:0,clientX:400,pointerId:1});
assert(unfinishedDrag.viewport.classList.states.has('is-dragging'),
  'regression fixture must enter the dragging state');
const beforeDragResume=unfinishedDrag.viewport.scrollLeft;
unfinishedDrag.pause.events.click?.();
assert(!unfinishedDrag.root.classList.states.has('is-paused')&&
  !unfinishedDrag.viewport.classList.states.has('is-dragging')&&
  unfinishedDrag.viewport.scrollLeft>=beforeDragResume+10,
  'Resume must release an interrupted drag and immediately start moving');
unfinishedDrag.frames[0]?.(1000);
unfinishedDrag.frames[1]?.(1040);
assert(unfinishedDrag.viewport.scrollLeft>beforeDragResume+10,
  'Resume after an interrupted drag must keep advancing in animation frames');
const firstCard=approved.track.children[1]?.children[0];
assert(firstCard?.children[1]?.textContent===sample[0].full_text,'display full original-language review when the page language matches');
assert(firstCard?.children[2]?.children[1]?.textContent==='View original review on Tripadvisor',
  'label the exact original-review source and platform');
const hebrew=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},'he');
assert(hebrew.root.hidden===false,'approved localized review set must activate in Hebrew');
assert(hebrew.track.children[1]?.children[0]?.children[1]?.textContent===sample[0].translations.he,
  'Hebrew page must render the complete Hebrew translation, never the English original');
assert(hebrew.track.children[1]?.children[0]?.children[2]?.children[0]?.children.some(n=>n.textContent==='תורגם מהמקור'),
  'Hebrew translation must be visibly identified');
const hungarian=await simulate({schema_version:1,expected_count:20,status:'approved',reviews:sample},'hu');
assert(hungarian.track.children[1]?.children[0]?.children[1]?.textContent===sample[0].translations.hu,
  'Hungarian page must render the complete Hungarian translation');
assert(hungarian.track.children[1]?.children[0]?.children[0]?.children[1]?.textContent==='Tripadvisor',
  'platform brand remains unchanged in Hungarian cards');
assert(hungarian.track.children[1]?.children[0]?.children[2]?.children[0]?.children.some(n=>n.textContent==='Az eredetiből fordítva'),
  'Hungarian review must disclose translation in Hungarian');
assert(hungarian.track.children[1]?.children[0]?.children[2]?.children[1]?.textContent==='Eredeti értékelés itt: Tripadvisor',
  'Hungarian original-review link must identify Tripadvisor');
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
const listingCard=listing.track.children[1]?.children[10];
assert(listing.root.hidden===false,'platform-verified review with no exact date may appear');
assert(!listingCard?.children[2]?.children[0]?.children.some(n=>n.tagName==='time'),
  'never invent a date when the provider does not confirm it');
assert(listingCard?.children[2]?.children[1]?.textContent==='לכל הביקורות באתר Google Maps',
  'a listing link must not claim to point at an individual review');
const unverified=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:listingSample.map((x,i)=>i===10?{...x,source_verified:false}:x)});
assert(unverified.root.hidden===true,'mirrored or unverified reviews must never activate the public ticker');
const missingLanguage=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:sample.map((x,i)=>i===0?{...x,translations:{...x.translations,hu:''}}:x)},'en');
assert(missingLanguage.root.hidden===true,'missing Hungarian translation must block publication in every locale');
const missingApproval=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:sample.map((x,i)=>i===0?{...x,translations_approved:false}:x)},'he');
assert(missingApproval.root.hidden===true,'unapproved translations must not be shown in public');
const sourceChanged=await simulate({schema_version:1,expected_count:20,status:'approved',
  reviews:sample.map((x,i)=>i===0?{...x,translations:{...x.translations,en:'An inaccurate rewrite replacing the verified English original review text.'}}:x)});
assert(sourceChanged.root.hidden===true,'a locale matching the source language must preserve its exact original text');
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
  if(c.approved!==true||c.full_text!==null)
    failures.push('source audit must record owner approval without duplicating original guest content');
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
  const pendingScreenshotTranscript=ev?.original_text_transcription_status===
    'transcribed_from_owner_screenshots_awaiting_final_line_by_line_proofread';
  const expectedStatus=ev?.operator_original_text_evidence?.original_text&&!pendingScreenshotTranscript
    ?'owner_rights_confirmed_verbatim_original_recovered'
    :'owner_rights_confirmed_original_verbatim_pending';
  if(ev?.publication_status!==expectedStatus)
    failures.push('review must retain correct rights and source-text validation status: '+c.id);
  const notification=ev?.operator_original_text_evidence;
  if(notification){
    if(notification.source_text_language!==ev.original_language_hint||
       (!pendingScreenshotTranscript&&notification.matched_against_official_platform_reviewer_and_date!==true)||
       (pendingScreenshotTranscript&&(c.platform!=='tripadvisor'||
         notification.source!=='Official Tripadvisor review as shown in owner-provided screenshots'||
         notification.line_by_line_proofread_complete!==false||
         notification.screenshot_received_on!=='2026-10-22'))||
       !notification.original_text?.trim()||
       notification.original_text.trim().length<35||
       notification.permission_to_republish!=='confirmed_by_owner')
      failures.push('original review evidence incomplete: '+c.id);
    if(c.platform==='getyourguide'){
      if(!/^[0-9]{7,10}$/.test(notification.review_notification_reference||'')||
         !/^\d{4}-\d{2}-\d{2}$/.test(notification.notification_received_on||''))
        failures.push('GetYourGuide notification evidence incomplete: '+c.id);
      supplierOriginals++;
    }
  }
  if(ev?.observed_platform_date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(ev?.observed_platform_date||''))
    failures.push('invalid observed review publication date '+c.id);
}
assert(sourceAudit.source_audit.first_party_platform_reviews_located===evidenceKinds.platform_review_found,
  'first-party source audit count mismatch');
assert(sourceAudit.source_audit.third_party_mirrors_located===evidenceKinds.third_party_google_copy_found,
  'Google mirrored reviews must not be counted as first-party verified');
assert(sourceAudit.source_audit.individual_source_permalink_candidates===directPermalinks &&
  sourceAudit.source_audit.tripadvisor_official_title_hyperlinks_collected===directPermalinks &&
  directPermalinks===10,'ten Tripadvisor review title links must be sourced and present');
assert(sourceAudit.source_audit.individual_source_permalinks_verified===openedTripadvisorPages &&
  sourceAudit.source_audit.tripadvisor_individual_pages_opened===openedTripadvisorPages &&
  openedTripadvisorPages===3,'only three individual Tripadvisor review pages were directly opened');
assert(sourceAudit.source_audit.google_mirrored_review_bodies_found===mirroredGoogleBodies &&
  sourceAudit.source_audit.google_reviewer_found_without_complete_body===0 &&
  mirroredGoogleBodies===0,'Google reviews were directly verified');
const breakdown=sourceAudit.source_audit.full_text_confidence_breakdown;
assert(breakdown?.tripadvisor_on_platform_original_language_visible===officialTripadvisorOriginals &&
  breakdown?.getyourguide_original_source_from_supplier_email===supplierOriginals &&
  breakdown?.google_full_body_only_in_third_party_mirror===mirroredGoogleBodies &&
  breakdown?.google_directly_verified_on_google_maps===7,
  'review text original-source confidence counts changed');
assert(sourceAudit.source_audit.full_review_body_visible_or_recovered_for_20_candidates===20 &&
  sourceAudit.source_audit.original_texts_saved_in_operator_audit===20,
  '20 source review bodies and all their provenance records must be saved');
assert(sourceAudit.source_audit.original_review_texts_recovered_from_operator_notifications===supplierOriginals &&
  supplierOriginals===3, 'three original-language GetYourGuide supplier reviews must stay attributed and unpublished');

assert(sourceAudit.owner_republication_authorization?.status==='approved_by_owner',
  'business owner has authorized reuse of all platform reviews');
assert(sourceAudit.source_audit.original_full_texts_cleared_for_republication===20 &&
  sourceAudit.source_audit.original_full_texts_missing_or_unconfirmed===0,
  'source-verified and editorial-approved review counts are inconsistent');
assert(sourceAudit.source_audit.original_full_texts_verified_against_primary_evidence===20,
  'all 20 source originals must be independently verified');
if(sourceAudit.source_audit.original_full_texts_missing_or_unconfirmed>0){
  assert(manifest.status==='awaiting_verified_approval'&&manifest.reviews.length===0,
    'do not activate 20-review ticker before all original texts and source records are ready');
}


// Publisher staging is private to the repository docs, not shipped in /site or /dist.
// Importing partially checked review candidates into the public manifest is forbidden.
const staged=JSON.parse(fs.readFileSync('docs/budapest-review-20-staging.json','utf8'));
assert(staged.schema_version===1&&staged.status==='ready_for_publication'&&staged.expected_count===20,
  'the reviewed source roster must be explicitly ready for publication');
assert(JSON.stringify(staged.selection)===JSON.stringify({tripadvisor:10,google:7,getyourguide:3}),
  'the selected 10/7/3 review mix must remain immutable');
assert(Array.isArray(staged.reviews)&&staged.reviews.length===20,
  'all original reviewers must exist in the staging roster');
const stagedReviewIds=new Set();
let verifiedFullTexts=0,editorialApprovedOriginals=0,unverifiedSources=0;
for(let i=0;i<20;i++){
  const c=sourceAudit.candidates[i],r=staged.reviews[i];
  if(!r||!c||r.id!==c.id||r.author!==c.reviewer||r.source!==c.platform
     ||stagedReviewIds.has(r.id)){
    failures.push('staged reviewer source or order changed at item '+i);
    continue;
  }
  stagedReviewIds.add(r.id);
  const ev=c.source_evidence||{};
  const eligible=r.full_text_verified===true;
  const primarySource=ev.presence_status==='platform_review_found';
  if(r.source_verified!==primarySource)
    failures.push('a mirror must not be mistaken for first-party evidence for '+r.id);
  if(r.link_kind!==(r.source==='tripadvisor'?'review':'listing'))
    failures.push('incorrect honest source-link type for '+r.id);
  if(!isValidSource(r)||r.review_url!==(r.source==='tripadvisor'
      ?ev.direct_review_url:(ev.platform_product_review_listing||ev.evidence_url||c.source_profile_url)))
    failures.push('staged source URL was changed or is not a real matching platform URL: '+r.id);
  if(r.date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(r.date))
    failures.push('malformed date in staging for '+r.id);
  if(ev.date_ambiguity&&r.date!==null)
    failures.push('conflicting regional date must not be published for '+r.id);
  if(!eligible){
    const transcriptPending=ev.original_text_transcription_status===
      'transcribed_from_owner_screenshots_awaiting_final_line_by_line_proofread';
    const untouched= r.full_text===null&&r.language===null;
    const documentedDraft=transcriptPending&&r.source==='tripadvisor'&&
      typeof r.full_text==='string'&&r.full_text.trim().length>=35&&
      r.full_text===ev.operator_original_text_evidence?.original_text&&
      r.language===ev.operator_original_text_evidence?.source_text_language&&
      r.rating===5&&r.date===c.review_date&&r.full_text_verified===false&&
      r.translations_approved===false;
    if(r.approved!==false||!(untouched||documentedDraft))
      failures.push('unverified review must be either absent or a provenance-matched unpublished screenshot draft: '+r.id);
  }else{
    verifiedFullTexts++;
    if(!primarySource||typeof r.full_text!=='string'
        ||r.full_text.trim().length<35||!r.language
        ||!Number.isInteger(r.rating)||r.rating<1||r.rating>5)
      failures.push('a source-verified original is missing required metadata: '+r.id);
    if(r.approved===true)editorialApprovedOriginals++;
    if(r.source==='tripadvisor'&&(r.approved!==true||
      ev.original_text_transcription_status!=='assistant_visually_crosschecked_owner_approved_2026-10-22'||
      ev.operator_original_text_evidence?.line_by_line_proofread_complete!==true||
      ev.visual_review?.publisher_signoff!==true||
      ev.visual_review?.publisher_signoff_by!=='VOY PRO owner'))
      failures.push('Tripadvisor source proof and final owner approval required for publication: '+r.id);
    const ownerOriginal=ev.operator_original_text_evidence?.original_text;
    // Later Tripadvisor originals must be documented in the provenance record too.
    if(!ownerOriginal||r.full_text!==ownerOriginal
        ||r.language!==ev.operator_original_text_evidence.source_text_language
        ||(r.source!=='tripadvisor'&&r.evidence?.email_review_notification_reference!==
          ev.operator_original_text_evidence.review_notification_reference))
      failures.push('staged review must equal its documented owner/source original: '+r.id);
  }
  if(!primarySource){
    unverifiedSources++;
    if(r.approved||eligible||r.rating!==null||r.date!==null)
      failures.push('Google mirror-only candidate may not be approved or dated: '+r.id);
  }
}
assert(stagedReviewIds.size===20,'all 20 unique shortlist identities must be preserved');
assert(verifiedFullTexts===sourceAudit.source_audit.original_full_texts_verified_against_primary_evidence
    &&verifiedFullTexts===20,
  'all 20 complete originals must be independently source verified');
assert(editorialApprovedOriginals===sourceAudit.source_audit.original_full_texts_cleared_for_republication
    &&editorialApprovedOriginals===20,
  'all 20 original review texts must have owner publication approval');
assert(unverifiedSources===0,'all Google reviews must have first-party verification');
assert(manifest.status==='approved'&&manifest.reviews.length===20&&
    manifest.reviews.every(reviewValid),
  'the public review manifest must contain exactly twenty fully verified and owner-approved reviews');
assert(staged.reviews.every((r,i)=>
  r.id===manifest.reviews[i]?.id&&r.full_text===manifest.reviews[i]?.full_text&&
  r.review_url===manifest.reviews[i]?.review_url&&
  r.translations_approved===true&&manifest.reviews[i]?.translations_approved===true&&
  ['en','he','hu'].every(lang=>r.translations?.[lang]===manifest.reviews[i]?.translations?.[lang])),
  'public texts, translations and original-source URLs must exactly match the approved roster');


// The publisher must report safely without changing the real visitor-facing manifest.
const reportRun=spawnSync(process.execPath,
  ['scripts/prepare-budapest-review-manifest.mjs','--report'],
  {encoding:'utf8',timeout:10000});
assert(reportRun.status===0,'safe publisher readiness report must execute successfully');
try{
  const report=JSON.parse(reportRun.stdout||'{}');
  assert(report.selected_count===20&&report.required===20,
    'publisher must require the full shortlist of 20 reviews');
  assert(report.full_originals_verified===20&&report.publishable_now===20&&report.ready===true&&
      report.fully_localized_and_approved===20,
    'publisher must confirm all 20 complete originals and every approved site translation');
  assert(report.source_mix?.tripadvisor===10&&report.source_mix?.google===7&&
    report.source_mix?.getyourguide===3,
    'publisher must validate exact provider mix');
  assert(Array.isArray(report.blockers)&&report.blockers.length===0,
    'published reviewed content must have no unresolved publication blockers');
}catch(error){
  failures.push('publisher readiness report is not valid JSON: '+error.message);
}

if(failures.length){console.error('Budapest review ticker QA failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Budapest review ticker QA OK: twenty approved full texts published, localized and source-linked with accessible presentation.');

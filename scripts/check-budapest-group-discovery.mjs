import fs from 'node:fs';
import vm from 'node:vm';

const pages=[
  ['site/budapest/index.html','/budapest/group-tours/','/budapest/corporate-events/'],
  ['site/he/budapest/index.html','/he/budapest/group-tours/','/he/budapest/corporate-events/'],
  ['site/hu/budapest/index.html','/hu/budapest/group-tours/','/hu/budapest/corporate-events/'],
];
const failures=[];
for(const [file,groupHref,corporateHref] of pages){
  const html=fs.readFileSync(file,'utf8');
  const hub=(html.match(/<section class="section intent-hub"[\s\S]*?<\/section>/)||[])[0]||'';
  const cards=(hub.match(/class="intent-hub-card"/g)||[]).length;
  if(cards!==6) failures.push(`${file}: expected 6 intent-hub cards, found ${cards}`);
  if(!hub.includes(`href="${groupHref}"`)) failures.push(`${file}: missing group-tour discovery link`);
  if(!hub.includes(`href="${corporateHref}"`)) failures.push(`${file}: missing corporate-event discovery link`);
}
// The EZRaider vehicle guide is a first-class, localized Budapest destination.
const vehicleFiles=[
  {locale:'en',prefix:'',home:'site/budapest/index.html'},
  {locale:'he',prefix:'he/',home:'site/he/budapest/index.html'},
  {locale:'hu',prefix:'hu/',home:'site/hu/budapest/index.html'}
];
const manufacturer='https://ezraider.com/';
const manufacturerManual='https://ezraider.com/wp-content/uploads/2026/01/ezraider-user-manual-en.pdf';
const videos=['1i2IQSShkQ8','fMcnMk6gzYA'];
const disallowedVideo='NHWLOcUc8Vg';
const styles=fs.readFileSync('site/assets/ezraider-guide.css','utf8');
const videoJs=fs.readFileSync('site/assets/ezraider-guide.js','utf8');
try{new vm.Script(videoJs,{filename:'ezraider-guide.js'});}
catch(error){failures.push('EZRaider interactive video script is invalid: '+error.message);}
for(const marker of [
  "www.youtube-nocookie.com/embed/",
  "addEventListener('click'",
  "replaceChildren(frame)",
  "autoplay=1&mute=1&playsinline=1",
  "frame.loading='eager'",
  "aria-pressed",
  "youtube.com/watch?v="
])if(!videoJs.includes(marker))failures.push('EZRaider video player missing '+marker);
for(const vid of videos){
  if(!videoJs.includes(vid))failures.push('EZRaider approved video ID missing from player: '+vid);
}
// The on-load behavior must actually mount an autoplay, muted iframe without a click.
try {
  const created=[];
  const stage={replaceChildren(frame){this.child=frame;}};
  const link={href:''};
  const buttons=videos.map((id,i)=>({
    dataset:{ezVideo:id,ezVideoTitle:'Video '+i},
    events:{},addEventListener(type,listener){this.events[type]=listener;},
    setAttribute(key,value){this[key]=value;},
    classList:{toggle(){}}
  }));
  const player={querySelectorAll:(selector)=>selector==='[data-ez-video]'?buttons:[],
    querySelector:(selector)=>selector==='[data-ez-video-screen]'?stage:selector==='[data-ez-watch]'?link:null};
  const context={document:{
    querySelector:(selector)=>selector==='[data-ez-video-player]'?player:null,
    createElement:(tag)=>{const el={tag};created.push(el);return el;}
  },Set};
  vm.runInNewContext(videoJs,context,{timeout:1000});
  if(created.length!==1||stage.child?.tag!=='iframe')failures.push('EZRaider player did not autoplay-load the first iframe');
  if(!stage.child?.src?.includes('embed/'+videos[0]+'?autoplay=1&mute=1&playsinline=1'))
    failures.push('EZRaider player did not autoplay the first video silently');
  if(!stage.child?.allow?.includes('autoplay'))failures.push('EZRaider iframe lacks autoplay permission');
  buttons[1].events.click?.();
  if(stage.child?.src?.indexOf('embed/'+videos[1])<0||created.length!==2)
    failures.push('Switching EZRaider clips did not reload muted autoplay');
} catch(error){failures.push('EZRaider autoplay player runtime failed: '+error.message);}

if(videoJs.includes(disallowedVideo))failures.push('Unlicensed urban riding video remains in allowed player IDs');
if(videoJs.includes("document.write")||videoJs.includes("eval("))failures.push('EZRaider player uses unsafe dynamic execution');
for(const marker of ['.ez-video-screen','.ez-hero-video-title','.ez-seat-model-image','.ez-seat-grid','@media(max-width:620px)','prefers-reduced-motion'])
  if(!styles.includes(marker))failures.push('EZRaider layout missing '+marker);

for(const {locale,prefix,home} of vehicleFiles){
  const path='site/'+prefix+'budapest/ezraider/index.html';
  const html=fs.readFileSync(path,'utf8'),url='https://voy-pro.com/'+prefix+'budapest/ezraider/',href='/'+prefix+'budapest/ezraider/';
  for(const marker of [
    'lang="'+locale+'"','rel="canonical" href="'+url+'"',
    'property="og:image"', 'name="description"', 'data-ez-video-player',
    'href="'+manufacturer+'"','href="'+manufacturerManual+'"',
    'Thule Yepp 2 Maxi Rack Mount','Thule Yepp Junior',
    'https://www.thule.com/', 'class="section ez-safety"', 'id="safety"',
    'href="/'+prefix+'budapest/#booking"', 'data-intent="vehicle"',
    'src="/assets/ezraider-guide.js"', 'href="/assets/ezraider-guide.css"'
  ])if(!html.includes(marker))failures.push(path+': missing '+marker);
  if(html.includes('https://www.ezraider.com/wp-content/uploads/2021/09/EZRaider-en.pdf'))failures.push(path+': outdated manufacturer manual redirect link remains');
  if(/(?:around ages 1.?3|גילאי 1.?3|1.?3 éves)/.test(html))failures.push(path+': child-seat suitability must not use unsupported local age band');
  const hero=(html.match(/<section class="ez-hero">([\s\S]*?)<\/section>/)||[])[1]||'';
  if(!hero.includes('id="see-ezraider"')||!hero.includes('data-ez-video-player'))
    failures.push(path+': interactive video is not in the first-screen hero');
  if(hero.indexOf('data-ez-video-player')>=hero.indexOf('class="ez-hero-copy"'))
    failures.push(path+': video must be first and precede the hero text');
  if(html.includes('family-child-seat-closeup.jpg')||html.includes('class="ez-seat-tour-photo"'))
    failures.push(path+': confusing child-on-seat photograph must be removed');
  if(!html.includes('automatically')&&locale==='en')failures.push(path+': muted autoplay explanation missing');
  if(hero.includes('<figure class="ez-hero-visual">')||html.includes('class="section ez-video-section"'))
    failures.push(path+': redundant old static photo or standalone video section remains');
  if((html.match(/data-ez-video-player/g)||[]).length!==1)
    failures.push(path+': expected exactly one interactive video player');
  const seats=(html.match(/<article class="ez-card ez-seat-model"[\s\S]*?<\/article>/g)||[]);
  if(seats.length!==2)failures.push(path+': both child seats must have separate product cards');
  for(const [model,label] of [['maxi','Thule Yepp 2 Maxi Rack Mount'],['junior','Thule Yepp Junior']]){
    const card=seats.find(card=>card.includes('data-ez-child-seat="'+model+'"'))||'';
    if(!card.includes(label)||!card.includes('class="ez-seat-model-image"')||!/<img[^>]*src="https:\/\/www\.thule\.com\//.test(card))
      failures.push(path+': '+model+' child seat product image and label are missing');
    if(!/<img[^>]*alt="[^"]+"/.test(card))
      failures.push(path+': '+model+' child seat image missing descriptive alt');
  }
  if(!html.includes('class="ez-seat-credit"'))
    failures.push(path+': official seat product photo credit missing');
  // Family photo is a real VOY PRO asset already used on the family-tour pages,
  // displayed AFTER the independent product descriptions rather than as a seat image.
  const familySection=(html.match(/<section class="section ez-family" id="child-seats">([\s\S]*?)<\/section>/)||[])[1]||'';
  const photoMarker='src="/assets/images/budapest/family-group-ride.jpg"';
  if((familySection.split(photoMarker).length-1)!==1)
    failures.push(path+': expected one existing family-group-ride photograph after the child seat models');
  if(!familySection.includes('ez-seat-family-group"')||!familySection.includes('<figcaption>'))
    failures.push(path+': real VOY PRO family photo is missing its own clearly labeled figure');
  if(familySection.indexOf(photoMarker)<familySection.indexOf('class="ez-seat-note"')||
     familySection.indexOf(photoMarker)<familySection.indexOf('data-ez-child-seat="junior"'))
    failures.push(path+': family photo must follow both seat descriptions and suitability note');
  if(!/<img[^>]+family-group-ride\.jpg"[^>]+alt="[^"]+"/.test(familySection))
    failures.push(path+': family photo requires meaningful alt text');
  if(html.includes(disallowedVideo))failures.push(path+': unapproved third video still appears on page');
  if((html.match(/data-ez-video="/g)||[]).length!==2)
    failures.push(path+': video selector must contain exactly two options');
  if(locale==='he'&&!html.includes('dir="rtl"'))failures.push(path+': missing RTL direction');
  if((html.match(/<h1[ >]/g)||[]).length!==1)failures.push(path+': expected exactly one H1');
  for(const id of videos)if(!html.includes('data-ez-video="'+id+'"'))failures.push(path+': missing video '+id);
  for(const code of ['en','he','hu']){
    const translated=code==='en'?'':code+'/';
    if(!html.includes('hreflang="'+code+'" href="https://voy-pro.com/'+translated+'budapest/ezraider/"'))
      failures.push(path+': missing hreflang '+code);
  }
  const structured=[...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(m=>{try{return JSON.parse(m[1]);}catch{return null;}});
  const faq=structured.find(j=>j?.['@type']==='FAQPage'),crumb=structured.find(j=>j?.['@type']==='BreadcrumbList');
  if(!faq||faq.mainEntity?.length!==4)failures.push(path+': expected four real FAQ schema items');
  if(crumb?.itemListElement?.[2]?.item!==url)failures.push(path+': breadcrumbs do not point to current page');
  for(const [file,desc] of [
    [home,'Budapest home'],['site/'+prefix+'budapest/with-kids/index.html','family page'],
    ['site/'+prefix+'budapest/tours/buda-castle-ezraider-tour/index.html','Buda tour']
  ]){
    const content=fs.readFileSync(file,'utf8');
    if(!content.includes('href="'+href+'"'))failures.push(file+': missing vehicle page discovery link ('+desc+')');
  }
}
const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
for(const {prefix} of vehicleFiles)if(!sitemap.includes('https://voy-pro.com/'+prefix+'budapest/ezraider/'))
  failures.push('Sitemap missing EZRaider vehicle route for '+(prefix||'EN'));


// Full-review ticker is fail-closed until the curated 20 verbatim reviews are supplied.
const reviewRegistry=JSON.parse(fs.readFileSync('site/assets/budapest-approved-reviews.json','utf8'));
const reviewScript=fs.readFileSync('site/assets/budapest-review-ticker.js','utf8');
const reviewStyle=fs.readFileSync('site/assets/budapest-review-ticker.css','utf8');
try{new vm.Script(reviewScript,{filename:'budapest-review-ticker.js'});}
catch(error){failures.push('Full review ticker JS invalid: '+error.message);}
const requiredReviewFields=['id','source','author','text','rating','review_url'];
if(reviewRegistry.version!==1||!Array.isArray(reviewRegistry.reviews)||
   !Array.isArray(reviewRegistry.required_review_fields)||
   requiredReviewFields.some(field=>!reviewRegistry.required_review_fields.includes(field)))
  failures.push('Approved review registry schema is missing required review fields');
if(reviewRegistry.approved_for_publication===true){
  if(reviewRegistry.reviews.length!==20)
    failures.push('Never publish full review ticker with fewer or more than the 20 approved original reviews');
  const seen=new Set(),platforms=new Set();
  const domains={google_maps:/^https:\/\/(?:[a-z0-9.-]*\.)?google\.com\/|^https:\/\/maps\.app\.goo\.gl\//,
    tripadvisor:/^https:\/\/(?:[a-z0-9.-]*\.)?tripadvisor\.com\//,
    getyourguide:/^https:\/\/(?:[a-z0-9.-]*\.)?getyourguide\.com\//};
  for(const r of reviewRegistry.reviews){
    if(!r||typeof r!=='object'||!r.id||seen.has(r.id)||!r.author?.trim()||
       !r.text?.trim()||r.text.trim().length<12||!Number.isInteger(r.rating)||r.rating<1||r.rating>5||
       !domains[r.source]?.test(r.review_url||''))
      failures.push('Invalid, unsourced, incomplete or duplicated full review in approved 20-review registry');
    if(r?.id)seen.add(r.id);
    if(r?.source)platforms.add(r.source);
  }
  if(platforms.size!==3)failures.push('Approved reviews must represent all three verified review platforms');
}else if(reviewRegistry.approved_for_publication!==false||reviewRegistry.reviews.length!==0){
  failures.push('Unapproved full review registry must remain empty and disabled (no unverified public testimonials)');
}
for(const localePage of [
  ['site/budapest/index.html','en'],
  ['site/he/budapest/index.html','he'],
  ['site/hu/budapest/index.html','hu']
]){
  const [page,locale]=localePage,html=fs.readFileSync(page,'utf8');
  const trustAt=html.indexOf('<section class="trust">');
  const tickerAt=html.indexOf('data-review-ticker');
  const toursAt=html.indexOf('class="section tour-picker"');
  if(tickerAt<=trustAt||tickerAt<0||toursAt<=tickerAt)
    failures.push(page+': full review ticker is not immediately after trust proof');
  for(const marker of ['class="voy-review-ticker"','data-review-locale="'+locale+'"',
    'data-review-track','data-review-prev','data-review-next','data-review-counter',
    'src="/assets/budapest-review-ticker.js"','href="/assets/budapest-review-ticker.css"'])
    if(!html.includes(marker))failures.push(page+': missing full review slider '+marker);
  if(!/data-review-locale="(?:en|he|hu)" hidden/.test(html))
    failures.push(page+': review ticker must stay hidden until 20 authentic full reviews are approved');
}
for(const marker of ['approved_for_publication!==true','data.reviews.length!==20',
  'textContent=r.text','fetch(', "Object.hasOwn(sourceLabels,r.source)",
  'prefers-reduced-motion','mouseenter','focusin','readOriginal'])
  if(!reviewScript.includes(marker))failures.push('Full-review ticker missing '+marker);
if(reviewScript.includes('.innerHTML')||reviewScript.includes('.slice(0,')||
   reviewStyle.includes('line-clamp')||reviewStyle.includes('text-overflow:ellipsis'))
  failures.push('Full review ticker may not shorten review text or inject unsanitized HTML');

if(failures.length){
  console.error('Budapest group/corporate discovery guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest group/corporate discovery guard OK: EN/HE/HU home intent hubs expose both high-value paths.');

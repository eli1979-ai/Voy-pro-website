import fs from 'node:fs';
import { createHash } from 'node:crypto';

const failures=[];
// Owner-selected EZRaiderIL product photograph, with exact-source integrity check.
const approvedEZRaider=fs.readFileSync('site/assets/images/ezraider/owner-photo-20261031.webp');
const approvedEZRaiderBlobSha=createHash('sha1')
  .update('blob '+approvedEZRaider.length+'\0')
  .update(approvedEZRaider).digest('hex');
if(approvedEZRaiderBlobSha!=='26407d87aa2a0a4b4b59500aa8710db082cd63b6')
  failures.push('EZRaider homepage photo must remain the exact owner-selected transparent image');
if(approvedEZRaider.length<30||
   approvedEZRaider.toString('ascii',0,4)!=='RIFF'||
   approvedEZRaider.toString('ascii',8,12)!=='WEBP'||
   approvedEZRaider.toString('ascii',12,16)!=='VP8X'||
   approvedEZRaider.readUIntLE(24,3)+1!==851||
   approvedEZRaider.readUIntLE(27,3)+1!==877)
  failures.push('EZRaider homepage photo must be the high-resolution 851x877 WebP');

const read=p=>fs.readFileSync(p,'utf8');
const html=read('site/index.html');
const sitemap=read('site/sitemap.xml');
const siteJs=read('site/assets/site.js');
const vercel=JSON.parse(read('vercel.json'));

function requireText(source,text,label){if(!source.includes(text))failures.push(label);}
function forbidText(source,text,label){if(source.includes(text))failures.push(label);}

requireText(html,'<link href="https://voy-pro.com/" rel="canonical"/>','root homepage canonical missing');
requireText(html,'<h1>Choose <span class="network-hero-how">HOW</span> you want to explore.</h1>','root homepage emphasized HOW heading missing');
requireText(html,'class="network-hero-punchline"','root EZRaider punchline marker missing');
requireText(html,'The EZRaider doesn&#39;t just take you places. It puts you in them.','approved experience hook missing');
requireText(html,'href="/budapest/"','root homepage must link Budapest');
for(const language of ['he','hu','es']){
  const localized=read('site/'+language+'/index.html');
  requireText(localized,'rel="canonical"/>','localized homepage canonical metadata missing: '+language);
  requireText(localized,'href="https://voy-pro.com/'+language+'/" rel="canonical"','localized homepage self-canonical missing: '+language);
  requireText(localized,'href="/'+language+'/ezraider/?from=home&amp;return_to=%2F'+language+'%2F"','localized vehicle CTA missing: '+language);
  requireText(localized,'class="network-hero-how"','localized HOW emphasis missing: '+language);
  requireText(localized,'hreflang="es"','Spanish language choice missing: '+language);
  requireText(localized,'href="/'+language+'/" hreflang="'+language+'"','active homepage language link missing: '+language);
}

// The EZRaider story is ONE dedicated section after destination choices.
// Keep the first-screen photo and immediate destination CTA before it.
for(const [locale,file,href] of [
  ['en','site/index.html','/ezraider/?from=home&amp;return_to=%2F'],
  ['he','site/he/index.html','/he/ezraider/?from=home&amp;return_to=%2Fhe%2F'],
  ['hu','site/hu/index.html','/hu/ezraider/?from=home&amp;return_to=%2Fhu%2F'],
  ['es','site/es/index.html','/es/ezraider/?from=home&amp;return_to=%2Fes%2F']
]){
  const page=read(file);
  const hero=page.split('<section class="hero">')[1]?.split('</section>')[0]||'';
  const spotlight=page.match(/<div class="network-ez-spotlight"[\s\S]*?<p class="network-ez-note">[^<]*<\/p><\/div>/)?.[0]||'';
  if(!spotlight)failures.push(locale+': dedicated EZRaider spotlight missing');
  if((page.match(/class="network-ez-spotlight"/g)||[]).length!==1)failures.push(locale+': need exactly one EZRaider spotlight');
  if((page.match(/class="network-ez-feature-card"/g)||[]).length!==4)failures.push(locale+': four different benefits required');
  if(!spotlight.includes('class="btn alt network-ez-cta" href="'+href+'"'))
    failures.push(locale+': localized guide CTA missing from dedicated section');
  if(!spotlight.includes('owner-photo-20261031.webp?v=20261120-hires')||
     !spotlight.includes('width="851" height="877"')||
     !spotlight.includes('network-ez-feature-grid')||
     !spotlight.includes('network-ez-note'))
    failures.push(locale+': product image, benefits or eligibility caveat missing');
  if(page.includes('<section class="section ez-vehicle-bridge">'))
    failures.push(locale+': duplicate late EZRaider bridge must be removed');
  if(!page.includes('id="destinations"')||
     !page.includes('class="tour-choice-grid"')||
     !page.includes('class="trust network-trust"'))
    failures.push(locale+': destination mosaic, ratings or destination anchor lost');
  if(/Israel|Izrael|ישראל|ישראלי/i.test(spotlight))
    failures.push(locale+': unwanted geographic origin mention');
}
requireText(html,'href="/portugal/"','root homepage must link Portugal');
requireText(html,'href="/manage/"','root homepage must expose Manage Booking');
// Destination choices are displayed only ONCE in the dedicated cards.
for(const [language,p] of [['en','site/index.html'],['he','site/he/index.html'],['hu','site/hu/index.html'],['es','site/es/index.html']]){
 const content=read(p);
 const posHero=content.indexOf('<section class="hero">');
 const posScores=content.indexOf('class="trust network-trust"');
 const posDest=content.indexOf('class="section tour-picker" id="destinations"');
 const posSpotlight=content.indexOf('class="hero network-ez-after-destinations"');
 const posRibbon=content.indexOf('class="vp-reviews network-review-ribbon"');
 const posValue=content.indexOf('class="section network-value-section"');
 if(!(posHero>=0&&posScores>posHero&&posDest>posScores&&posSpotlight>posDest&&posRibbon>posSpotlight&&posValue>posRibbon))
   failures.push(language+': must display hero → ratings → destinations → EZRaider story → guest reviews → value');
 if(content.includes('parent-hero-mosaic')||content.includes('parent-hero-destination'))
   failures.push(language+': duplicate opening destination mosaic was not removed');
 if((content.match(/class="tour-choice-card destination-card destination-card--budapest"/g)||[]).length!==1||
    (content.match(/class="tour-choice-card destination-card destination-card--marvao"/g)||[]).length!==1)
   failures.push(language+': destination cards duplicated or missing');
 if((content.match(/data-vp-reviews-root hidden/g)||[]).length!==1)
   failures.push(language+': verified story ribbon must appear once only');
 if(!content.includes('/assets/budapest-review-ticker.js?v=20261029r1')||
    !content.includes('/assets/budapest-review-ticker.css?v=20261023r6'))
   failures.push(language+': existing verified ribbon runtime or CSS missing');
 const title=content.slice(posRibbon,posRibbon+650);
 if(!title.includes('network-review-ribbon')||title.includes('Budapest EZRaider'))
   failures.push(language+': guest story heading should describe EZRaider, not one branch');
}
requireText(html,'class="section network-value-section"','network values need independently scoped closing spacing');
requireText(html,'class="section network-manage-section"','booking management must follow the trimmed final gap');
const css=read('site/assets/site.css');
requireText(css,'body[data-intent="network"] .hero-grid{display:block','network hero must have no second destination column');
requireText(css,'--destination-photo:url("/assets/images/budapest/img12.jpg")','Budapest first-party guest photo missing from destination card');
requireText(css,'--destination-photo:url("/assets/images/portugal/marvao-01.jpg")','Marvão first-party guest photo missing from destination card');
requireText(css,'body[data-page="/"] .network-value-section+.network-manage-section','network-only lower section rhythm missing');
requireText(html,'content="https://voy-pro.com/assets/brand/voy-pro-horizontal-dark.png" property="og:image"','root social card must use a VOY PRO parent-brand asset');
requireText(html,'content="https://voy-pro.com/assets/brand/voy-pro-horizontal-dark.png" name="twitter:image"','root Twitter card must use a VOY PRO parent-brand asset');
requireText(html,'name="twitter:title"','root Twitter card title missing');
requireText(html,'name="twitter:description"','root Twitter card description missing');
requireText(html,'content="VOY PRO brand logo" property="og:image:alt"','root social image alt must match the actual brand logo');
requireText(html,'content="VOY PRO brand logo" name="twitter:image:alt"','root Twitter image alt must match the actual brand logo');
forbidText(html,'content="Guests exploring Budapest by EZRaider with VOY PRO" property="og:image:alt"','root social image alt must not describe an unrelated Budapest ride');
forbidText(html,'content="Guests exploring Budapest by EZRaider with VOY PRO" name="twitter:image:alt"','root Twitter image alt must not describe an unrelated Budapest ride');
forbidText(html,'content="https://voy-pro.com/assets/images/budapest/img12.jpg" property="og:image"','root OG image must not be Budapest-only');
forbidText(html,'content="https://voy-pro.com/assets/images/budapest/img12.jpg" name="twitter:image"','root Twitter image must not be Budapest-only');
requireText(html,'"@type":"Organization"','root homepage must declare VOY PRO Organization schema');
requireText(html,'"@type":"WebSite"','root homepage must declare the parent WebSite entity');
requireText(html,'"@type":"WebPage"','root homepage must declare the root WebPage entity');
requireText(html,'"@id":"https://voy-pro.com/#organization"','root Organization must have a stable entity id');
requireText(html,'"@id":"https://voy-pro.com/#website"','root WebSite must have a stable entity id');
requireText(html,'"publisher":{"@id":"https://voy-pro.com/#organization"}','parent WebSite must point to the VOY PRO Organization');
requireText(html,'"@id":"https://voy-pro.com/#destinations"','root page must expose a destination ItemList');
requireText(html,'"url":"https://voy-pro.com/budapest/"','root destination graph must link Budapest');
requireText(html,'"url":"https://voy-pro.com/portugal/"','root destination graph must link Portugal');
forbidText(html,'data-runtime-price','root homepage must not act like a destination booking page');
forbidText(html,'id="booking"','root homepage must not own destination booking flow');

if(vercel.redirects?.some(r=>r.source==='/'))failures.push('vercel root redirect must not return');
requireText(sitemap,'<loc>https://voy-pro.com/</loc>','sitemap must include the parent homepage');
requireText(siteJs,"isBudapestPage?'budapest':'network'","non-destination pages must resolve to the network context");
requireText(siteJs,"destinationId!=='network'","network pages must not enable destination booking runtime");
requireText(siteJs,"if(!isPortugalPage&&!isBudapestPage)","mobile navigation must support the network context");
requireText(siteJs,"document.querySelectorAll('a.brand').forEach(link=>{link.href='/';});","brand links must resolve to the parent homepage");

requireText(html,'Find the experience that fits your trip','root benefit section must speak to visitors');
requireText(html,'class="tour-choice-actions"','network local destination actions missing');
forbidText(html,'Operational details live inside the destination journey','root homepage must not expose internal operations wording');
forbidText(html,'customer journey and current booking or request path','root homepage must use customer-facing language');

const supportCard=(html.match(/<article class="content-card network-support-card">([\s\S]*?)<\/article>/)||[])[1]||'';
if(!supportCard)failures.push('network support direct contact card missing');
requireText(supportCard,'class="network-support-actions"','network support direct contact actions missing inside card');
requireText(supportCard,'href="https://wa.me/36300993099"','network support WhatsApp link missing inside card');
requireText(supportCard,'data-track="whatsapp_clicked"','network support WhatsApp analytics attribute missing');
requireText(supportCard,'href="mailto:support@voy-pro.com"','network support email action missing inside card');
requireText(supportCard,'>support@voy-pro.com</a>','network support visible email address missing inside card');
requireText(css,'.network-support-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))','network support two-column action layout missing');
requireText(css,'.network-support-action:focus-visible','network support keyboard focus style missing');


 // The network-wide 404 must help guests recover to either active destination,
 // Manage Booking, or central support without attempting a booking or indexing.
 const notFound=read('site/404.html');
 requireText(notFound,'<meta content="noindex,nofollow" name="robots"/>','404 must remain noindex,nofollow');
 requireText(notFound,'href="#main-content"','404 keyboard skip link missing');
 requireText(notFound,'id="main-content"','404 main landmark missing');
 for(const [href,label] of [
   ['/budapest/','Budapest'],
   ['/portugal/','Marvão'],
   ['/manage/','Manage Booking'],
   ['mailto:support@voy-pro.com','VOY PRO support']
 ]){
   const anchors=[...notFound.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)]
     .filter(match=>match[1]===href);
   if(anchors.length!==1)failures.push('404 must expose exactly one '+label+' recovery link: '+href);
 }
 forbidText(notFound,'id="booking"','404 must not act as a booking form');
 forbidText(notFound,'data-track="booking_cta"','404 must not claim booking intent');


// The single network 404 must adapt its human-facing recovery to known
// HE/HU/PT/ES prefix URLs without changing robots, Vercel rules or booking flow.
for(const marker of [
  'data-404-skip','data-404-heading','data-404-intro',
  'data-404-budapest','data-404-portugal','data-404-manage',
  'data-404-help','data-404-support',
  'const locale404=(location.pathname.match(/^\\/(he|hu|pt|es)\\//)',
  "if(locale404==='he')",
  "document.documentElement.dir='rtl'",
  "'/he/budapest/'","'/he/portugal/'",
  "'/hu/budapest/'","'/pt/portugal/'",
  "'/manage/?lang=he'","'/manage/?lang=hu'",
  "'/es/budapest/'","title:'Página no encontrada",
  "if(!copy)return;"
]){
  requireText(notFound,marker,'404 locale recovery marker missing: '+marker);
}
forbidText(notFound,'id="booking"','404 locale recovery must not introduce booking');


// Mobile screenshot-based section rhythm is scoped to landing content, not checkout.
const mobileRhythm=css.slice(css.indexOf('/* Mobile screenshot-based landing-page section rhythm, 31 Oct 2026.'));
requireText(mobileRhythm,'@media(max-width:800px)','Landing spacing must remain mobile-only');
requireText(mobileRhythm,'body:is([data-page="/"],[data-page$="/budapest/"],[data-page$="/portugal/"]) .section:not(.booking)',
  'Landing spacing must cover home, Budapest and Marvão, excluding booking');
requireText(mobileRhythm,'padding-block:24px','Mobile landing sections need compact vertical rhythm');
requireText(mobileRhythm,'.section .content-card','Informational cards must be compact');
requireText(mobileRhythm,'padding:16px','Informational cards need reduced padding');
requireText(mobileRhythm,'.intent-hub-card','Budapest planning cards need compact spacing');
requireText(mobileRhythm,'padding:15px','Budapest planning cards need reduced padding');
for(const path of ['site/budapest/index.html','site/he/budapest/index.html',
  'site/hu/budapest/index.html','site/portugal/index.html',
  'site/he/portugal/index.html','site/pt/portugal/index.html']){
  const landing=read(path);
  if(!landing.includes('class="section '))failures.push(path+': landing layout missing');
}


// Mobile page density regressions: all Budapest/Marvão detail pages share
// the compact visual rhythm, while booking fields remain untouched.
const density=css.slice(css.indexOf('/* 31 Oct screenshot follow-up: tighten mobile spacing on every customer-facing tour page.'));
for(const prefix of ['[data-page="/"','[data-page^="/budapest/"','[data-page^="/he/budapest/"',
'[data-page^="/hu/budapest/"','[data-page^="/portugal/"','[data-page^="/he/portugal/"','[data-page^="/pt/portugal/"']){
 requireText(density,prefix,'Missing scoped mobile density for '+prefix);
}
requireText(density,'@media(max-width:800px)','Mobile density must be breakpoint-scoped');
requireText(density,'.section:not(.booking){padding-block:20px}','Section spacing must be 20px on mobile');
requireText(density,'.section.booking{padding-block:24px}','Booking section exterior spacing must remain readable');
requireText(density,'.section .content-card{padding:16px}','Tour detail cards must be compact');
requireText(density,'.section .proof{gap:12px;padding:18px}','Promo bridges must remain compact');


for(const file of ['site/index.html','site/he/index.html','site/hu/index.html','site/es/index.html']){
 const html=read(file);
 const valueSection=html.split('<section class="section network-value-section">')[1]?.split('</section>')[0]||'';
 if((valueSection.match(/class="content-card network-support-card"/g)||[]).length!==1||
    (valueSection.match(/class="content-card"/g)||[]).length!==1)
  failures.push(file+': DR-06 must retain only the actionable support card');
 const prague=html.match(/<article class="tour-choice-card destination-card destination-card--prague[\s\S]*?<\/article>/)?.[0]||'';
 if(!prague||prague.includes('tour-choice-bottom')||prague.includes('tour-highlights'))
  failures.push(file+': Prague must be a compact coming-soon strip');
 for(const place of ['budapest','marvao']){
  const card=html.match(new RegExp('<article class="tour-choice-card destination-card destination-card--'+place+'"[^>]*>[\\s\\S]*?<\\/article>'))?.[0]||'';
  if((card.match(/class="tour-choice-actions"/g)||[]).length!==1||
     card.includes('<small>Continue</small>')||card.includes('<small>המשך</small>'))
    failures.push(file+': destination '+place+' must have one primary action');
 }
}

const dr06Css=read('site/assets/site.css');
for(const part of ['.hero .facts > span','.tour-highlights > span',':is(.tour-tag,.popular-pill)']){
 if(!dr06Css.includes('body[data-page*="/budapest/"] '+part))
  failures.push('DR-06: Budapest informational pill style missing: '+part);
}
if(!dr06Css.includes('border-radius:0;border:0;background:transparent'))
 failures.push('DR-06: Budapest hero fact pills remain decorative controls');


if(failures.length){
  console.error('VOY PRO root-brand guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('VOY PRO root-brand guard OK: root is destination-neutral and links the active destination journeys.');

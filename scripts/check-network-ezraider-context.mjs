import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const js=fs.readFileSync('site/assets/ezraider-context.js','utf8');
const siteJs=fs.readFileSync('site/assets/site.js','utf8');
const links=[
 ['site/index.html','/ezraider/?from=home','/'],
 ['site/budapest/index.html','/ezraider/?from=budapest','/budapest/'],
 ['site/he/budapest/index.html','/he/ezraider/?from=budapest','/he/budapest/'],
 ['site/hu/budapest/index.html','/hu/ezraider/?from=budapest','/hu/budapest/'],
 ['site/portugal/index.html','/ezraider/?from=marvao','/portugal/'],
 ['site/he/portugal/index.html','/he/ezraider/?from=marvao','/he/portugal/'],
 ['site/pt/portugal/index.html','/pt/ezraider/?from=marvao-pt','/pt/portugal/'],
 ['site/budapest/with-kids/index.html','/ezraider/?from=budapest','/budapest/with-kids/'],
 ['site/he/budapest/with-kids/index.html','/he/ezraider/?from=budapest','/he/budapest/with-kids/'],
 ['site/hu/budapest/with-kids/index.html','/hu/ezraider/?from=budapest','/hu/budapest/with-kids/'],
 ['site/budapest/tours/buda-castle-ezraider-tour/index.html','/ezraider/?from=budapest','/budapest/tours/buda-castle-ezraider-tour/'],
 ['site/he/budapest/tours/buda-castle-ezraider-tour/index.html','/he/ezraider/?from=budapest','/he/budapest/tours/buda-castle-ezraider-tour/'],
 ['site/hu/budapest/tours/buda-castle-ezraider-tour/index.html','/hu/ezraider/?from=budapest','/hu/budapest/tours/buda-castle-ezraider-tour/'],
 ['site/budapest/tours/heroes-square-city-ezraider-tour/index.html','/ezraider/?from=budapest','/budapest/tours/heroes-square-city-ezraider-tour/'],
 ['site/budapest/tours/citadella-advanced-ezraider-tour/index.html','/ezraider/?from=budapest','/budapest/tours/citadella-advanced-ezraider-tour/'],
 ['site/budapest/tours/buda-margaret-extended-tour/index.html','/ezraider/?from=budapest','/budapest/tours/buda-margaret-extended-tour/'],
 ['site/he/budapest/tours/heroes-square-city-ezraider-tour/index.html','/he/ezraider/?from=budapest','/he/budapest/tours/heroes-square-city-ezraider-tour/'],
 ['site/he/budapest/tours/citadella-advanced-ezraider-tour/index.html','/he/ezraider/?from=budapest','/he/budapest/tours/citadella-advanced-ezraider-tour/'],
 ['site/he/budapest/tours/buda-margaret-extended-tour/index.html','/he/ezraider/?from=budapest','/he/budapest/tours/buda-margaret-extended-tour/'],
 ['site/hu/budapest/tours/heroes-square-city-ezraider-tour/index.html','/hu/ezraider/?from=budapest','/hu/budapest/tours/heroes-square-city-ezraider-tour/'],
 ['site/hu/budapest/tours/citadella-advanced-ezraider-tour/index.html','/hu/ezraider/?from=budapest','/hu/budapest/tours/citadella-advanced-ezraider-tour/'],
 ['site/hu/budapest/tours/buda-margaret-extended-tour/index.html','/hu/ezraider/?from=budapest','/hu/budapest/tours/buda-margaret-extended-tour/'],
 ['site/budapest/private-tours/index.html','/ezraider/?from=budapest','/budapest/private-tours/'],
 ['site/budapest/group-tours/index.html','/ezraider/?from=budapest','/budapest/group-tours/'],
 ['site/budapest/corporate-events/index.html','/ezraider/?from=budapest','/budapest/corporate-events/'],
 ['site/he/budapest/private-tours/index.html','/he/ezraider/?from=budapest','/he/budapest/private-tours/'],
 ['site/he/budapest/group-tours/index.html','/he/ezraider/?from=budapest','/he/budapest/group-tours/'],
 ['site/he/budapest/corporate-events/index.html','/he/ezraider/?from=budapest','/he/budapest/corporate-events/'],
 ['site/hu/budapest/private-tours/index.html','/hu/ezraider/?from=budapest','/hu/budapest/private-tours/'],
 ['site/hu/budapest/group-tours/index.html','/hu/ezraider/?from=budapest','/hu/budapest/group-tours/'],
 ['site/hu/budapest/corporate-events/index.html','/hu/ezraider/?from=budapest','/hu/budapest/corporate-events/']
];
for(const [path,link,origin] of links){
 const html=fs.readFileSync(path,'utf8');
 const full='href="'+link+'&amp;return_to='+encodeURIComponent(origin)+'"';
 assert.ok(html.includes(full),path+' loses its exact originating-page link '+full);
}
for(const locale of ['','he/','hu/','pt/']){
 const html=fs.readFileSync('site/'+locale+'ezraider/index.html','utf8');
 assert.ok(html.includes('rel="canonical" href="https://voy-pro.com/'+locale+'ezraider/"'));
 assert.ok(html.includes('id="choose-destination"')&&html.includes('data-ez-context="back"'));
 assert.ok(!html.includes('data-ez-context="booking"')&&html.includes('src="/assets/ezraider-context.js"'),
   'Only the final destination chooser belongs in the guide content; source-aware mobile routing stays in JS');
 assert.equal((html.match(/class="section tour-picker ez-destination-chooser"/g)||[]).length,1,'Exactly one final location-selection section');
 assert.equal((html.match(/data-ez-destination-card=/g)||[]).length,2,'Exactly Budapest and Marvão');
 for(const destination of ['budapest','marvao'])assert.ok(html.includes('data-ez-destination-card="'+destination+'"'));
 for(const removed of ['class="section ez-outro"','data-ez-context="family"','data-ez-context="contact"','destination-card--prague'])assert.ok(!html.includes(removed),'Extra navigation / Prague still on guide: '+removed);
 assert.ok(html.includes('class="tour-choice-grid"')&&html.includes('class="section tour-picker ez-destination-chooser"'),'Shared homepage card format required');
 assert.ok(html.indexOf('class="section tour-picker ez-destination-chooser"')>html.indexOf('class="section ez-family"'),'Destination selection must appear after family content');
 assert.ok(!html.includes('href="/'+locale+'budapest/#booking"'));
 assert.ok(!html.includes('data-runtime-price'));
 for(const lang of ['en','he','hu','pt'])assert.ok(html.includes('hreflang="'+lang+'"'));
}
const guideStyle=fs.readFileSync('site/assets/ezraider-guide.css','utf8');
assert.ok(guideStyle.includes('.ez-main .section{padding-block:clamp(28px,3vw,42px)}'));
assert.ok(guideStyle.includes('.ez-main .ez-manufacturer a,.ez-main .ez-seat-model>a{font-size:12px'));
assert.ok(guideStyle.includes('.ez-main .ez-destination-chooser .tour-choice-grid{grid-template-columns:minmax(0,1fr)}'));
const homepageCss=fs.readFileSync('site/assets/site.css','utf8');
assert.ok(homepageCss.includes('.tour-picker#destinations .destination-card--budapest')&&
 homepageCss.includes('.tour-picker#destinations .destination-card--marvao'),
 'Guide must retain the same destination-card visual format as network homepage');

const redirects=JSON.parse(fs.readFileSync('vercel.json','utf8')).redirects;
assert.equal(redirects.filter(r=>r.source.includes('/budapest/ezraider/')).length,3);
assert.ok(siteJs.includes("vehicleGuideSource==='marvao-pt'"));
function run(search,lang='en',languageTarget='/he/ezraider/?from=home'){
 const actions={};
 const make=name=>({attributes:{'data-ez-context':name,href:'#choose-destination'},textContent:'Initial',setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]}});
 for(const key of ['back','booking','family','contact'])actions[key]=make(key);
 const language=make('lang');language.attributes.href=languageTarget;
 const status={textContent:''};
 const body={dataset:{intent:'vehicle'}};
 const document={body,documentElement:{lang},querySelectorAll(sel){if(sel==='[data-ez-context]')return Object.values(actions);if(sel==='[data-ez-language]')return [language];return []},querySelector(sel){return sel==='[data-ez-context-status]'?status:null}};
 const location={origin:'https://voy-pro.com',search};
 vm.runInNewContext(js,{document,location,URL,URLSearchParams},{timeout:1000});
 return {actions,language,status,body};
}
const h=(r,k)=>r.actions[k].attributes.href;
for(const [source,back,booking,contact] of [
 ['budapest','/he/budapest/','/he/budapest/#booking','https://wa.me/36300993099'],
 ['marvao','/he/portugal/','/he/portugal/#request','https://wa.me/351935695004'],
 ['marvao-pt','/pt/portugal/','/pt/portugal/#request','https://wa.me/351935695004'],
 ['home','/','#choose-destination','#choose-destination']
]){
 const r=run('?from='+source,'he');
 assert.equal(h(r,'back'),back);
 assert.equal(h(r,'booking'),booking);
 assert.equal(h(r,'contact'),contact);
 assert.equal(r.language.attributes.href,'/he/ezraider/?from='+source);
}
for(const input of ['', '?from=https://evil.example','?from=%2F%2Fevil.example','?from=prague','?return=https://evil.example']){
 const r=run(input);
 assert.equal(h(r,'back'),'/');
 assert.equal(h(r,'booking'),'#choose-destination');
}
assert.equal(h(run('?from=budapest','hu'),'booking'),'/hu/budapest/#booking');
assert.equal(h(run('?from=marvao','hu'),'booking'),'/portugal/#request');

// Every new and group/private/corporate guide must return to its exact page, including
// after switching guide language. The branch booking must stay in Budapest.
for(const [page,link,origin] of links.filter(([page])=>
  /\/(?:tours\/(?:heroes-square-city-ezraider-tour|citadella-advanced-ezraider-tour|buda-margaret-extended-tour)|private-tours|group-tours|corporate-events)\/index[.]html$/.test(page))){
 const html=fs.readFileSync(page,'utf8');
 assert.equal((html.match(/data-ez-tour-guide/g)||[]).length,1,
   page+' needs one accessible vehicle-guide link near its enquiry action');
 const lang=origin.startsWith('/he/')?'he':origin.startsWith('/hu/')?'hu':'en';
 const r=run('?from=budapest&return_to='+encodeURIComponent(origin),lang,
   '/pt/ezraider/?from=home');
 assert.equal(h(r,'back'),origin,page+' guide must return exactly to originating tour');
 assert.equal(h(r,'booking'),(lang==='en'?'/':'/'+lang+'/')+'budapest/#booking',
   page+' cannot route booking to another destination');
 assert.equal(r.language.attributes.href,
   '/pt/ezraider/?from=budapest&return_to='+encodeURIComponent(origin),
   page+' guide must retain the originating tour through language switching');
}
// Customers should return to the exact same page, not merely their branch.
// Keep the booking destination unchanged and persist return_to across locales.
const exactTour='/he/budapest/tours/buda-castle-ezraider-tour/';
const originQuery='?from=budapest&return_to='+encodeURIComponent(exactTour);
const fromTour=run(originQuery,'he','/pt/ezraider/?from=home');
assert.equal(h(fromTour,'back'),exactTour);
assert.equal(h(fromTour,'booking'),'/he/budapest/#booking');
assert.equal(fromTour.language.attributes.href,
  '/pt/ezraider/?from=budapest&return_to='+encodeURIComponent(exactTour));
const familyPage='/hu/budapest/with-kids/';
const fromFamily=run('?from=budapest&return_to='+encodeURIComponent(familyPage),'hu');
assert.equal(h(fromFamily,'back'),familyPage);
const marvaoPT=run('?from=marvao-pt&return_to=%2Fpt%2Fportugal%2F','en');
assert.equal(h(marvaoPT,'back'),'/pt/portugal/');
assert.equal(h(marvaoPT,'booking'),'/pt/portugal/#request');
assert.equal(marvaoPT.language.attributes.href,
  '/he/ezraider/?from=marvao-pt&return_to=%2Fpt%2Fportugal%2F');
const fromHome=run('?from=home&return_to=%2F');
assert.equal(h(fromHome,'back'),'/');
for(const [source,unsafe,fallback] of [
 ['budapest','https://evil.example/','/he/budapest/'],
 ['budapest','//evil.example','/he/budapest/'],
 ['budapest','/portugal/','/he/budapest/'],
 ['budapest','/budapest/../portugal/','/he/budapest/'],
 ['budapest','/budapest/%2Fbad/','/he/budapest/'],
 ['budapest','/budapest/?token=secret','/he/budapest/'],
 ['budapest','/budapest/#private','/he/budapest/'],
 ['marvao','/budapest/','/he/portugal/'],
 ['home','/budapest/','/']
]){
 const r=run('?from='+source+'&return_to='+encodeURIComponent(unsafe),'he');
 assert.equal(h(r,'back'),fallback,'Disallowed return path must fall back to the branch: '+unsafe);
 assert.ok(!r.language.attributes.href.includes('return_to'),
   'Unverified return path cannot propagate into another language');
}


// Cross-locale and mobile source routing regressions. Portuguese must retain
// origin context when moving to EN/HE/HU and when using the mobile language row.
const ptToHe=run('?from=marvao-pt','pt','/he/ezraider/?from=home');
assert.equal(ptToHe.language.attributes.href,'/he/ezraider/?from=marvao-pt');
const enToPt=run('?from=budapest','en','/pt/ezraider/?from=home');
assert.equal(enToPt.language.attributes.href,'/pt/ezraider/?from=budapest');
const ptBody=fs.readFileSync('site/pt/ezraider/index.html','utf8');
assert.ok(!ptBody.includes('Budapestee'),'Portuguese destination label must be Budapeste');
assert.ok(ptBody.includes('hreflang="en" href="https://voy-pro.com/ezraider/"'),'Portuguese guide English hreflang must point to actual English page');
assert.ok(ptBody.includes('hreflang="x-default" href="https://voy-pro.com/ezraider/"'),'Neutral default must be network English canonical');
const siteStart=siteJs.indexOf("if(document.body?.dataset?.intent==='vehicle'){",siteJs.indexOf('function enhanceMobileNavigation()'));
const siteEnd=siteJs.indexOf('}else if(!isPortugalPage&&!isBudapestPage){',siteStart);
assert.ok(siteStart>0&&siteEnd>siteStart,'Vehicle-specific mobile navigation branch required');
const mobileVehicle=siteJs.slice(siteStart,siteEnd);
for(const marker of ['data-mobile-language-row','data-ez-context="back"','data-ez-context="booking"','mobileOriginBooking','mobileMarvaoHome','mobileBudapestHome',"mobileOrigin==='home'"]){
 assert.ok(mobileVehicle.includes(marker),'Mobile guide navigation missing '+marker);
}

assert.equal(h(run('?from=marvao-pt','pt'),'back'),'/pt/portugal/');
assert.equal(h(run('?from=marvao-pt','pt'),'booking'),'/pt/portugal/#request');
assert.equal(h(run('?from=marvao','pt'),'booking'),'/pt/portugal/#request');
assert.equal(h(run('?from=budapest','pt'),'booking'),'/budapest/#booking');
assert.equal(h(run('?from=home','pt'),'booking'),'#choose-destination');
const ptToEn=run('?from=marvao-pt','pt','/ezraider/?from=home');
assert.equal(ptToEn.language.attributes.href,'/ezraider/?from=marvao-pt');
const ptToHu=run('?from=marvao-pt','pt','/hu/ezraider/?from=home');
assert.equal(ptToHu.language.attributes.href,'/hu/ezraider/?from=marvao-pt');
const translated=fs.readFileSync('site/pt/ezraider/index.html','utf8');
assert.ok(translated.includes('<html lang="pt">')&&translated.includes('property="og:locale" content="pt_PT"'));
assert.ok(translated.includes('Conheça o EZRaider.')&&translated.includes('A segurança exige preparação e atenção'));
assert.ok(translated.includes('data-ez-child-seat="maxi"')&&translated.includes('data-ez-child-seat="junior"'));
assert.equal((translated.match(/data-ez-video="/g)||[]).length,2);
assert.ok(translated.includes('Marvão')&&translated.includes('equipa local'));
const schema=[...translated.matchAll(new RegExp('<script type="application/ld[+]json">([^<]+)</script>','g'))].map(m=>JSON.parse(m[1]));
assert.equal(schema.find(j=>j['@type']==='FAQPage')?.mainEntity?.length,4);
assert.equal(schema.find(j=>j['@type']==='BreadcrumbList')?.itemListElement?.[1]?.item,'https://voy-pro.com/pt/ezraider/');


// Exercise the real mobile navigation initializer without a live browser:
// PT Marvão, Budapest and direct/home visitors must not inherit Budapest's
// generic network menu or lose local WhatsApp and translated language links.
const mobileStart=siteJs.indexOf('  function enhanceMobileNavigation(){');
const mobileEnd=siteJs.indexOf("  document.querySelectorAll('a.brand')",mobileStart);
assert.ok(mobileStart>0&&mobileEnd>mobileStart,'Mobile navigation initializer missing');
const mobileInit=siteJs.slice(mobileStart,mobileEnd);
assert.ok(siteJs.includes("const vehicleGuideSource=/^\\/(?:he\\/|hu\\/|pt\\/)?ezraider\\/$/.test(routePath)"),
  'Portuguese guide must be recognized by the shared runtime source resolver');
function renderVehicleMobile(lang,origin){
 let sheet,cloneCount=0;
 const n=()=>({setAttribute(){},addEventListener(){},focus(){},classList:{add(){},remove(){}},cloneNode(){return n();}});
 const close=n(),wa=n(),langRow={appendChild(){cloneCount++;}};
 const nav={firstChild:null,insertBefore(){}};
 const doc={
   body:{dataset:{intent:'vehicle'},appendChild(node){sheet=node;},classList:{add(){},remove(){}}},
   createElement(tag){
      const node=n();node.tag=tag;node.hidden=false;node.innerHTML='';
      node.querySelector=selector=>{
        if(selector==='.mobile-nav-close')return close;
        if(selector==='[data-mobile-language-row]')return node.innerHTML.includes('data-mobile-language-row')?langRow:null;
        if(selector==='[data-mobile-nav-wa]')return node.innerHTML.includes('data-mobile-nav-wa')?wa:null;
        return null;
      };
      node.querySelectorAll=()=>[];
      return node;
   },
   querySelector(selector){if(selector==='.navlinks')return nav;if(selector==='.nav-menu-toggle')return null;return null;},
   querySelectorAll(selector){return selector==='.language-picker .lang-switch'?[n(),n(),n(),n()]:[];}
 };
 const win={matchMedia(){return {matches:false,addEventListener(){}};}};
 const phone=(origin==='marvao'||origin==='marvao-pt')?'351935695004':'36300993099';
 vm.runInNewContext(mobileInit+'\nenhanceMobileNavigation();',{
  document:doc,window:win,locale:lang,isPortugalPage:false,isBudapestPage:false,
  vehicleGuideSource:origin,t:x=>x,whatsAppUrl:()=> 'https://wa.me/'+phone,
  track(){},localeBudapestCore(){return '/budapest/';},localeBudapestBooking(){return '/budapest/#booking';}
 },{timeout:1000});
 assert.ok(sheet?.innerHTML.includes('data-mobile-language-row'),'Vehicle menu must offer four languages');
 assert.equal(cloneCount,4,'Vehicle mobile menu must clone all four languages');
 return sheet.innerHTML;
}
const mobilePT=renderVehicleMobile('pt','marvao-pt');
assert.ok(mobilePT.includes('href="/pt/portugal/#request"'),'Portuguese Marvão mobile booking must route locally');
assert.ok(mobilePT.includes('href="https://wa.me/351935695004"'),'Marvão mobile WhatsApp must not use Budapest number');
assert.ok(mobilePT.includes('Budapeste · Hungria'),'Portuguese mobile menu needs localized destinations');
const mobileBudapest=renderVehicleMobile('en','budapest');
assert.ok(mobileBudapest.includes('href="/budapest/#booking"'),'Budapest mobile booking must stay local');
const mobileNoSource=renderVehicleMobile('pt',null);
assert.ok(mobileNoSource.includes('href="#choose-destination"'),'Unknown source must choose destination');
assert.ok(!mobileNoSource.includes('data-mobile-nav-wa'),'Unknown source must not default to Budapest WhatsApp');
const mobileHE=renderVehicleMobile('he','marvao');
assert.ok(mobileHE.includes('href="/he/portugal/#request"'),'Hebrew Marvão mobile booking must stay local');

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
for(const route of ['/ezraider/','/he/ezraider/','/hu/ezraider/','/pt/ezraider/'])assert.ok(sitemap.includes('https://voy-pro.com'+route));
assert.ok(!sitemap.includes('/budapest/ezraider/'));
console.log('Network EZRaider context and legacy redirect QA OK.');

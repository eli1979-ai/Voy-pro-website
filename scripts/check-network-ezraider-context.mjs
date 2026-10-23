import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const js=fs.readFileSync('site/assets/ezraider-context.js','utf8');
const siteJs=fs.readFileSync('site/assets/site.js','utf8');
const links=[
 ['site/index.html','/ezraider/?from=home'],
 ['site/budapest/index.html','/ezraider/?from=budapest'],
 ['site/he/budapest/index.html','/he/ezraider/?from=budapest'],
 ['site/hu/budapest/index.html','/hu/ezraider/?from=budapest'],
 ['site/portugal/index.html','/ezraider/?from=marvao'],
 ['site/he/portugal/index.html','/he/ezraider/?from=marvao'],
 ['site/pt/portugal/index.html','/pt/ezraider/?from=marvao-pt']
];
for(const [path,link] of links)assert.ok(fs.readFileSync(path,'utf8').includes('href="'+link+'"'),path+' loses origin-aware link');
for(const locale of ['','he/','hu/','pt/']){
 const html=fs.readFileSync('site/'+locale+'ezraider/index.html','utf8');
 assert.ok(html.includes('rel="canonical" href="https://voy-pro.com/'+locale+'ezraider/"'));
 assert.ok(html.includes('id="choose-destination"')&&html.includes('data-ez-context="back"'));
 assert.ok(html.includes('data-ez-context="booking"')&&html.includes('src="/assets/ezraider-context.js"'));
 assert.ok(!html.includes('href="/'+locale+'budapest/#booking"'));
 assert.ok(!html.includes('data-runtime-price'));
 for(const lang of ['en','he','hu','pt'])assert.ok(html.includes('hreflang="'+lang+'"'));
}
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

// Cross-locale and mobile source routing regressions. Portuguese must retain
// origin context when moving to EN/HE/HU and when using the mobile language row.
const ptToEn=run('?from=marvao-pt','pt','/ezraider/?from=home');
assert.equal(ptToEn.language.attributes.href,'/ezraider/?from=marvao-pt');
const ptToHe=run('?from=marvao-pt','pt','/he/ezraider/?from=home');
assert.equal(ptToHe.language.attributes.href,'/he/ezraider/?from=marvao-pt');
const enToPt=run('?from=budapest','en','/pt/ezraider/?from=home');
assert.equal(enToPt.language.attributes.href,'/pt/ezraider/?from=budapest');
const ptBody=fs.readFileSync('site/pt/ezraider/index.html','utf8');
assert.ok(!ptBody.includes('Budapestee'),'Portuguese destination label must be Budapeste');
assert.ok(ptBody.includes('hreflang="en" href="https://voy-pro.com/ezraider/"'),'Portuguese guide English hreflang must point to actual English page');
assert.ok(ptBody.includes('hreflang="x-default" href="https://voy-pro.com/ezraider/"'),'Neutral default must be network English canonical');
const siteStart=siteJs.indexOf("if(document.body?.dataset.intent==='vehicle'){",siteJs.indexOf('function enhanceMobileNavigation()'));
const siteEnd=siteJs.indexOf('}else if(!isPortugalPage&&!isBudapestPage){',siteStart);
assert.ok(siteStart>0&&siteEnd>siteStart,'Vehicle-specific mobile navigation branch required');
const mobileVehicle=siteJs.slice(siteStart,siteEnd);
for(const marker of ["data-mobile-language-row","data-ez-context=\\"back\\"","data-ez-context=\\"booking\\"","mobileOriginBooking","mobileMarvaoHome","mobileBudapestHome","mobileOrigin==='home'"]){
 assert.ok(mobileVehicle.includes(marker.replaceAll('\\\\','')),'Mobile guide navigation missing '+marker);
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

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
for(const route of ['/ezraider/','/he/ezraider/','/hu/ezraider/','/pt/ezraider/'])assert.ok(sitemap.includes('https://voy-pro.com'+route));
assert.ok(!sitemap.includes('/budapest/ezraider/'));
console.log('Network EZRaider context and legacy redirect QA OK.');

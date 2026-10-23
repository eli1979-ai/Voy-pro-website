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
 ['site/pt/portugal/index.html','/ezraider/?from=marvao-pt']
];
for(const [path,link] of links)assert.ok(fs.readFileSync(path,'utf8').includes('href="'+link+'"'),path+' loses origin-aware link');
for(const locale of ['','he/','hu/']){
 const html=fs.readFileSync('site/'+locale+'ezraider/index.html','utf8');
 assert.ok(html.includes('rel="canonical" href="https://voy-pro.com/'+locale+'ezraider/"'));
 assert.ok(html.includes('id="choose-destination"')&&html.includes('data-ez-context="back"'));
 assert.ok(html.includes('data-ez-context="booking"')&&html.includes('src="/assets/ezraider-context.js"'));
 assert.ok(!html.includes('href="/'+locale+'budapest/#booking"'));
 assert.ok(!html.includes('data-runtime-price'));
 for(const lang of ['en','he','hu'])assert.ok(html.includes('hreflang="'+lang+'"'));
}
const redirects=JSON.parse(fs.readFileSync('vercel.json','utf8')).redirects;
assert.equal(redirects.filter(r=>r.source.includes('/budapest/ezraider/')).length,3);
assert.ok(siteJs.includes("vehicleGuideSource==='marvao-pt'"));
function run(search,lang='en'){
 const actions={};
 const make=name=>({attributes:{'data-ez-context':name,href:'#choose-destination'},textContent:'Initial',setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]}});
 for(const key of ['back','booking','family','contact'])actions[key]=make(key);
 const language=make('lang');language.attributes.href='/he/ezraider/?from=home';
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
const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
for(const route of ['/ezraider/','/he/ezraider/','/hu/ezraider/'])assert.ok(sitemap.includes('https://voy-pro.com'+route));
assert.ok(!sitemap.includes('/budapest/ezraider/'));
console.log('Network EZRaider context and legacy redirect QA OK.');

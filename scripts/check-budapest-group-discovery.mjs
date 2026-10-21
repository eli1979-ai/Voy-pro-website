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
const videos=['1i2IQSShkQ8','fMcnMk6gzYA','NHWLOcUc8Vg'];
const styles=fs.readFileSync('site/assets/ezraider-guide.css','utf8');
const videoJs=fs.readFileSync('site/assets/ezraider-guide.js','utf8');
try{new vm.Script(videoJs,{filename:'ezraider-guide.js'});}
catch(error){failures.push('EZRaider interactive video script is invalid: '+error.message);}
for(const marker of [
  "www.youtube-nocookie.com/embed/",
  "addEventListener('click'",
  "replaceChildren(frame)",
  "aria-pressed",
  "youtube.com/watch?v="
])if(!videoJs.includes(marker))failures.push('EZRaider video player missing '+marker);
for(const vid of videos){
  if(!videoJs.includes(vid))failures.push('EZRaider approved video ID missing from player: '+vid);
}
if(videoJs.includes("document.write")||videoJs.includes("eval("))failures.push('EZRaider player uses unsafe dynamic execution');
for(const marker of ['.ez-video-screen','.ez-seat-grid','@media(max-width:620px)','prefers-reduced-motion'])
  if(!styles.includes(marker))failures.push('EZRaider layout missing '+marker);

for(const {locale,prefix,home} of vehicleFiles){
  const path='site/'+prefix+'budapest/ezraider/index.html';
  const html=fs.readFileSync(path,'utf8'),url='https://voy-pro.com/'+prefix+'budapest/ezraider/',href='/'+prefix+'budapest/ezraider/';
  for(const marker of [
    'lang="'+locale+'"','rel="canonical" href="'+url+'"',
    'property="og:image"', 'name="description"', 'data-ez-video-player',
    'href="'+manufacturer+'"','href="'+manufacturerManual+'"','family-child-seat-closeup.jpg',
    'Thule Yepp 2 Maxi Rack Mount','Thule Yepp Junior',
    'https://www.thule.com/', 'class="section ez-safety"', 'id="safety"',
    'href="/'+prefix+'budapest/#booking"', 'data-intent="vehicle"',
    'src="/assets/ezraider-guide.js"', 'href="/assets/ezraider-guide.css"'
  ])if(!html.includes(marker))failures.push(path+': missing '+marker);
  if(html.includes('https://www.ezraider.com/wp-content/uploads/2021/09/EZRaider-en.pdf'))failures.push(path+': outdated manufacturer manual redirect link remains');
  if(/(?:around ages 1.?3|גילאי 1.?3|1.?3 éves)/.test(html))failures.push(path+': child-seat suitability must not use unsupported local age band');
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

if(failures.length){
  console.error('Budapest group/corporate discovery guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest group/corporate discovery guard OK: EN/HE/HU home intent hubs expose both high-value paths.');

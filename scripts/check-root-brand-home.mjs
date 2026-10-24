import fs from 'node:fs';

const failures=[];
const read=p=>fs.readFileSync(p,'utf8');
const html=read('site/index.html');
const sitemap=read('site/sitemap.xml');
const siteJs=read('site/assets/site.js');
const vercel=JSON.parse(read('vercel.json'));

function requireText(source,text,label){if(!source.includes(text))failures.push(label);}
function forbidText(source,text,label){if(source.includes(text))failures.push(label);}

requireText(html,'<link href="https://voy-pro.com/" rel="canonical"/>','root homepage canonical missing');
requireText(html,'<h1>Choose how you want to explore.</h1>','root homepage H1 missing');
requireText(html,'href="/budapest/"','root homepage must link Budapest');
requireText(html,'href="/portugal/"','root homepage must link Portugal');
requireText(html,'href="/manage/"','root homepage must expose Manage Booking');
requireText(html,'class="hero-photo-frame parent-hero-mosaic"','root hero must use the destination-neutral mosaic');
requireText(html,'src="/assets/images/budapest/img12.jpg"','root hero must represent Budapest');
requireText(html,'src="/assets/images/portugal/marvao-01.jpg"','root hero must represent Marvão');
for(const [locale,path,image] of [
  ['budapest','/budapest/','/assets/images/budapest/img12.jpg'],
  ['marvao','/portugal/','/assets/images/portugal/marvao-01.jpg']
]){
  const entry=new RegExp('<a class="parent-hero-destination parent-hero-destination--'+locale+'" href="'+path.replaceAll('/','\\/')+'"[^>]*>[\\s\\S]*?<img[^>]*src="'+image.replaceAll('/','\\/')+'"[\\s\\S]*?<span class="parent-hero-caption">');
  if(!entry.test(html))failures.push('network photo/caption must link '+locale+' directly');
}
requireText(html,'<span class="parent-hero-caption">Hungary · Budapest</span>','Budapest image needs its own visible caption');
requireText(html,'<span class="parent-hero-caption">Portugal · Marvão</span>','Marvão image needs its own visible caption');
forbidText(html,'<figcaption>Hungary · Budapest · Portugal · Marvão</figcaption>','old combined image caption must disappear');
requireText(html,'class="section network-value-section"','network values need independently scoped closing spacing');
requireText(html,'class="section network-manage-section"','booking management must follow the trimmed final gap');
const css=read('site/assets/site.css');
requireText(css,'.parent-hero-mosaic .parent-hero-caption','individual photo caption style missing');
requireText(css,'body[data-page="/"] .network-value-section+.network-manage-section','network-only lower section rhythm missing');
requireText(html,'content="https://voy-pro.com/assets/brand/voy-pro-horizontal-dark.png" property="og:image"','root social card must use a VOY PRO parent-brand asset');
requireText(html,'content="https://voy-pro.com/assets/brand/voy-pro-horizontal-dark.png" name="twitter:image"','root Twitter card must use a VOY PRO parent-brand asset');
requireText(html,'name="twitter:title"','root Twitter card title missing');
requireText(html,'name="twitter:description"','root Twitter card description missing');
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
requireText(html,'Know what to expect','root local route guidance missing');
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

if(failures.length){
  console.error('VOY PRO root-brand guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('VOY PRO root-brand guard OK: root is destination-neutral and links the active destination journeys.');

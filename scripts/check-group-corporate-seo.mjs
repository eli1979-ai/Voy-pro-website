import fs from 'node:fs';

const pages=[
  {file:'site/budapest/group-tours/index.html',url:'https://voy-pro.com/budapest/group-tours/',image:'https://voy-pro.com/assets/images/budapest/img16.jpg',context:'group'},
  {file:'site/he/budapest/group-tours/index.html',url:'https://voy-pro.com/he/budapest/group-tours/',image:'https://voy-pro.com/assets/images/budapest/img16.jpg',context:'group'},
  {file:'site/hu/budapest/group-tours/index.html',url:'https://voy-pro.com/hu/budapest/group-tours/',image:'https://voy-pro.com/assets/images/budapest/img16.jpg',context:'group'},
  {file:'site/budapest/corporate-events/index.html',url:'https://voy-pro.com/budapest/corporate-events/',image:'https://voy-pro.com/assets/images/budapest/img15.jpg',context:'corporate'},
  {file:'site/he/budapest/corporate-events/index.html',url:'https://voy-pro.com/he/budapest/corporate-events/',image:'https://voy-pro.com/assets/images/budapest/img15.jpg',context:'corporate'},
  {file:'site/hu/budapest/corporate-events/index.html',url:'https://voy-pro.com/hu/budapest/corporate-events/',image:'https://voy-pro.com/assets/images/budapest/img15.jpg',context:'corporate'},
];

const failures=[];

for(const page of pages){
  const html=fs.readFileSync(page.file,'utf8');

  if(!html.includes('content="summary_large_image" name="twitter:card"')){
    failures.push(page.file+': large Twitter card missing');
  }
  if(!html.includes('content="'+page.image+'" property="og:image"')){
    failures.push(page.file+': og:image missing');
  }
  if(!html.includes('content="'+page.image+'" name="twitter:image"')){
    failures.push(page.file+': twitter:image missing');
  }

  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)]
    .map(match=>JSON.parse(match[1]));
  const service=scripts.find(value=>value['@type']==='Service');
  const crumbs=scripts.find(value=>value['@type']==='BreadcrumbList');

  if(!service){
    failures.push(page.file+': Service schema missing');
  }else{
    if(service.url!==page.url) failures.push(page.file+': Service URL mismatch');
    if(service.provider?.name!=='AllGo Guided Tours Bud Kft.') failures.push(page.file+': Service provider mismatch');
    if(service.areaServed?.name!=='Budapest') failures.push(page.file+': Service areaServed mismatch');
    if(service.offers&&Object.prototype.hasOwnProperty.call(service.offers,'price')){
      failures.push(page.file+': static Service price must not be published');
    }
  }

  const positions=crumbs?.itemListElement?.map(value=>value.position).join(',');
  if(positions!=='1,2,3') failures.push(page.file+': breadcrumb positions must be 1,2,3');
  const lastCrumb=crumbs?.itemListElement?.at(-1);
  if(lastCrumb?.item!==page.url) failures.push(page.file+': final breadcrumb must point to the current page');

  const directWhatsApp=(html.match(new RegExp('data-special-request="'+page.context+'"','g'))||[]).length;
  if(directWhatsApp<3){
    failures.push(page.file+': expected at least 3 prominent '+page.context+' WhatsApp request CTAs');
  }
  if(!/href="https:\/\/wa\.me\/36300993099(?:\?text=[^"]*)?"/.test(html)){
    failures.push(page.file+': Budapest WhatsApp fallback link missing');
  }
  if(!html.includes('#booking')){
    failures.push(page.file+': standard booking fallback must remain available');
  }
}

const siteJs=fs.readFileSync('site/assets/site.js','utf8');
for(const token of [
  "context==='group'?groupRequest",
  "context==='corporate'?corporateRequest",
  'groupRequest',
  'corporateRequest',
]){
  if(!siteJs.includes(token)) failures.push('site/assets/site.js: missing '+token);
}

if(failures.length){
  console.error('Group/corporate SEO + WhatsApp guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}

console.log('Group/corporate SEO + WhatsApp guard OK: EN/HE/HU social cards, Service schema, breadcrumbs and direct enquiry CTAs verified.');

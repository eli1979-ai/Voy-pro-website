import fs from 'node:fs';

const pages=[
  ['site/budapest/private-tours/index.html','https://voy-pro.com/budapest/private-tours/'],
  ['site/he/budapest/private-tours/index.html','https://voy-pro.com/he/budapest/private-tours/'],
  ['site/hu/budapest/private-tours/index.html','https://voy-pro.com/hu/budapest/private-tours/'],
];
const expectedImage='https://voy-pro.com/assets/images/budapest/img16.jpg';
const failures=[];

for(const [file,url] of pages){
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('content="summary_large_image" name="twitter:card"')) failures.push(file+': large Twitter card missing');
  if(!html.includes('content="'+expectedImage+'" property="og:image"')) failures.push(file+': og:image missing');
  if(!html.includes('content="'+expectedImage+'" name="twitter:image"')) failures.push(file+': twitter:image missing');

  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const service=scripts.find(v=>v['@type']==='Service');
  const crumbs=scripts.find(v=>v['@type']==='BreadcrumbList');
  if(!service) failures.push(file+': Service schema missing');
  else{
    if(service.url!==url) failures.push(file+': Service URL mismatch');
    if(service.provider?.name!=='AllGo Guided Tours Bud Kft.') failures.push(file+': Service provider mismatch');
    if(service.areaServed?.name!=='Budapest') failures.push(file+': Service areaServed mismatch');
    if(service.offers&&Object.prototype.hasOwnProperty.call(service.offers,'price')) failures.push(file+': static Service price must not be published');
  }
  if(!crumbs||crumbs.itemListElement?.map(v=>v.position).join(',')!=='1,2,3') failures.push(file+': breadcrumb positions must be 1,2,3');
}

if(failures.length){
  console.error('Private tour SEO guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Private tour SEO guard OK: social cards, Service schema and breadcrumbs verified across EN/HE/HU.');

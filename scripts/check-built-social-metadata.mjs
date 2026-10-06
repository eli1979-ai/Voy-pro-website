import fs from 'node:fs';
import path from 'node:path';

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>https:\/\/voy-pro\.com\/([^<]*)<\/loc>/g)].map(m=>m[1]);
const failures=[];

function pagePath(rel){
  const clean=String(rel||'').replace(/^\/+|\/+$/g,'');
  return path.join('dist',clean,'index.html');
}
function hasMeta(html,key,kind){
  const a=new RegExp('<meta[^>]+(?:'+kind+')="'+key+'"[^>]+content="[^"]+"','i');
  const b=new RegExp('<meta[^>]+content="[^"]+"[^>]+(?:'+kind+')="'+key+'"','i');
  return a.test(html)||b.test(html);
}
for(const rel of urls){
  const file=pagePath(rel);
  const html=fs.readFileSync(file,'utf8');
  const checks=[
    ['og:title','property'],
    ['og:description','property'],
    ['og:image','property'],
    ['og:url','property'],
    ['og:site_name','property'],
    ['twitter:card','name'],
    ['twitter:title','name'],
    ['twitter:description','name'],
    ['twitter:image','name'],
  ];
  for(const [key,kind] of checks){
    if(!hasMeta(html,key,kind))failures.push(file+': missing '+key);
  }
}
if(failures.length){
  console.error('Built social metadata completeness guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built social metadata completeness guard OK: '+urls.length+' sitemap pages expose complete OG + Twitter metadata.');

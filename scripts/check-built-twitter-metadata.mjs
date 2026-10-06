import fs from 'node:fs';
import path from 'node:path';

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>https:\/\/voy-pro\.com\/([^<]*)<\/loc>/g)].map(m=>m[1]);
const failures=[];

function pagePath(rel){
  const clean=String(rel||'').replace(/^\/+|\/+$/g,'');
  return path.join('dist',clean,'index.html');
}
for(const rel of urls){
  const file=pagePath(rel);
  const html=fs.readFileSync(file,'utf8');
  if(!/name="twitter:title"/i.test(html))failures.push(file+': missing twitter:title');
  if(!/name="twitter:description"/i.test(html))failures.push(file+': missing twitter:description');
}
if(failures.length){
  console.error('Built Twitter metadata guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built Twitter metadata guard OK: '+urls.length+' sitemap pages expose title and description.');

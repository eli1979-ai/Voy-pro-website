import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const site=path.join(root,'site');
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name);
  return e.isDirectory()?walk(p):[p];
});
const htmlFiles=walk(site).filter(p=>p.endsWith('.html'));
const rel=p=>path.relative(site,p).replaceAll('\\','/');
const read=p=>fs.readFileSync(p,'utf8');

const stagingRobots=read(path.join(site,'robots.txt'));
if(!/User-agent:\s*\*/i.test(stagingRobots)||!/Disallow:\s*\//i.test(stagingRobots)) throw new Error('Staging robots.txt must block indexing.');

const productionRobots=read(path.join(root,'launch','robots.production.txt'));
if(!/Allow:\s*\//i.test(productionRobots)||!productionRobots.includes('Sitemap: https://voy-pro.com/sitemap.xml')) throw new Error('Production robots plan is incomplete.');

const sitemap=read(path.join(site,'sitemap.xml'));
const sitemapUrls=[...sitemap.matchAll(/<loc>(https:\/\/voy-pro\.com\/[^<]*)<\/loc>/g)].map(m=>m[1]);
if(!sitemapUrls.length) throw new Error('Production sitemap is empty.');

for(const file of htmlFiles){
  const p=rel(file), html=read(file);
  const is404=p==='404.html', isManage=p.startsWith('manage/');
  const canonical=(html.match(/<link href="([^"]+)" rel="canonical"\/>/)||[])[1];
  if(!is404&&!isManage){
    if(!canonical) throw new Error('Canonical missing: '+p);
    if(!canonical.startsWith('https://voy-pro.com/')) throw new Error('Canonical host invalid: '+p);
  }
  if(/https?:\/\/(?:www\.)?ezraidereu\.com\/budapest\/(?!wp-content\/)/i.test(html)) throw new Error('Legacy Budapest page link remains: '+p);
}

for(const url of sitemapUrls){
  const pathname=new URL(url).pathname.replace(/^\//,'').replace(/\/$/,'');
  const file=path.join(site,pathname,'index.html');
  if(!fs.existsSync(file)) throw new Error('Sitemap target missing: '+url);
  const html=read(file);
  const canonical=(html.match(/<link href="([^"]+)" rel="canonical"\/>/)||[])[1];
  if(canonical!==url) throw new Error('Sitemap/canonical mismatch: '+url+' -> '+canonical);
}

for(const langPath of ['budapest/where-to-stay/index.html','he/budapest/where-to-stay/index.html','hu/budapest/where-to-stay/index.html']){
  const html=read(path.join(site,langPath));
  if(!html.includes('data-intent="lodging"')) throw new Error('Where-to-stay intent regression: '+langPath);
  if(!html.includes('href="#booking"')) throw new Error('Where-to-stay local booking CTA missing: '+langPath);
  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const crumbs=scripts.find(v=>v['@type']==='BreadcrumbList');
  if(!crumbs||crumbs.itemListElement?.map(v=>v.position).join(',')!=='1,2,3') throw new Error('Where-to-stay breadcrumb invalid: '+langPath);
}

const redirects=read(path.join(root,'launch','redirect-map.csv')).trim().split(/\r?\n/);
if(redirects.length<6) throw new Error('Legacy redirect map is unexpectedly small.');

const vercel=JSON.parse(read(path.join(root,'vercel.json')));
if(!vercel.redirects?.some(r=>r.source==='/'&&r.destination==='/budapest/'&&r.permanent===true)) throw new Error('Root redirect must be permanent.');

console.log('Launch readiness contract OK:', htmlFiles.length, 'HTML files,', sitemapUrls.length, 'sitemap URLs.');

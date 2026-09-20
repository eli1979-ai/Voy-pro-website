import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const cssPath=path.join(dist,'assets','site.css');
fs.appendFileSync(cssPath,`
/* v1.32.2 — preserve full photography + persistent destination switch */
.hero-photo-frame{height:auto!important;min-height:0!important}
.hero-photo-frame img{width:100%;height:auto!important;min-height:0!important;aspect-ratio:auto!important;object-fit:contain!important;object-position:center!important}
.photo-gallery-grid{display:block!important;column-count:3;column-gap:12px}
.photo-tile,.photo-tile.wide{display:inline-block;width:100%;margin:0 0 12px;aspect-ratio:auto!important;break-inside:avoid;overflow:hidden}
.photo-tile img{width:100%;height:auto!important;min-height:0!important;aspect-ratio:auto!important;object-fit:contain!important;object-position:center!important}
.photo-tile:hover img{transform:none}
header .destination-switch{display:inline-flex;align-items:center;white-space:nowrap;text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:8px 11px;font-size:12px;font-weight:900;color:var(--ink);background:#fff}
header .destination-switch:after{content:"↗";font-size:10px;margin-inline-start:5px;color:var(--blue)}
@media(max-width:800px){.photo-gallery-grid{column-count:2}.nav{gap:10px}header .destination-switch{padding:7px 9px;font-size:11px}.brand{flex:0 0 auto}}
@media(max-width:480px){.photo-gallery-grid{column-count:1}header .destination-switch{padding:6px 8px;font-size:10px}}
`);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function localeFor(rel){if(rel.startsWith('he/'))return'he';if(rel.startsWith('hu/'))return'hu';return'en';}
for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(dist,file).replaceAll('\\','/');
  if(!/^(?:he\/|hu\/)?budapest\//.test(rel))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<a class="destination-nav" href="[^"]+">[^<]+<\/a>/g,'');
  html=html.replace(/<a href="\/portugal\/">Portugal<\/a>/g,'');
  html=html.replace(/<a href="\/portugal\/">Portugália<\/a>/g,'');
  html=html.replace(/<a href="\/he\/portugal\/">פורטוגל<\/a>/g,'');
  const locale=localeFor(rel);
  const href=locale==='he'?'/he/portugal/':'/portugal/';
  const label=locale==='he'?'פורטוגל':locale==='hu'?'Portugália':'Portugal';
  const sw=`<a class="destination-switch" data-destination-switch="portugal" href="${href}">${label}</a>`;
  html=html.replace(/(<a class="brand"[^>]*>VOY<span>PRO<\/span><\/a>)/i,`$1${sw}`);
  fs.writeFileSync(file,html);
}
const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.2';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.2 full-photo and destination-switch fixes.');

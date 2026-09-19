import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const cssPath=path.join(dist,'assets','site.css');

fs.appendFileSync(cssPath,`
/* v1.32.3 — location selector */
header .destination-switch{display:none!important}
.location-switcher{position:relative;display:inline-block;flex:0 0 auto}
.location-switcher summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:8px 11px;background:#fff;font-size:12px;font-weight:900;color:var(--ink);white-space:nowrap}
.location-switcher summary::-webkit-details-marker{display:none}
.location-switcher summary:after{content:"▾";font-size:10px;color:var(--blue)}
.location-switcher[open] summary{border-color:rgba(13,77,124,.35);box-shadow:0 8px 24px rgba(13,21,29,.08)}
.location-menu{position:absolute;z-index:80;inset-inline-start:0;top:calc(100% + 8px);min-width:210px;padding:7px;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 45px rgba(13,21,29,.16)}
.location-menu a,.location-menu span{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 11px;border-radius:10px;text-decoration:none;color:var(--ink);font-size:13px;font-weight:800}
.location-menu a:hover{background:var(--soft)}
.location-menu .current{background:var(--soft);color:var(--blue)}
.location-menu .current:after{content:"✓";font-weight:900}
@media(max-width:800px){.location-switcher summary{padding:7px 9px;font-size:11px}.location-menu{min-width:190px}}
@media(max-width:480px){.location-switcher summary{padding:6px 8px;font-size:10px}.location-menu{min-width:175px}}
`);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function localeFor(rel){
  if(rel.startsWith('he/')) return 'he';
  if(rel.startsWith('hu/')) return 'hu';
  if(rel.startsWith('pt/')) return 'pt';
  return 'en';
}
function selector(locale,current){
  const labels={
    en:{bud:'Budapest',pt:'Portugal · Marvão',aria:'Choose location'},
    he:{bud:'בודפשט',pt:'פורטוגל · מרבאו',aria:'בחירת לוקיישן'},
    hu:{bud:'Budapest',pt:'Portugália · Marvão',aria:'Helyszín kiválasztása'},
    pt:{bud:'Budapeste',pt:'Portugal · Marvão',aria:'Escolher localização'}
  }[locale]||null;
  const budHref=locale==='he'?'/he/budapest/':locale==='hu'?'/hu/budapest/':'/budapest/';
  const ptHref=locale==='he'?'/he/portugal/':locale==='pt'?'/pt/portugal/':'/portugal/';
  const summary=current==='bud'?labels.bud:labels.pt;
  const budItem=current==='bud'?'<span class="current">'+labels.bud+'</span>':'<a href="'+budHref+'">'+labels.bud+'</a>';
  const ptItem=current==='pt'?'<span class="current">'+labels.pt+'</span>':'<a href="'+ptHref+'">'+labels.pt+'</a>';
  return '<details class="location-switcher"><summary aria-label="'+labels.aria+'">'+summary+'</summary><div class="location-menu">'+budItem+ptItem+'</div></details>';
}

for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(dist,file).replaceAll('\\','/');
  const isBud=/^(?:he\/|hu\/)?budapest\//.test(rel);
  const isPt=/^(?:he\/|pt\/)?portugal\//.test(rel);
  if(!isBud&&!isPt) continue;

  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<a class="destination-switch"[^>]*>[^<]*<\/a>/g,'');
  html=html.replace(/<details class="location-switcher">[\s\S]*?<\/details>/g,'');
  const locale=localeFor(rel);
  const current=isBud?'bud':'pt';
  const sw=selector(locale,current);
  html=html.replace(/(<a class="brand"[^>]*>VOY<span>PRO<\/span><\/a>)/i,'$1'+sw);
  fs.writeFileSync(file,html);
}

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.3';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.3 location selector.');

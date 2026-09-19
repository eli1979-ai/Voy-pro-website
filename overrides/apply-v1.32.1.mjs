import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dist=path.join(root,'dist');
const cssPath=path.join(dist,'assets','site.css');
const css=`
/* v1.32.1 — photo framing + destination navigation */
.hero-photo-frame{height:auto;min-height:0;background:#101820}
.hero-photo-frame img{height:auto;min-height:0;aspect-ratio:4/3;object-fit:cover;object-position:center 72%}
.photo-gallery-grid{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:auto}
.photo-tile,.photo-tile.wide{grid-column:span 1;aspect-ratio:3/2}
.photo-tile img{min-height:0;aspect-ratio:auto;object-fit:cover;object-position:center 72%}
@media(min-width:801px) and (max-width:1180px){.nav-menu-toggle{display:inline-flex}.navlinks{gap:9px}.navlinks>a:not(.destination-nav):not(.btn){display:none}.navlinks>.btn{display:none}.navlinks .destination-nav{display:inline-flex;font-size:12px;font-weight:900}}
@media(max-width:800px){.hero-photo-frame img{aspect-ratio:4/3;object-position:center 72%}.photo-gallery-grid{grid-template-columns:1fr 1fr;grid-auto-rows:auto}.photo-tile,.photo-tile.wide{grid-column:span 1;aspect-ratio:3/2}.photo-tile.wide{grid-column:span 2;aspect-ratio:3/2}}
@media(max-width:480px){.photo-gallery-grid{grid-template-columns:1fr}.photo-tile,.photo-tile.wide{grid-column:span 1;aspect-ratio:3/2}}
`;
fs.appendFileSync(cssPath,css);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(dist,file).replaceAll('\\','/');
  if(!/^(?:he\/|hu\/)?budapest\//.test(rel)) continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<a href="\/portugal\/">Portugal<\/a>/g,'<a class="destination-nav" href="/portugal/">Portugal</a>');
  html=html.replace(/<a href="\/portugal\/">Portugália<\/a>/g,'<a class="destination-nav" href="/portugal/">Portugália</a>');
  html=html.replace(/<a href="\/he\/portugal\/">פורטוגל<\/a>/g,'<a class="destination-nav" href="/he/portugal/">פורטוגל</a>');
  fs.writeFileSync(file,html);
}
const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.1';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.1 photo/navigation polish.');

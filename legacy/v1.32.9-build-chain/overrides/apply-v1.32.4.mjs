import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const cssPath=path.join(dist,'assets','site.css');

fs.appendFileSync(cssPath,`
/* v1.32.4 — unified VOY PRO + location brand lockup */
.nav>.brand{font-size:22px;letter-spacing:.02em;line-height:1;font-weight:950}
.nav>.brand span{font-weight:950}
.location-switcher{margin-inline-start:-2px}
.location-switcher:before{content:"";display:inline-block;width:1px;height:22px;background:var(--line);vertical-align:middle;margin-inline:10px 8px}
.location-switcher summary{
  display:inline-flex;
  align-items:center;
  gap:7px;
  border:0!important;
  border-radius:0!important;
  padding:0!important;
  background:transparent!important;
  box-shadow:none!important;
  color:var(--ink);
  font-size:17px;
  line-height:1;
  font-weight:850;
  letter-spacing:-.01em;
}
.location-switcher summary:after{content:"▾";font-size:10px;color:var(--blue);transform:translateY(1px)}
.location-switcher[open] summary{color:var(--blue)}
.location-menu{top:calc(100% + 14px);inset-inline-start:18px}
@media(max-width:800px){
  .nav>.brand{font-size:19px}
  .location-switcher:before{height:19px;margin-inline:8px 7px}
  .location-switcher summary{font-size:15px}
  .location-menu{inset-inline-start:12px}
}
@media(max-width:480px){
  .nav>.brand{font-size:18px}
  .location-switcher:before{height:18px;margin-inline:7px 6px}
  .location-switcher summary{font-size:14px}
  .location-menu{inset-inline-start:8px}
}
`);

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.4';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.4 unified brand lockup.');

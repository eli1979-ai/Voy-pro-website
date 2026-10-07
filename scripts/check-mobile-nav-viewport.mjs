import fs from 'node:fs';

const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

const requiredCss=[
  'max-height:calc(100vh - 12px)',
  'max-height:calc(100dvh - max(12px,env(safe-area-inset-top,0px)))',
  'overflow-y:auto',
  'overscroll-behavior:contain'
];
for(const token of requiredCss){
  if(!css.includes(token)) failures.push('mobile navigation card missing '+token);
}
const budapestStart=js.indexOf("sheet.innerHTML=`<div class=\"mobile-nav-card\"");
const portugalStart=js.indexOf("else if(isPortugalPage)");
if(budapestStart<0 || portugalStart<0) failures.push('mobile navigation fixtures missing');
if(!css.includes('.nav-open{overflow:hidden}')) failures.push('expected body scroll lock while mobile navigation is open');

if(failures.length){
  console.error('Mobile navigation viewport guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile navigation viewport guard OK: tall navigation sheets remain scrollable within short/landscape viewports.');

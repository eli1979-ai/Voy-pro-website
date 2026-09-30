import {readFile,stat} from 'node:fs/promises';

const cssFile='site/assets/site.css';
const jsFile='site/assets/site.js';
const assets=[
  'site/assets/brand/voy-pro-horizontal-dark.png',
  'site/assets/brand/voy-pro-horizontal-light.png',
  'site/assets/brand/voy-pro-symbol.png',
];
const [css,js]=await Promise.all([readFile(cssFile,'utf8'),readFile(jsFile,'utf8')]);
const failures=[];

for(const asset of assets){
  try{
    const info=await stat(asset);
    if(!info.isFile()||info.size<1000)failures.push(asset+': missing or unexpectedly small');
  }catch{
    failures.push(asset+': missing');
  }
}

for(const token of [
  "background-image:url('/assets/brand/voy-pro-horizontal-dark.png')",
  "background-image:url('/assets/brand/voy-pro-horizontal-light.png')",
  '/* VOY PRO official brand assets */',
  'header .brand',
  'footer .brand',
])if(!css.includes(token))failures.push(cssFile+': missing '+token);

for(const token of [
  "favicon.href='/assets/brand/voy-pro-symbol.png'",
  "apple.href='/assets/brand/voy-pro-symbol.png'",
  "favicon.dataset.voyBrandIcon='favicon'",
  "apple.dataset.voyBrandIcon='apple-touch'",
])if(!js.includes(token))failures.push(jsFile+': missing '+token);

if(failures.length){
  console.error('VOY official website brand-assets guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log(
  'VOY official website brand-assets guard passed: official horizontal logo assets render in the shared header/footer and the official symbol is wired as favicon/app icon.'
);

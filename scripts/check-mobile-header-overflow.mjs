import fs from 'node:fs';

const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

if(!/@media\(max-width:800px\)\{\s*header \.navlinks>\.language-picker\{display:none!important\}\s*\}/m.test(css)){
  failures.push('mobile header must hide the duplicated desktop language picker with !important so it overrides the earlier mobile visibility rule');
}
if(!/@media\(max-width:370px\)\{\s*header \.location-switcher\{display:none\}\s*\}/m.test(css)){
  failures.push('very narrow mobile header must move the location switcher into the menu');
}
if(!/document\.querySelectorAll\('\.language-picker \.lang-switch'\)/.test(js) || !/data-mobile-language-row/.test(js)){
  failures.push('mobile navigation must retain the language choices when the header picker is hidden');
}
if(!/isPortugalPage[\s\S]*Budapest/.test(js) || !/Explore Budapest[\s\S]*Portugal · Marvão/.test(js)){
  failures.push('mobile navigation must retain cross-destination access when the narrow header location chip is hidden');
}
if(failures.length){
  console.error('Mobile header overflow guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile header overflow guard OK: redundant header controls collapse on narrow screens while language/location remain in the mobile menu.');

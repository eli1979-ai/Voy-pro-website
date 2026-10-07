import fs from 'node:fs';

const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

if(/header \.navlinks>\.language-picker\{display:none!important\}/.test(css)){
  failures.push('mobile header must not hide the top language picker');
}
if(/data-mobile-language-row/.test(js) || /querySelectorAll\('\.language-picker \.lang-switch'\)/.test(js)){
  failures.push('mobile menu must not contain or clone the language picker');
}
for(const token of [
  '@media(max-width:430px)',
  'header .brand{width:110px;height:38px',
  '.nav{gap:6px}',
  '.navlinks{gap:4px;min-width:0}',
  'header .language-picker .lang-switch{display:inline-flex!important;padding:4px 4px;font-size:9px',
  '.nav-menu-toggle{padding:7px 8px;font-size:10px'
]){
  if(!css.includes(token))failures.push('compact top-header rule missing: '+token);
}
if(!/@media\(max-width:370px\)\{[\s\S]*?header \.location-switcher\{display:none\}/m.test(css)){
  failures.push('very narrow mobile header must still hide the location switcher');
}
if(!/isPortugalPage[\s\S]*Budapest/.test(js) || !/Explore Budapest[\s\S]*Portugal · Marvão/.test(js)){
  failures.push('mobile navigation must retain cross-destination access when the narrow header location switcher is hidden');
}

if(failures.length){
  console.error('Mobile header overflow guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile header overflow guard OK: language stays in the top header, never in the menu, with compact narrow-screen controls.');

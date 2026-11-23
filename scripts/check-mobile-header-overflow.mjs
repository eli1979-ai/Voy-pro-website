import fs from 'node:fs';

const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

if(/header \.navlinks>\.language-picker\{display:none!important\}/.test(css)){
  failures.push('mobile header must not hide the top language picker');
}
if(!/@media\(max-width:800px\)\{[\s\S]*header \.navlinks>\.language-picker\{display:inline-flex!important;flex:0 1 auto;min-width:0/m.test(css)){
  failures.push('mobile header must keep a shrinkable top language strip visible');
}
if(!/@media\(max-width:520px\)\{\s*header \.location-switcher\{display:none\}\s*\}/m.test(css)){
  failures.push('narrow mobile header must move the destination selector into the menu before language controls can overflow');
}
if(!/@media\(max-width:380px\)\{[\s\S]*header \.navlinks>\.language-picker \.lang-switch\{padding:5px 4px;font-size:12px\}/m.test(css)){
  failures.push('very narrow header must compact language chips instead of hiding them');
}
if(!/document\.querySelectorAll\('\.language-picker \.lang-switch'\)/.test(js) || !/data-mobile-language-row/.test(js)){
  failures.push('mobile navigation must retain duplicate language access in the sheet');
}
if(!/isPortugalPage[\s\S]*Budapest/.test(js) || !/Explore Budapest[\s\S]*Portugal · Marvão/.test(js)){
  failures.push('mobile navigation must retain cross-destination access when the narrow header location selector is hidden');
}
if(failures.length){
  console.error('Mobile header overflow guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile header overflow guard OK: languages stay visible at the top while destination controls collapse before narrow-screen overflow.');

const dr04Js=fs.readFileSync('site/assets/site.js','utf8');
if(!(dr04Js.includes("const order=['en','he','hu','es','pt']")&&
 dr04Js.includes('picker.appendChild(a)')&&dr04Js.includes('if(picker)')))
 throw new Error('DR-04 shared locale ordering adapter missing');
if(!(css.includes('header:has(.nav-menu-toggle) .location-switcher{display:none}')&&
 css.includes('header .navlinks > a,header .navlinks > .language-picker .lang-switch')))
 throw new Error('DR-04 single tablet menu and desktop nonwrap rules missing');

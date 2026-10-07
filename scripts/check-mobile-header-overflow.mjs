import fs from 'node:fs';

const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const need=(condition,label)=>{if(!condition)failures.push(label);};

need(!css.includes('header .navlinks>.language-picker{display:none!important}'),'mobile header still hides the language picker');
need(css.includes('header .navlinks>.language-picker{\n    display:inline-flex!important;'),'mobile header does not force the language picker visible');
need(css.includes('header .language-picker .lang-switch::after{\n    content:attr(hreflang);'),'mobile language labels are not compact hreflang codes');
need(css.includes('@media(max-width:390px){')&&css.includes('header .brand{width:104px}'),'narrow-mobile brand does not shrink enough to protect header width');
need(css.includes('@media(max-width:370px){\n  header .location-switcher{display:none}\n}'),'very narrow mobile header must hide only the location switcher');
need(!js.includes('data-mobile-language-row'),'mobile menu still contains a duplicate language row');
need(!js.includes("document.querySelectorAll('.language-picker .lang-switch')"),'mobile menu still clones header language links');
need(js.includes('isPortugalPage')&&js.includes('Explore Budapest')&&js.includes('Portugal · Marvão'),'mobile menu lost cross-destination access when languages moved back to the header');

if(failures.length){
  console.error('Mobile header language guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile header language guard OK: languages stay in the top header with compact codes and no duplicate menu row.');

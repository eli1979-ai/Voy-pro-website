import {readFileSync} from 'node:fs';
const pages=[
  ['site/budapest/index.html',[/From €120 per rider/,/From €70 per rider/,/From €100 per rider/]],
  ['site/he/budapest/index.html',[/מ־€120 לרוכב/,/מ־€70 לרוכב/,/מ־€100 לרוכב/]],
  ['site/hu/budapest/index.html',[/120 €-tól \/ fő/,/70 €-tól \/ fő/,/100 €-tól \/ fő/]]
];
const failures=[];
for(const [file,patterns] of pages){
  const html=readFileSync(file,'utf8');
  for(const pattern of patterns)if(!pattern.test(html))failures.push(file+': missing approved starting price '+pattern);
  const citadella=html.match(/data-tour-image="citadella"[\s\S]*?<\/article>/)?.[0]||'';
  if(!/Team approval required|נדרש אישור הצוות|Csapatjóváhagyás szükséges/.test(citadella))failures.push(file+': Citadella approval warning missing');
  const extended=html.match(/data-tour-image="extended"[\s\S]*?<\/article>/)?.[0]||'';
  if(/data-tour-price/.test(extended))failures.push(file+': inactive extended tour must not depend on live FBM price');
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Budapest starting price and eligibility guard OK (EN/HE/HU).');

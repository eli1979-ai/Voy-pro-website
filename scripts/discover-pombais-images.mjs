import {writeFile} from 'node:fs/promises';
const urls=[
  'https://www.pombais.pt/turismo/en/tour/ezrider/',
  'https://www.pombais.pt/turismo/tour/ezrider/'
];
const all=[];
for (const url of urls){
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 VOY-PRO-image-audit/1.0'}});
  const html=await r.text();
  const found=[...html.matchAll(/https?:[^"'\s<>]+\/wp-content\/uploads\/[^"'\s<>]+/g)].map(m=>m[0].replace(/&amp;/g,'&'));
  for(const x of found){
    if(/ez|raider|WhatsApp|image000|caption|637d469f|ba150043|bf9511da|6579a6a7|e40965f6|418d0f14/i.test(x)) all.push(x);
  }
}
await writeFile('site/__pombais-images.txt',[...new Set(all)].join('\n')+'\n');
console.log('POMBAIS_IMAGE_URLS_START');
for(const x of [...new Set(all)]) console.log(x);
console.log('POMBAIS_IMAGE_URLS_END');
console.log('Pombais images discovered:',new Set(all).size);

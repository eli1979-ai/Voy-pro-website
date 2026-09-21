const urls=[
  'https://www.pombais.pt/turismo/en/tour/ezrider/',
  'https://www.pombais.pt/turismo/tour/ezrider/'
];
for (const url of urls){
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 VOY-PRO-image-audit/1.0'}});
  console.log('POMBAIS_FETCH',url,r.status);
  const html=await r.text();
  const found=[...html.matchAll(/https?:[^"'\s<>]+\/wp-content\/uploads\/[^"'\s<>]+/g)].map(m=>m[0].replace(/&amp;/g,'&'));
  const clean=[...new Set(found)].filter(u=>/ez|raider|WhatsApp|image000|caption|637d469f|ba150043|bf9511da|6579a6a7|e40965f6|418d0f14/i.test(u));
  console.log('POMBAIS_IMAGE_URLS_START');
  for(const x of clean) console.log(x);
  console.log('POMBAIS_IMAGE_URLS_END');
}
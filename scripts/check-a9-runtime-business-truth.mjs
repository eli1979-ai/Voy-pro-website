import {readFile} from 'node:fs/promises';

const source=await readFile('site/assets/site.js','utf8');
const failures=[];

for(const [label,pattern] of [
  ['hardcoded Budapest catalog fallback',/fallbackBudapestProducts/],
  ['hardcoded Budapest guide-language availability',/BUDAPEST_GUIDE_LANGUAGES/],
  ['hardcoded home fallback price',/From €70/],
  ['hardcoded runtime duration',/durationMinutes\s*:\s*120/],
  ['hardcoded runtime base price',/basePrice\s*:\s*70/],
  ['hardcoded runtime from price',/priceFrom\s*:\s*70/],
  ['hardcoded runtime capacity',/maxIndependentRiders\s*:\s*12/],
  ['hardcoded runtime private surcharge',/privateSurchargePerRider\s*:\s*30/],
  ['hardcoded runtime private minimum',/privateMinRiders\s*:\s*2/],
  ['private-minimum default fallback',/privateMinRiders\s*\|\|\s*2/],
  ['catalog currency default fallback',/product\.currency\s*\|\|\s*['"]EUR['"]/],
]){
  if(pattern.test(source))failures.push(label);
}

for(const marker of [
  "products=await api('/experiences',{method:'GET',timeoutMs:5000})",
  "if(!Array.isArray(products)||!products.length)throw new Error('PUBLIC_CATALOG_EMPTY')",
  "t('Live price at booking','מחיר חי בהזמנה')",
  "select.disabled=languages.length===0",
]){
  if(!source.includes(marker))failures.push('missing API-only catalog marker: '+marker);
}

if(failures.length){
  console.error('A9.1 runtime business-truth guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('A9.1 runtime business-truth guard passed: catalog-backed runtime values come only from FBM.');

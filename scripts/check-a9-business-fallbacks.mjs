import {readFileSync} from 'node:fs';

const js=readFileSync('site/assets/site.js','utf8');
const failures=[];

function requireText(text,label){
  if(!js.includes(text))failures.push(label);
}
function forbidText(text,label){
  if(js.includes(text))failures.push(label);
}

requireText("api('/experiences',{method:'GET',timeoutMs:5000})","Budapest catalog must come from the FBM experiences endpoint");
requireText("function setCatalogUnavailable(","catalog failure must enter an explicit degraded state");
requireText("Live price unavailable","catalog outage must replace static runtime price with an unavailable state");
requireText("CATALOG_EMPTY","empty FBM catalog must not be treated as valid business data");
requireText("CATALOG_NO_BOOKABLE_PRODUCTS","catalog without bookable products must degrade safely");
requireText("form._updateGuideLanguages=(products=[])=>","special-request languages must derive from live catalog products");

forbidText("function fallbackBudapestProducts","runtime must not carry a fallback Budapest product catalog");
forbidText("BUDAPEST_GUIDE_LANGUAGES","runtime must not carry fallback Budapest guide languages");
forbidText("durationMinutes:120,basePrice:70","runtime must not carry fallback tour duration/price");
forbidText("basePrice:70","runtime must not carry fallback Budapest base price");
forbidText("priceFrom:70","runtime must not carry fallback Budapest display price");
forbidText("maxIndependentRiders:12","runtime must not carry fallback Budapest capacity");
forbidText("privateSurchargePerRider:30","runtime must not carry fallback private surcharge");
forbidText("privateMinRiders||2","runtime must not default private minimum riders");
forbidText("durationMinutes||120","runtime must not default tour duration");
forbidText("products=fallbackBudapestProducts()","catalog errors must not create synthetic products");

if(failures.length){
  console.error('A9.2b Budapest business-fallback guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('A9.2b Budapest business-fallback guard OK.');

import {readFileSync} from 'node:fs';

const site=readFileSync('site/assets/site.js','utf8');
const failures=[];

function requireText(text,label){
  if(!site.includes(text))failures.push(label);
}
function forbidText(text,label){
  if(site.includes(text))failures.push(label);
}

forbidText('function fallbackBudapestProducts','fabricated Budapest catalog fallback must not return');
forbidText('catalogFallback','catalog outage must not be represented as a fallback catalog mode');
forbidText("price.textContent=t('From €70'","home runtime must not inject a hardcoded Budapest price");
forbidText("durationMinutes:120,basePrice:70","runtime must not embed fallback duration/price business facts");
forbidText("privateSurchargePerRider:30","runtime must not embed fallback private-tour pricing");
forbidText("maxIndependentRiders:12","runtime must not embed fallback rider capacity");

requireText("const products=await api('/experiences'","Budapest catalog must come from the FBM public catalog endpoint");
requireText("if(!Array.isArray(products)||!products.length)throw new Error('CATALOG_EMPTY')","empty catalog must fail closed");
requireText("setCatalogUnavailableUI(selects)","catalog failure must switch to a truthful unavailable state");
requireText("submit.disabled=true","booking submit must be disabled before/when canonical catalog is unavailable");
requireText("catalogLoadingLabel()","runtime must show a neutral loading state before canonical catalog arrives");
requireText("catalogUnavailableLabel()","runtime must show a neutral unavailable state on catalog failure");

if(failures.length){
  console.error('A9.2b catalog source-of-truth guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('A9.2b catalog source-of-truth guard OK.');

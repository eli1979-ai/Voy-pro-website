import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const paymentSelectionFrozen=()=>select.closest('#live-checkout-form')?.dataset.submitting==='true'||Boolean(select.closest('#live-checkout-shell')?.hasAttribute('data-submit-locked'));",'payment capability UI freeze predicate is missing');
const frozenChecks=(js.match(/if\(paymentSelectionFrozen\(\)\)return;/g)||[]).length;
if(frozenChecks<2)failures.push('both successful and failed late capability responses must leave a submitted/retry-locked payment UI unchanged');
requireText('if(onlineReady&&!paymentSelectionTouched){','pre-submit capability defaulting must still respect explicit customer interaction');
requireText('setCheckoutSubmissionLock(true);','checkout submit must establish the UI lock consumed by payment capability hydration');

if(failures.length){
  console.error('Payment capability UI freeze guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Payment capability UI freeze guard OK: late capability responses cannot change the payment UI after submit/retry state is frozen.');

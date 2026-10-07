import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('function setCheckoutSubmissionLock(locked){','checkout submission lock helper is missing');
requireText("#live-checkout-form input,#live-checkout-form select,#live-checkout-form button,[data-checkout-edit]",'customer/payment/edit controls are not included in the submit lock');
requireText("[data-ancillary-upsell] button",'ancillary mutation controls are not included in the submit lock');
requireText("control.dataset.submitLockWasDisabled=control.disabled?'true':'false';",'submit lock does not preserve prior disabled state');
requireText('setCheckoutSubmissionLock(true);','checkout mutations are not locked before the async submit begins');
requireText('if(!terminal)enableCheckoutRetryActions();','recoverable submit failures do not expose safe retry actions while keeping the payload locked');
requireText('recoverExpiredHold=true;','expired-hold recovery path is not distinguished from terminal success');
requireText('setCheckoutSubmissionLock(false);\n        bookingState.submissionSnapshot=null;\n        lockExpiredCheckout({focusRecovery:true});','expired-hold recovery must clear the retry snapshot, restore Change selection and then apply the stale-checkout lock');

if(failures.length){
  console.error('Checkout submit mutation lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout submit mutation lock guard OK: mutable payload controls stay locked through in-flight work and safe retry.');

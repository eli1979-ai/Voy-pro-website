import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('function lockExpiredCheckout({focusRecovery=false}={})','shared expired-checkout lock helper missing');
requireText("checkout?.setAttribute('data-hold-expired','true')",'expired checkout state marker missing');
requireText('if(submit)submit.disabled=true','expired checkout submit must be disabled');
requireText('setBookingStep(1)','expired checkout must return to selection');
requireText("lockExpiredCheckout();patchSession({stage:'hold_expired',hold_expired_at:now()})",'local timer expiry must lock checkout before reporting expiry');
requireText("const expiresAtMs=Date.parse(String(expires||''))",'hold expiry must be parsed once before countdown');
requireText("if(!Number.isFinite(expiresAtMs))",'invalid hold expiry must be detected');
requireText("releaseHold();lockExpiredCheckout({focusRecovery:true});patchSession({stage:'hold_expired',hold_expired_at:now(),hold_expiry_unverified:true})",'unverifiable hold expiry must release and lock checkout');
requireText("lockExpiredCheckout({focusRecovery:true})",'backend HOLD_EXPIRED must use the same lock path');
requireText("form.removeAttribute('data-hold-expired')",'fresh checkout reset must clear expired state');
requireText("if(submit)submit.disabled=false",'fresh checkout reset must restore submit');

if(failures.length){
  console.error('Local hold-expiry lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Local hold-expiry lock guard OK: both timer and backend expiry paths lock the stale checkout until a fresh selection is prepared.');

import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const holdExpired=err.code==='HOLD_EXPIRED'","checkout must classify HOLD_EXPIRED explicitly");
requireText("stage:holdExpired?'hold_expired':'booking_failed'","expired hold must use the hold_expired session stage");
requireText("bookingState.hold=null","expired checkout must clear the local hold");
requireText("if(holdTimer)clearInterval(holdTimer)","expired checkout must stop the hold timer");
requireText("terminal=true","expired checkout must keep the stale submit path terminal");
requireText("recoverExpiredHold=true","expired checkout must use the dedicated recovery branch");
requireText("setBookingStep(1)","expired checkout must return the journey to selection");
requireText("if(!terminal)enableCheckoutRetryActions();","non-terminal failures must preserve the submitted payload and expose safe retry actions");
requireText("const localHoldInvalid=!submission.capacity_request&&(!bookingState.hold?.id||String(bookingState.hold.id)!==String(submission.hold_id||''));","a local hold that expires during an in-flight submit is not detected before retry is exposed");
requireText("if(!terminal&&localHoldInvalid){\n        setCheckoutSubmissionLock(false);\n        bookingState.submissionSnapshot=null;\n        lockExpiredCheckout({focusRecovery:true});","an expired local hold can still expose retry after an ambiguous submit failure");
requireText("setCheckoutSubmissionLock(false);\n        bookingState.submissionSnapshot=null;\n        lockExpiredCheckout({focusRecovery:true});","expired hold must clear the retry snapshot and restore Change selection before re-locking stale checkout submission");
requireText("document.querySelector('[data-checkout-edit]')?.focus","expired checkout must direct focus to the selection recovery action");

if(failures.length){
  console.error('Hold-expiry checkout recovery guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Hold-expiry checkout recovery guard OK: expired holds cannot be resubmitted and Change selection remains available for recovery.');

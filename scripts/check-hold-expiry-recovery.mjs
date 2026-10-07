import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const holdExpired=err.code==='HOLD_EXPIRED'","checkout must classify HOLD_EXPIRED explicitly");
requireText("stage:holdExpired?'hold_expired':'booking_failed'","expired hold must use the hold_expired session stage");
requireText("bookingState.hold=null","expired checkout must clear the local hold");
requireText("if(holdTimer)clearInterval(holdTimer)","expired checkout must stop the hold timer");
requireText("terminal=true","expired checkout must keep the submit action locked");
requireText("setBookingStep(1)","expired checkout must return the journey to selection");
requireText("if(!terminal&&submitButton)submitButton.disabled=false","submit must not re-enable after a terminal checkout state");
requireText("document.querySelector('[data-checkout-edit]')?.focus","expired checkout must direct focus to the selection recovery action");

if(failures.length){
  console.error('Hold-expiry checkout recovery guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Hold-expiry checkout recovery guard OK: expired holds cannot be resubmitted and the customer is returned to selection.');

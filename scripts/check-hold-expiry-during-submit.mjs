import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const localHoldInvalid=!submission.capacity_request&&(!bookingState.hold?.id||String(bookingState.hold.id)!==String(submission.hold_id||''));",'submit completion does not re-check the snapshotted hold');
requireText("if(!terminal&&localHoldInvalid){",'a locally expired hold can still enter generic retry recovery');
requireText("bookingState.submissionSnapshot=null;\n        lockExpiredCheckout({focusRecovery:true});",'expired-hold submit recovery does not discard the retry snapshot');
requireText("}else if(!terminal)enableCheckoutRetryActions();",'safe retry is not restricted to a still-valid local hold');

if(failures.length){
  console.error('Hold-expiry during submit guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Hold-expiry during submit guard OK: retry is exposed only while the snapshotted hold is still the active local hold.');

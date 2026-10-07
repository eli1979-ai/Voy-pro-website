import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const ANALYTICS_STORAGE_KEYS=['voy_visitor_id','voy_first_attribution','voy_last_attribution','voy_segment','voy_experiments','voy_event_queue_v1']",'canonical analytics storage key list missing');
requireText("const ANALYTICS_SESSION_KEYS=['voy_booking_started_v1']",'analytics session storage key list missing');
requireText('function clearAnalyticsState()','analytics-state cleanup helper missing');
requireText('memoryStore.delete(k)','revocation must clear in-memory analytics state');
requireText('ANALYTICS_SESSION_KEYS.forEach(k=>{try{sessionStorage.removeItem(k)}catch(e){}});','revocation must clear analytics-only sessionStorage state');
requireText("if(k.startsWith('voy_exp_'))memoryStore.delete(k)",'dynamic experiment assignments are not cleared from memory');
requireText("if(k&&k.startsWith('voy_exp_'))localStorage.removeItem(k)",'dynamic experiment assignments are not cleared from localStorage');
requireText('if(!consent.analytics)clearAnalyticsState()','consent revocation does not invoke complete analytics cleanup');

if(js.includes("ANALYTICS_SESSION_KEYS=['voy_payment_retry_v1']"))failures.push('payment retry state must remain booking-essential');

for(const essential of ['voy_session_id','voy_experience_id','voy_recovery_state']){
  if(js.includes("ANALYTICS_STORAGE_KEYS=['"+essential))failures.push('essential booking key must not be classified as analytics: '+essential);
}

if(failures.length){
  console.error('Consent revocation cleanup guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Consent revocation cleanup guard OK: optional analytics state is cleared from memory, localStorage and analytics-only sessionStorage while booking-critical state remains essential.');

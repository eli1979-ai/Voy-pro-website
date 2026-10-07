import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(js.includes(text))failures.push(label);};

forbidText("track('booking_reference_copied',{reference:","booking reference must not be copied into marketing-event metadata");
forbidText("track('capacity_request_created',{request_id:","capacity request id must not be copied into marketing-event metadata");
forbidText("track('booking_completed',{booking_id:","booking id must not be copied into booking_completed marketing metadata");
forbidText("track('booking_completed',{reference:","booking reference must not be copied into booking_completed marketing metadata");
forbidText("track('payment_retry_clicked',{page,booking_id:","booking id must not be copied into payment retry marketing metadata");
forbidText("booking_reference:retry.booking_reference","booking reference must not be copied into payment retry marketing metadata");

requireText("track('booking_completed',{booking_value:booking.total,value_semantics:'booked_gmv'","booking_completed must retain non-identifying funnel/value semantics");
requireText("track('capacity_request_created',{is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage})","capacity request event must retain useful non-identifying context");
requireText("track('payment_retry_clicked',{page,retry_available:true})","payment retry event must remain measurable");
requireText("patchSession({stage:'booking_completed',booking_id:booking.id,booking_reference:booking.reference","operational session state must retain booking identifiers");
requireText("capacity_request_id:req.id,capacity_request_reference:req.reference","operational session state must retain capacity-request identifiers");

if(failures.length){
  console.error('Analytics identifier minimization guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Analytics identifier minimization guard OK: marketing events use session correlation while operational session state retains required booking/request identifiers.');

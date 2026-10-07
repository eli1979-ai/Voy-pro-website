import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('function resetBookingStarted()','booking-start reset helper missing');
requireText('sessionStorage.removeItem(BOOKING_STARTED_KEY)','booking-start marker is not cleared');
requireText("patchSession({stage:'capacity_request_created',capacity_request_id:req.id,capacity_request_reference:req.reference});resetBookingStarted();",'capacity-request terminal outcome does not reset booking-start marker');
requireText("patchSession({stage:'booking_completed',booking_id:booking.id,booking_reference:booking.reference,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage});resetBookingStarted();",'completed booking does not reset booking-start marker');
requireText("if(qs.get('payment')==='success'){clearPaymentRetry();resetBookingStarted();return;}",'successful payment return does not reset booking-start marker');

if(failures.length){
  console.error('Booking-start lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Booking-start lifecycle guard OK: terminal outcomes allow a later booking journey in the same tab to emit booking_started again.');

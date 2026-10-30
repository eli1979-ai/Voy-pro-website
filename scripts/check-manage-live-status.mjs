import fs from 'node:fs';

const html=fs.readFileSync('site/manage/index.html','utf8');
const failures=[];

const required=[
  'data-contact-status role="status" aria-live="polite"',
  'id="manage-change-status" role="status" aria-live="polite"',
  'id="manage-cancel-status" role="status" aria-live="polite"',
  'class="manage-error" role="alert"'
];
for(const token of required){
  if(!html.includes(token)) failures.push('missing '+token);
}

 // In the tokenless/disabled fail-closed state, visitors need a safe,
 // localized next step without a generic booking-reference form or API call.
 const recovery="Booking details cannot be opened from this link. Use the private Manage Booking link in your confirmation or contact VOY PRO support.";
 if(!html.includes("if(!token||!c.bookingEnabled){box.innerHTML='<p>'+T("))
   failures.push('Manage missing-token fallback must remain fail-closed before the authenticated API flow');
 for(const marker of [
   recovery,
   'לא ניתן לפתוח את פרטי ההזמנה מהקישור הזה.',
   'Ebből a linkből nem nyithatók meg a foglalási adatok.',
   '<a href="mailto:support@voy-pro.com">support@voy-pro.com</a>'
 ]){
   if(!html.includes(marker))failures.push('Manage tokenless recovery/support missing: '+marker.slice(0,55));
 }
 if(html.includes("T('Booking management is not available from this link.'"))
   failures.push('Legacy tokenless Manage dead-end wording must be replaced');

const riderStatuses=(html.match(/data-rider-status/g)||[]).length;
const liveRiderStatuses=(html.match(/data-rider-status role="status" aria-live="polite"/g)||[]).length;
if(riderStatuses && riderStatuses!==liveRiderStatuses){
  failures.push('all dynamic rider status regions must be polite live regions');
}
if(failures.length){
  console.error('Manage live-status accessibility guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Manage live-status accessibility guard OK: operational updates are announced and fatal load errors use alert semantics.');

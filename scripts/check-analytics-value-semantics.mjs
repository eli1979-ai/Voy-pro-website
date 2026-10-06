import fs from 'node:fs';

const site=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

if(site.includes("track('booking_completed',{booking_id:booking.id,reference:booking.reference,revenue:booking.total")){
  failures.push('booking_completed must not label booking total as revenue');
}
for(const token of [
  "booking_value:booking.total",
  "value_semantics:'booked_gmv'",
  "payment_method:paymentMethod"
]){
  if(!site.includes(token))failures.push('booking_completed metadata missing '+token);
}
for(const event of ["track('purchase'","track('payment_collected'","track('revenue_collected'"]){
  if(site.includes(event))failures.push('browser analytics must not assert collected-revenue event: '+event);
}

if(failures.length){
  console.error('Analytics value-semantics guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Analytics value-semantics guard OK: booking value is booked GMV; collected revenue is not asserted by the browser.');

import fs from 'node:fs';

const site=fs.readFileSync('site/assets/site.js','utf8');
const contract=fs.readFileSync('contracts/fbm-consumer-contract.json','utf8');
const failures=[];

if(!contract.includes('"primary_metric": "booking_started"'))failures.push('FBM experiment contract no longer declares booking_started sample metric');
for(const token of [
  "const BOOKING_STARTED_KEY='voy_booking_started_v1'",
  "sessionStorage.getItem(BOOKING_STARTED_KEY)==='1'",
  "sessionStorage.setItem(BOOKING_STARTED_KEY,'1')",
  "track('booking_started',metadata)",
  "trackBookingStarted({date:data.get('date'),party_size:party,experience_id:experience.id"
]){
  if(!site.includes(token))failures.push('booking_started measurement missing '+token);
}
const first=site.indexOf("trackBookingStarted({date:data.get('date')");
const availability=site.indexOf("track('availability_search',{date:data.get('date')");
if(first<0||availability<0||first>availability)failures.push('booking_started must be emitted before availability_search after validation/session creation');

if(failures.length){
  console.error('Booking-started experiment metric guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Booking-started metric guard OK: experiment metric is emitted once per tab before availability_search.');

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const js=fs.readFileSync('site/assets/site.js','utf8');
const start=js.indexOf('function verifiedBookingConfirmation(booking)');
const end=js.indexOf('  function calendarUrlForBooking(',start);
assert.ok(start>=0&&end>start,'confirmation response validator missing');
const fn=js.slice(start,end);
const contract=JSON.parse(fs.readFileSync('contracts/fbm-consumer-contract.json','utf8'));
const sample=contract.contracts.find(c=>c.id==='booking.create')?.response_cases?.[0]?.sample;
assert.ok(sample,'canonical FBM booking response fixture missing');
const context={
  bookingState:{composition:{riders_16_plus:99},guideLanguage:'he',isPrivate:true},
  finiteNumber:x=>{const n=Number(x);return Number.isFinite(n)?n:null},
};
vm.runInNewContext(fn+'; verify=verifiedBookingConfirmation;',context,{timeout:1000});
const verify=context.verify;
const valid=verify(sample);
assert.equal(valid.reference,'VOY-1234');
assert.equal(valid.token,'manage-token');
assert.equal(valid.total,140);
assert.equal(valid.currency,'EUR');
assert.equal(valid.date,'2026-10-04');
assert.equal(valid.time,'09:00');
assert.equal(valid.composition.riders_16_plus,2,'server party must override stale browser state');
assert.equal(valid.guideLanguage,'en','server guide language wins');
assert.equal(valid.isPrivate,false,'server private mode wins');
assert.equal(verify({...sample,manage_token:'',secure_token:'fallback-token'}).token,'fallback-token','secure token must support legacy response');
for(const patch of [
 {reference:''},{reference:' '},{manage_token:'',secure_token:''},{status:'hold'},
 {total:null},{total:-1},{total:'not a price'},{currency:'??'},{currency:''},
 {selected_date:''},{slot_time:'25:75'},{payment_status:''}
]){
 assert.throws(()=>verify({...sample,...patch}),e=>e.code==='BOOKING_CONFIRMATION_UNVERIFIED','malformed booking must never show success: '+JSON.stringify(patch));
}
const submitStart=js.indexOf("const booking=await api('/bookings'");
const verifyAt=js.indexOf('const confirmed=verifiedBookingConfirmation(booking);',submitStart);
const releaseAt=js.indexOf('clearInterval(holdTimer); bookingState.hold=null;',submitStart);
const successAt=js.indexOf("terminal=true;st.classList.add('success-card')",submitStart);
assert.ok(submitStart>=0&&verifyAt>submitStart&&verifyAt<releaseAt&&releaseAt<successAt,'must verify booking response before releasing hold and rendering success');
const confirmedSection=js.slice(verifyAt,successAt+8500);
for(const text of [
 'renderPartySummary(confirmed.composition)',
 'confirmationDateLabel(confirmed.date)',
 'confirmationTimeLabel(confirmed.time)',
 'confirmed.reference',
 'confirmed.total',
 'confirmed.currency',
 'confirmed.guideLanguage',
 'encodeURIComponent(manageToken)'
]){
 assert.ok(confirmedSection.includes(text),'confirmation UI missing authoritative '+text);
}
assert.ok(confirmedSection.includes('confirmedExtras.items'),'confirmation must show server-returned extras rather than a pre-submit selection');
assert.ok(confirmedSection.includes('const confirmedExtras=confirmedAncillaryDetails(booking,submission.extras);'),'server extras must be compared to the immutable submitted selection');
assert.ok(js.includes("const date=String(booking?.selected_date||bookingState.date||'');"),'calendar should use server date first');
assert.ok(js.includes("const time=String(booking?.slot_time||bookingState.slot?.time||'');"),'calendar should use server time first');
assert.ok(js.includes("headers:{'Idempotency-Key':submission.idempotency_key}"),'ambiguous responses must keep retry idempotent');
console.log('PASS: confirmed booking requires verified reference/manage link/total/status and uses server date, time, party, currency; retry idempotency intact.');

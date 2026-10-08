import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const js=fs.readFileSync('site/assets/site.js','utf8');
const start=js.indexOf('function ancillaryQuantityLimit(offer)');
const end=js.indexOf('  function syncAncillaryPaymentAvailability()',start);
assert.ok(start>=0&&end>start,'shared ancillary quantity cap helper missing');
const sandbox={};
vm.runInNewContext(js.slice(start,end)+'; globalTestLimit=ancillaryQuantityLimit;',sandbox,{timeout:1000});
const limit=sandbox.globalTestLimit;
const cases=[
  [{available_quantity:1,max_per_booking:0},0,'zero maximum cannot be ordered'],
  [{available_quantity:9,max_per_booking:-1},0,'negative per-booking cap'],
  [{available_quantity:2,max_per_booking:7},2,'available stock limit'],
  [{available_quantity:12,max_per_booking:3},3,'max-per-booking limit'],
  [{available_quantity:'2',max_per_booking:'1'},1,'numeric strings accepted'],
  [{available_quantity:1.9,max_per_booking:9.4},1,'fractional stock is floored'],
  [{available_quantity:'invalid',max_per_booking:3},0,'malformed availability fails closed'],
  [{available_quantity:3,max_per_booking:'NaN'},0,'malformed booking cap fails closed'],
  [{available_quantity:'',max_per_booking:2},0,'empty cap fails closed'],
  [{available_quantity:Infinity,max_per_booking:5},0,'infinite stock fails closed'],
  [{available_quantity:null,max_per_booking:2},2,'missing availability retains previous soft default'],
  [{available_quantity:0,max_per_booking:null},0,'zero stock fails closed']
];
for(const [offer,expected,reason] of cases)assert.equal(limit(offer),expected,reason);
const render=js.slice(js.indexOf('function renderAncillaryOffers()'),js.indexOf('function restoreAncillaryControlFocus(',js.indexOf('function renderAncillaryOffers()')));
const mutation=js.slice(js.indexOf('async function changeAncillaryQuantity('),js.indexOf('async function prepareStandardCheckout(',js.indexOf('async function changeAncillaryQuantity(')));
assert.ok(render.includes('const max=ancillaryQuantityLimit(offer);'),'render must use same cap as mutation');
assert.ok(mutation.includes('const max=ancillaryQuantityLimit(offer);'),'mutation must respect effective cap');
assert.ok(mutation.includes('const next=Math.max(0,Math.min(max,current+delta));'),'mutation must clamp to cap');
assert.ok(render.includes("qty>=max?ancillaryText('limitReached')"),'increment must report cap reached');
assert.ok(render.includes('disabled title='),'increment must be visibly disabled at cap');
assert.ok(render.includes('const unavailable=max<=0;'),'zero-cap extras must show unavailable');
for(const label of ['Maximum available quantity reached','הגעתם לכמות המרבית הזמינה','Elérted a maximálisan elérhető mennyiséget']){
 assert.ok(js.includes(label),'missing localized limit label '+label);
}
assert.ok(js.includes('assertCheckoutQuote(quote);'),'FBM must still validate every re-quote');
console.log('PASS: ancillary caps respect zero, invalid, fractional, inventory/per-order ceilings; buttons and EN/HE/HU copy guarded.');

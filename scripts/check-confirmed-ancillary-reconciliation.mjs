import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const js=fs.readFileSync('site/assets/site.js','utf8');
const start=js.indexOf('function confirmedAncillaryDetails(booking,submittedExtras)');
const end=js.indexOf('  function renderConfirmationAncillarySummary(',start);
assert.ok(start>=0&&end>start,'canonical confirmed extras mapper missing');
const source=js.slice(start,end);
const sandbox={
 ancillaryDisplayName:item=>String(item.sku||item.name||'Extra')
};
vm.runInNewContext(source+';compareExtras=confirmedAncillaryDetails;',sandbox,{timeout:1000});
const reconcile=sandbox.compareExtras;

const selected=[{product_id:'camera-a',quantity:1},{product_id:'scarf-b',quantity:2}];
const booked=[
 {product_id:'scarf-b',sku:'SCARF',name:'Fleece scarf',quantity:2,unit_price_minor:1000},
 {product_id:'camera-a',sku:'GOPRO',name:'GoPro',quantity:1,unit_price_minor:3000}
];
const matched=reconcile({ancillary_items:booked},selected);
assert.equal(matched.matches,true,'same extras with different order must reconcile');
assert.equal(matched.items.length,2,'must show server extras only');
assert.equal(matched.items[0].name,'SCARF','server label should populate confirmation');
assert.equal(matched.items[1].quantity,1,'server quantity should populate confirmation');

const scenarios=[
 [{ancillary_items:[]},selected,false,0,'server has no items but guest selected extras'],
 [{ancillary_items:booked.slice(0,1)},selected,false,1,'missing backend item'],
 [{ancillary_items:[{...booked[0],quantity:1},booked[1]]},selected,false,2,'different backend quantity'],
 [{ancillary_items:booked},[{product_id:'scarf-b',quantity:1},{product_id:'camera-a',quantity:1}],false,2,'backend differs from selected quantities'],
 [{ancillary_items:booked},[],false,2,'unexpected backend extras'],
 [{},selected,false,0,'missing server extras field does not imply reservation'],
 [{ancillary_items:[]},[],true,0,'no extras ordered or returned'],
 [{ancillary_items:[{product_id:'camera-a',quantity:0}]},selected,false,0,'invalid server quantity'],
 [{ancillary_items:[booked[1],booked[1]]},selected,false,0,'duplicate server product id'],
 [{ancillary_items:booked},[{product_id:'camera-a',quantity:1},{product_id:'camera-a',quantity:1}],false,2,'duplicate submitted selection cannot verify']
];
for(const [booking,submission,match,length,description] of scenarios){
 const out=reconcile(booking,submission);
 assert.equal(out.matches,match,description+': verified status');
 assert.equal(out.items.length,length,description+': server-only display quantity');
}
const callStart=js.indexOf("const booking=await api('/bookings'");
const finalConfirmation=js.slice(callStart,js.indexOf("bindConfirmationActions(st,booking);",callStart));
assert.ok(finalConfirmation.includes('const confirmedExtras=confirmedAncillaryDetails(booking,submission.extras);'),'booking result must be reconciled');
assert.ok(finalConfirmation.includes('renderConfirmationAncillarySummary(confirmedExtras.items)'),'UI must show server extras');
assert.ok(finalConfirmation.includes('extras:confirmedExtras.items'),'WhatsApp must use the same server extras');
assert.ok(finalConfirmation.includes("confirmedExtras.matches?'':"),'mismatched extras must produce a warning');
assert.ok(!finalConfirmation.includes('renderConfirmationAncillarySummary(submission.ancillary_details||[])'),'never show unverified extras as confirmed');
assert.ok(!finalConfirmation.includes('extras:submission.ancillary_details||[]'),'never message unverified extras as confirmed');
assert.ok(js.includes('ancillary_details:clone(selectedAncillaryDetails())||[]'),'immutable extras snapshot preserved for reconciliation');
assert.ok(js.includes("headers:{'Idempotency-Key':submission.idempotency_key}"),'retry idempotency preserved');
console.log('PASS: booking-returned ancillary items are shown, selection mismatches surfaced, no unverified extras claimed.');

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('site/manage/index.html','utf8');
const begin=html.indexOf('function managedAncillaryMarkup(snapshot)');
const finish=html.indexOf(' function supportWhatsApp()',begin);
assert.ok(begin>=0&&finish>begin,'Manage Booking extras rendering helper missing');
const helper=html.slice(begin,finish);
assert.ok(html.includes('managedAncillaryMarkup(booking)'), 'Confirmed extras missing from booking summary');
const contract=JSON.parse(fs.readFileSync('contracts/fbm-consumer-contract.json','utf8'));
const sample=contract.contracts.find(c=>c.id==='manage.snapshot')?.response_cases?.[0]?.sample;
assert.equal(sample?.ancillary_items_status,'available','Contract must expose confirmed extras availability');
assert.equal(sample?.ancillary_items?.length,1,'Contract fixture must include one reserved extra');
for(const locale of ['en','he','hu']){
 const T=(en,he,hu)=>locale==='he'?he:locale==='hu'?hu:en;
 const context={
  T,Number,String,
  manageMoney:(amount,currency)=>String(amount)+' '+currency,
  esc:value=>String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])),
 };
 vm.runInNewContext(helper+';renderTestAncillaries=managedAncillaryMarkup;',context,{timeout:1000});
 const render=context.renderTestAncillaries;
 const normal=render(sample);
 assert.ok(normal.includes('GoPro rental'),locale+': backend extra name missing');
 assert.ok(normal.includes('30 EUR'),locale+': backend item total missing');
 assert.ok(normal.includes('manage-ancillary-quantity'),locale+': quantity not shown');
 assert.ok(!normal.includes('metadata')&&!normal.includes('inventory_mode'),locale+': internal fields leaked');
 const empty=render({...sample,ancillary_items:[]});
 assert.ok(empty.includes(T('No extras are recorded for this booking.','לא רשומות תוספות בהזמנה זו.','Ehhez a foglaláshoz nincs rögzített kiegészítő.')),locale+': verified empty list message missing');
 for(const state of [
   {...sample,ancillary_items_status:'unavailable',ancillary_items:null},
   {...sample,ancillary_items_status:'available',ancillary_items:null},
   {...sample,ancillary_items_status:undefined,ancillary_items:[]},
   {...sample,ancillary_items:[{...sample.ancillary_items[0],quantity:0}]},
   {...sample,ancillary_items:[{...sample.ancillary_items[0],status:'cancelled'}]},
   {...sample,ancillary_items:[{...sample.ancillary_items[0],total_minor:'1000'}]}
 ]){
   const rendered=render(state);
   assert.ok(rendered.includes(T('Extras could not be verified right now. Contact our team before relying on an accessory reservation.','לא ניתן לאמת כרגע את התוספות בהזמנה. פנו לצוות לפני הסתמכות על שריון ציוד נוסף.','A kiegészítők jelenleg nem ellenőrizhetők. A kiegészítő foglalásának megerősítéséhez lépj kapcsolatba csapatunkkal.')),locale+': unverified extras cannot appear as confirmed empty');
   assert.ok(!rendered.includes('GoPro rental'),locale+': never render unverified server extras');
 }
 const malicious=render({...sample,ancillary_items:[{...sample.ancillary_items[0],name:'<script>bad</script>'}]});
 assert.ok(!malicious.includes('<script>')&&malicious.includes('&lt;script&gt;'),locale+': escape server product name');
 const fulfilled=render({...sample,ancillary_items:[{...sample.ancillary_items[0],status:'fulfilled'}]});
 assert.ok(fulfilled.includes(T('Provided','סופק','Átadva')),locale+': fulfilled status missing');
}
const website=fs.readFileSync('site/assets/site.js','utf8');
assert.ok(website.includes('renderConfirmationAncillarySummary(confirmedExtras.items)'),'Booking confirmation must remain backend-sourced');
console.log('PASS: Manage Booking displays verified server ancillaries, quantities, prices and safe EN/HE/HU fallbacks.');

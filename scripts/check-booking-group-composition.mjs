import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync('site/assets/site.js','utf8');
const start=src.indexOf('function validateGroupComposition(form,composition)');
const end=src.indexOf('  let availabilitySearchGeneration=0;',start);
assert.ok(start>=0&&end>start,'group composition validation and preview missing');
const block=src.slice(start,end);
for(const locale of ['en','he','hu']){
  const sandbox={locale,Number,String,document:{createElement:()=>({dataset:{},setAttribute(){}})},riderPolicyLabels:()=>({riders:'Riders',children:'Children',babies:'Babies'})};
  vm.runInNewContext(block+'; testValidate=validateGroupComposition;',sandbox,{timeout:1000});
  const check=sandbox.testValidate;
  const selections={adults:['1','2','3','4','5','6','7','8','9','10','11','12'],children:['0','1','2','3','4','5','6'],babies:['0','1','2','3','4']};
  const groupForm=(selected)=>({querySelector(q){
    const name=(q.match(/name="([^"]+)"/)||[])[1];
    if(!name||!selections[name])return null;
    return {value:selected[name],options:selections[name].map(value=>({value}))};
  }});
  const composition=(riders,children,babies)=>({riders_16_plus:riders,child_passengers_3_15:children,baby_passengers_1_2:babies});
  const valid=check(groupForm({adults:'2',children:'1',babies:'1'}),composition(2,1,1));
  assert.equal(valid.valid,true,locale+': valid mixed group rejected');
  assert.equal(check(groupForm({adults:'1',children:'0',babies:'0'}),composition(0,0,0)).valid,false,locale+': zero independent riders accepted');
  assert.equal(check(groupForm({adults:'1',children:'0',babies:'0'}),composition(1,-1,0)).valid,false,locale+': negative passengers accepted');
  assert.equal(check(groupForm({adults:'1',children:'0',babies:'0'}),composition(1,0.5,0)).valid,false,locale+': fraction accepted');
  assert.equal(check(groupForm({adults:'13',children:'0',babies:'0'}),composition(13,0,0)).valid,false,locale+': out-of-range rider count accepted');
  assert.equal(check(groupForm({adults:'1',children:'7',babies:'0'}),composition(1,7,0)).valid,false,locale+': out-of-range child count accepted');
  assert.equal(check(groupForm({adults:'1',children:'0',babies:'5'}),composition(1,0,5)).valid,false,locale+': out-of-range baby count accepted');
  assert.equal(check(groupForm({adults:'2',children:'0',babies:'0'}),composition(1,0,0)).valid,false,locale+': mismatched form counts accepted');
  assert.ok(check(groupForm({adults:'0',children:'1',babies:'0'}),composition(0,1,0)).message,locale+': missing validation copy');
}
assert.ok(src.includes('ensureGroupCompositionPreview(form);'),'form preview initialization missing');
assert.ok(src.includes('const compositionCheck=validateGroupComposition(form,composition);'),'pre-search validation missing');
const availabilityStart=src.indexOf("const form=document.querySelector('#availability-form');");
const availabilityEnd=src.indexOf('function verifiedBookingConfirmation(',availabilityStart);
assert.ok(availabilityStart>=0&&availabilityEnd>availabilityStart,'availability submit handler not found');
const availabilityFlow=src.slice(availabilityStart,availabilityEnd);
const validationAt=availabilityFlow.indexOf('const compositionCheck=validateGroupComposition(form,composition);');
const guideAt=availabilityFlow.indexOf('const allowedGuideLanguages=guideLanguagesForProduct(experience);');
const sessionAt=availabilityFlow.indexOf("void createSession('availability_search'");
const getAt=availabilityFlow.indexOf("const out=await api('/experiences/'");
assert.ok(validationAt>=0&&guideAt>validationAt&&sessionAt>guideAt&&getAt>sessionAt,
  'group composition and explicit guide language must be checked before CRM tracking and availability GET');
assert.ok(!availabilityFlow.includes("await createSession('availability_search'"),
  'best-effort session latency must not gate read-only departure lookup');
assert.ok(src.includes("passenger seat availability and final price")||src.includes('Passenger seat availability and final price'),'live seat availability explanation missing');
assert.ok(!block.includes('child_passengers_3_15>riders_16_plus'),'cannot invent seat limit locally');
console.log('PASS: group composition selection/preview and EN/HE/HU guards; live FBM remains authoritative for seats and prices.');

// A saved party is only a hint for the guest, never a verified reservation.
// Exercise the actual browser guard with corrupted localStorage timestamps.
const recoveryStart=src.indexOf('  const RECOVERY_TTL_MS=');
const recoveryEnd=src.indexOf('  function saveSelectionRecovery(',recoveryStart);
assert.ok(recoveryStart>=0&&recoveryEnd>recoveryStart,'saved party recovery guard missing');
const recoveryCode=src.slice(recoveryStart,recoveryEnd);
const now=Date.parse('2026-10-28T12:00:00.000Z');
const saved=new Map();
const context={
  getStore:key=>saved.get(key),delStore:key=>saved.delete(key),
  safeJSON:raw=>{try{return JSON.parse(raw);}catch{return null;}},
  Date:class extends Date{static now(){return now;}}
};
vm.runInNewContext(recoveryCode+'; inspectRecovery=savedSelectionRecovery;',context,{timeout:1000});
const validSaved={version:1,experience_id:'exp_bud_buda',date:'2026-10-29',
  is_private:false,guide_language:'he',
  composition:{riders_16_plus:2,child_passengers_3_15:1,baby_passengers_1_2:0,
    request_15yo_independent_assessment:false}};
const readSaved=value=>{
  saved.set('voy_recovery_state',JSON.stringify({...validSaved,saved_at:value}));
  return context.inspectRecovery();
};
for(const bad of [null,0,-1,'garbled','Infinity','12345',now+1,now+300000,
  now-2*60*60*1000-1]){
  assert.equal(readSaved(bad),null,'corrupted, future or expired saved timestamp was accepted: '+bad);
  assert.equal(saved.has('voy_recovery_state'),false,'invalid saved party was not removed: '+bad);
}
for(const good of [now,now-5000,now-2*60*60*1000]){
  assert.equal(readSaved(good)?.experience_id,'exp_bud_buda',
    'fresh saved selection unexpectedly hidden: '+good);
  assert.equal(saved.has('voy_recovery_state'),true,'valid saved party unexpectedly removed');
}
const readSnapshot=value=>{
  saved.set('voy_recovery_state',JSON.stringify(value));
  return context.inspectRecovery();
};
const invalidSnapshots=[
  ['wrong-version',{version:2}],
  ['missing-version',{version:undefined}],
  ['missing-experience',{experience_id:undefined}],
  ['non-string-experience',{experience_id:{id:'exp_bud_buda'}}],
  ['long-experience',{experience_id:'x'.repeat(129)}],
  ['malformed-date',{date:'tomorrow'}],
  ['impossible-date',{date:'2026-02-30'}],
  ['missing-date',{date:null}],
  ['missing-party',{composition:null}],
  ['array-party',{composition:[]}],
  ['fractional-riders',{composition:{...validSaved.composition,riders_16_plus:1.5}}],
  ['string-riders',{composition:{...validSaved.composition,riders_16_plus:'2'}}],
  ['zero-riders',{composition:{...validSaved.composition,riders_16_plus:0}}],
  ['negative-children',{composition:{...validSaved.composition,child_passengers_3_15:-1}}],
  ['missing-babies',{composition:{riders_16_plus:2,child_passengers_3_15:1}}],
  ['false-string-assessment',{composition:{...validSaved.composition,
    request_15yo_independent_assessment:'false'}}],
  ['false-string-private',{is_private:'false'}],
  ['object-language',{guide_language:{code:'he'}}],
  ['invalid-language',{guide_language:'he\nmalicious'}]
];
for(const [name,patch] of invalidSnapshots){
  const result=readSnapshot({...validSaved,saved_at:now,...patch});
  assert.equal(result,null,name+': invalid stored selection displayed');
  assert.equal(saved.has('voy_recovery_state'),false,name+': invalid selection not cleared');
}
assert.equal(readSnapshot({...validSaved,saved_at:now,guide_language:null})?.experience_id,
  'exp_bud_buda','partial selection without a guide preference remains parseable');
assert.equal(readSnapshot({...validSaved,saved_at:now,composition:{
  riders_16_plus:2,child_passengers_3_15:1,baby_passengers_1_2:0}})?.experience_id,
  'exp_bud_buda','older v1 optional assessment flag is accepted');
console.log('PASS: corrupt, future and expired timestamps and malformed v1 party/date/mode are discarded; valid selections remain.');

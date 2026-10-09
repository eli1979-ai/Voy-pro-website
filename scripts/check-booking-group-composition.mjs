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
assert.ok(src.indexOf('const compositionCheck=validateGroupComposition(form,composition);')<src.indexOf("await createSession('availability_search'"),'validation must occur before tracking and availability');
assert.ok(src.includes("passenger seat availability and final price")||src.includes('Passenger seat availability and final price'),'live seat availability explanation missing');
assert.ok(!block.includes('child_passengers_3_15>riders_16_plus'),'cannot invent seat limit locally');
console.log('PASS: group composition selection/preview and EN/HE/HU guards; live FBM remains authoritative for seats and prices.');

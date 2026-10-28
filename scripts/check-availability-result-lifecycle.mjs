import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('let availabilitySearchGeneration=0;','availability generation state is missing');
requireText("const availabilitySelectionNames=new Set(['experience','date','adults','children','babies','guide_language']);",'availability-driving fields are not enumerated');
requireText('availabilitySearchGeneration++;','selection changes do not invalidate prior availability work');
requireText("slots.innerHTML='';",'invalidated availability slots are not cleared');
requireText("if(availabilitySelectionNames.has(e.target.name))invalidateAvailabilityResults({announce:true});",'selection changes do not invalidate stale results');
requireText('const searchGeneration=++availabilitySearchGeneration;','new searches do not capture a generation');
const staleChecks=(js.match(/if\(searchGeneration!==availabilitySearchGeneration\)return;/g)||[]).length;
if(staleChecks<3)failures.push('availability lifecycle needs stale guards after session, response and error paths');
requireText("const out=await api('/experiences/'+encodeURIComponent(experience.id)+'/availability?'+q.toString(),{method:'GET'});",'availability request path is missing');
requireText('if(s.starts_at&&Date.parse(s.starts_at)<=Date.now())','departures need a fresh start-time check at click, after results were rendered');
requireText('invalidateAvailabilityResults();\n          status.textContent=locale===\'hu\'','a newly expired departure must invalidate stale slots and explain the recheck');

// Exercise the exact source helper in an isolated Node VM: malicious JSON
// booleans must never make a departure eligible for checkout or staff request.
const functionSource=js.match(/^  function verifiedAvailabilitySlots\(response\)\{[\s\S]*?^  \}/m)?.[0];
if(!functionSource)failures.push('FBM availability response validation helper missing');
else{
  const verified=runInNewContext('('+functionSource.trim()+')');
  const bookable={id:'departure-a',time:'09:00',sellable:true,requestable:false};
  const needsStaff={id:'departure-b',time:'13:30:00',sellable:false,requestable:true};
  const blocked={id:'departure-c',time:'16:00',sellable:false,requestable:false};
  const ok=verified({slots:[bookable,needsStaff,blocked]});
  assert.equal(Array.from(ok,v=>v.id).join(','),'departure-a,departure-b,departure-c');
  assert.equal(verified({slots:[]}).length,0,'Empty schedules are not errors');
  const future=new Date(Date.now()+86400000).toISOString();
  const past=new Date(Date.now()-86400000).toISOString();
  assert.equal(verified({slots:[{...bookable,starts_at:past},
    {...needsStaff,starts_at:future}]}).length,1,
    'Expired departures must remain filtered out');
  const malformed=[
    {slots:null},{slots:{}},{slots:'available'},
    {slots:[{...bookable,sellable:'false'}]},
    {slots:[{...bookable,requestable:'false'}]},
    {slots:[{...bookable,sellable:1}]},
    {slots:[{...needsStaff,requestable:null}]},
    {slots:[{...bookable,sellable:true,requestable:true}]},
    {slots:[{...bookable,id:''}]},
    {slots:[{...bookable,time:'not a time'}]},
    {slots:[{...bookable,starts_at:'yesterday'}]},
    {slots:[{...bookable,starts_at:null}]},
    {slots:[{...bookable},{...bookable}]},
    {slots:Array.from({length:101},(_,i)=>({...bookable,id:'departure-'+i}))}
  ];
  for(const value of malformed)
    assert.throws(()=>verified(value),'Malformed FBM slots must fail closed, never become selectable');
}

if(failures.length){
  console.error('Availability result lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Availability result lifecycle guard OK: changed selections clear old slots and stale searches cannot update the current UI.');

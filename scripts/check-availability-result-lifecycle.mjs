import fs from 'node:fs';

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

if(failures.length){
  console.error('Availability result lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Availability result lifecycle guard OK: changed selections clear old slots and stale searches cannot update the current UI.');

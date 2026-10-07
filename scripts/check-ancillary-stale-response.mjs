import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('let ancillaryLoadGeneration=0;','ancillary request generation state is missing');
requireText('const generation=++ancillaryLoadGeneration;','ancillary requests do not capture a generation');
requireText('const slotId=String(bookingState.slot.id);','ancillary request does not snapshot the selected slot');
requireText("slot_id:slotId",'ancillary request does not use the slot snapshot');
requireText("if(generation!==ancillaryLoadGeneration||String(bookingState.slot?.id||'')!==slotId)return;",'stale ancillary responses are not rejected');
requireText("track('ancillary_offers_viewed',{slot_id:slotId",'ancillary analytics does not use the verified slot snapshot');

if(failures.length){
  console.error('Ancillary stale-response guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Ancillary stale-response guard OK: late offers cannot overwrite a newer checkout slot.');

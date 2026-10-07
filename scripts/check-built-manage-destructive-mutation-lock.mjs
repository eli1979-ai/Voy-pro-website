import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("if(cancel.dataset.busy==='true'||document.getElementById('manage-change-status')?.dataset.busy==='true')return;",'cancellation does not refuse an in-flight departure change');
requireText("manageAvailabilityGeneration++;const cancelDate=", 'cancellation does not invalidate in-flight availability work');
requireText("if(cancelSlots)cancelSlots.innerHTML='';",'cancellation does not clear stale departure choices');
requireText("if(st?.dataset.busy==='true'||document.getElementById('manage-cancel')?.dataset.busy==='true')return;",'departure change does not refuse an in-flight cancellation');
requireText("if(changeCancel)changeCancel.disabled=true;",'departure change does not disable cancellation while pending');
requireText("if(changeDate)changeDate.disabled=true;",'departure change does not freeze the requested date while pending');
requireText("if(cancelDate)cancelDate.disabled=false;if(cancelSearch)cancelSearch.disabled=false;",'failed cancellation does not restore change controls');
requireText("if(changeCancel)changeCancel.disabled=false;if(changeDate)changeDate.disabled=false;if(changeSearch)changeSearch.disabled=false;",'failed departure change does not restore conflicting controls');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-destructive-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}
if(failures.length){
  console.error('Manage destructive mutation exclusivity guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage destructive mutation exclusivity guard OK: cancel and departure change cannot overlap.');

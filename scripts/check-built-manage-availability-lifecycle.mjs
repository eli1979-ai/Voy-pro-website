import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText('let manageAvailabilityGeneration=0;','Manage change availability generation state is missing');
requireText("if(manageDate)manageDate.addEventListener('change',()=>{",'date changes do not invalidate old results');
requireText("if(slots)slots.innerHTML='';",'date changes do not clear old departure buttons');
requireText("if(search.dataset.busy==='true')return;",'Manage availability search is not single-flight');
requireText("search.dataset.busy='true';search.disabled=true;",'Manage availability search button is not locked while pending');
if((html.match(/if\(generation!==manageAvailabilityGeneration\)return;/g)||[]).length<2)failures.push('Manage availability success/error paths do not both reject stale responses');
requireText("if(generation===manageAvailabilityGeneration){delete search.dataset.busy;search.disabled=false;}",'current Manage availability search does not release its lock');
requireText("b.onclick=()=>changeDeparture(s.id,s.time,date);",'departure buttons do not preserve searched date/time context');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-availability-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}
if(failures.length){
  console.error('Manage availability lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage availability lifecycle guard OK: stale results are rejected, date changes clear old slots and search is single-flight.');

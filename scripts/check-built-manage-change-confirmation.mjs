import fs from 'node:fs';
import vm from 'node:vm';

const file='dist/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(html.includes(text))failures.push(label);};

requireText("b.onclick=()=>changeDeparture(s.id,s.time,date);",'change buttons do not pass the selected departure context');
requireText("async function changeDeparture(id,time,date){const dateLabel=manageDateLabel(date),timeLabel=manageTimeLabel(time);if(!confirm(",'departure mutation lacks explicit confirmation');
requireText("'/change',{method:'POST'",'Manage departure change mutation missing');
requireText("if(st?.dataset.busy==='true'||document.getElementById('manage-cancel')?.dataset.busy==='true')return;",'departure change lacks an in-flight/cross-mutation lock');
requireText("changeButtons.forEach(b=>b.disabled=true)",'departure choices are not disabled during mutation');
requireText("delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);if(changeCancel)changeCancel.disabled=false;if(changeDate)changeDate.disabled=false;if(changeSearch)changeSearch.disabled=false;",'failed departure changes do not release the mutation/cross-control lock');
forbidText("b.onclick=()=>changeDeparture(s.id);",'one-click departure mutation remains');
forbidText(' await load();','duplicate/immediate Manage reload remains after departure change');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-change-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Manage departure confirmation guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage departure confirmation guard OK: date/time changes require explicit confirmation, are locked in-flight, and avoid duplicate refreshes.');

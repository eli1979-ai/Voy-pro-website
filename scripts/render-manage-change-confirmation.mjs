import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const beforeClick="b.onclick=()=>changeDeparture(s.id);";
const afterClick="b.onclick=()=>changeDeparture(s.id,s.time,date);";
const beforeFn="async function changeDeparture(id){const st=document.getElementById('manage-change-status');";
const afterFn="async function changeDeparture(id,time,date){const dateLabel=manageDateLabel(date),timeLabel=manageTimeLabel(time);if(!confirm(T('Change this booking to '+dateLabel+' at '+timeLabel+'?','לשנות את ההזמנה ל־'+dateLabel+' בשעה '+timeLabel+'?','Módosítod a foglalást erre: '+dateLabel+' '+timeLabel+'?')))return;const st=document.getElementById('manage-change-status');if(st?.dataset.busy==='true')return;st.dataset.busy='true';const changeButtons=[...document.querySelectorAll('#manage-slots button')];changeButtons.forEach(b=>b.disabled=true);";

if(!html.includes(beforeClick)||!html.includes(beforeFn)){
  console.error('Manage change-confirmation renderer: expected change flow not found.');
  process.exit(1);
}
html=html.replace(beforeClick,afterClick).replace(beforeFn,afterFn);
const beforeCatch="}catch(err){st.textContent=err.code==='STAFF_CONFIRMATION_REQUIRED'?";
const afterCatch="}catch(err){delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);st.textContent=err.code==='STAFF_CONFIRMATION_REQUIRED'?";
if(!html.includes(beforeCatch)||!html.includes(' await load();')){
  console.error('Manage change-confirmation renderer: expected mutation tail not found.');
  process.exit(1);
}
html=html.replace(beforeCatch,afterCatch).replace(' await load();','');
fs.writeFileSync(file,html);
console.log('Rendered explicit confirmation, mutation lock and single-refresh behavior for Manage Booking departure changes.');

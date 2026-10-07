import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const beforeClick="b.onclick=()=>changeDeparture(s.id);";
const afterClick="b.onclick=()=>changeDeparture(s.id,s.time,date);";
const beforeFn="async function changeDeparture(id){const st=document.getElementById('manage-change-status');";
const afterFn="async function changeDeparture(id,time,date){const dateLabel=manageDateLabel(date),timeLabel=manageTimeLabel(time);if(!confirm(T('Change this booking to '+dateLabel+' at '+timeLabel+'?','לשנות את ההזמנה ל־'+dateLabel+' בשעה '+timeLabel+'?','Módosítod a foglalást erre: '+dateLabel+' '+timeLabel+'?')))return;const st=document.getElementById('manage-change-status');";

if(!html.includes(beforeClick)||!html.includes(beforeFn)){
  console.error('Manage change-confirmation renderer: expected change flow not found.');
  process.exit(1);
}
html=html.replace(beforeClick,afterClick).replace(beforeFn,afterFn);
fs.writeFileSync(file,html);
console.log('Rendered explicit confirmation before Manage Booking departure changes.');

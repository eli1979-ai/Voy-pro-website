import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const helperAnchor='function manageDateLabel(value){';
const helper="function manageBudapestDate(offsetDays=0){const dt=new Date(Date.now()+offsetDays*86400000);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dt);const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));return values.year+'-'+values.month+'-'+values.day;} ";
const utcMin='min="${new Date().toISOString().slice(0,10)}"';
const budapestMin='min="${manageBudapestDate(0)}"';
const utcDobMax='max="${new Date().toISOString().slice(0,10)}"';
const budapestDobMax='max="${manageBudapestDate(0)}"';

if(!html.includes(helperAnchor)||!html.includes(utcMin)||!html.includes(utcDobMax)){
  console.error('Manage Budapest-date renderer: expected anchors not found.');
  process.exit(1);
}
html=html.replace(helperAnchor,helper+helperAnchor).replace(utcMin,budapestMin).replace(utcDobMax,budapestDobMax);
fs.writeFileSync(file,html);
console.log('Rendered Budapest-local change minimum and rider birth-date maximum into Manage Booking.');

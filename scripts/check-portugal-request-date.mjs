import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
for(const marker of [
  "timeZone:'Europe/Lisbon'",
  "syncPortugalRequestDateMin();",
  "dateInput?.addEventListener('focus',syncPortugalRequestDateMin);",
  "const today=syncPortugalRequestDateMin();",
  "if(date<today){",
  "dateInput?.focus({preventScroll:true});",
  "past:'Choose today or a future date.'",
  "past:'Escolha a data de hoje ou uma data futura.'",
  "past:'יש לבחור את התאריך של היום או תאריך עתידי.'"
]){
  if(!js.includes(marker)) failures.push('missing '+marker);
}
for(const file of ['site/portugal/index.html','site/pt/portugal/index.html','site/he/portugal/index.html']){
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('data-portugal-request-form'))failures.push(file+': request form missing');
  if(!html.includes('name="date" type="date" required'))failures.push(file+': request date field missing');
}
if(failures.length){
  console.error('Portugal request date guard failed.');
  failures.forEach(f=>console.error('- '+f));
  process.exit(1);
}
console.log('Portugal request date guard OK: EN/PT/HE reject past dates using the Europe/Lisbon operating date.');

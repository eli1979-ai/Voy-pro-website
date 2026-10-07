import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const contactStart="const cf=document.getElementById('manage-contact');if(cf)cf.addEventListener('submit',async e=>{e.preventDefault();const st=cf.querySelector('[data-contact-status]');";
const contactLocked="const cf=document.getElementById('manage-contact');if(cf)cf.addEventListener('submit',async e=>{e.preventDefault();if(cf.dataset.busy==='true')return;cf.dataset.busy='true';const submit=cf.querySelector('button[type=\"submit\"]');if(submit)submit.disabled=true;const st=cf.querySelector('[data-contact-status]');";
const contactTail="}catch(err){st.textContent=T('Could not update details. Contact support.','לא ניתן לעדכן את הפרטים. פנו לתמיכה.')}});";
const contactTailLocked="}catch(err){st.textContent=T('Could not update details. Contact support.','לא ניתן לעדכן את הפרטים. פנו לתמיכה.')}finally{delete cf.dataset.busy;if(submit)submit.disabled=false}});";

const riderStart="riderForm.addEventListener('submit',async e=>{ e.preventDefault(); const status=document.getElementById('waiver-riders-status');";
const riderLocked="riderForm.addEventListener('submit',async e=>{ e.preventDefault();if(riderForm.dataset.busy==='true')return;riderForm.dataset.busy='true';const submit=riderForm.querySelector('button[type=\"submit\"]');if(submit)submit.disabled=true; const status=document.getElementById('waiver-riders-status');";
const riderTail="status.textContent=msg; } } });";
const riderTailLocked="status.textContent=msg; } }finally{delete riderForm.dataset.busy;if(submit)submit.disabled=false} });";

for(const [needle,label] of [[contactStart,'contact start'],[contactTail,'contact tail'],[riderStart,'rider start'],[riderTail,'rider tail']]){
  if(!html.includes(needle)){console.error('Manage form-lock renderer: expected '+label+' not found.');process.exit(1);}
}
html=html.replace(contactStart,contactLocked).replace(contactTail,contactTailLocked).replace(riderStart,riderLocked).replace(riderTail,riderTailLocked);
fs.writeFileSync(file,html);
console.log('Rendered single-flight locks for Manage contact and rider/waiver saves.');

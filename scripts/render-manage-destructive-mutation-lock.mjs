import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const cancelStart="if(cancel.dataset.busy==='true')return;cancel.dataset.busy='true';cancel.disabled=true;";
const cancelStartNew="if(cancel.dataset.busy==='true'||document.getElementById('manage-change-status')?.dataset.busy==='true')return;manageAvailabilityGeneration++;const cancelDate=document.getElementById('manage-date'),cancelSearch=document.getElementById('manage-search'),cancelSlots=document.getElementById('manage-slots');if(cancelDate)cancelDate.disabled=true;if(cancelSearch){delete cancelSearch.dataset.busy;cancelSearch.disabled=true;}if(cancelSlots)cancelSlots.innerHTML='';cancel.dataset.busy='true';cancel.disabled=true;";
const cancelFailure="delete cancel.dataset.busy;cancel.disabled=false;";
const cancelFailureNew="delete cancel.dataset.busy;cancel.disabled=false;if(cancelDate)cancelDate.disabled=false;if(cancelSearch)cancelSearch.disabled=false;";

const changeStart="if(st?.dataset.busy==='true')return;st.dataset.busy='true';const changeButtons=[...document.querySelectorAll('#manage-slots button')];changeButtons.forEach(b=>b.disabled=true);";
const changeStartNew="if(st?.dataset.busy==='true'||document.getElementById('manage-cancel')?.dataset.busy==='true')return;manageAvailabilityGeneration++;const changeCancel=document.getElementById('manage-cancel'),changeDate=document.getElementById('manage-date'),changeSearch=document.getElementById('manage-search');if(changeCancel)changeCancel.disabled=true;if(changeDate)changeDate.disabled=true;if(changeSearch){delete changeSearch.dataset.busy;changeSearch.disabled=true;}st.dataset.busy='true';const changeButtons=[...document.querySelectorAll('#manage-slots button')];changeButtons.forEach(b=>b.disabled=true);";
const changeFailure="delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);";
const changeFailureNew="delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);if(changeCancel)changeCancel.disabled=false;if(changeDate)changeDate.disabled=false;if(changeSearch)changeSearch.disabled=false;";

for(const [before,after,label] of [
  [cancelStart,cancelStartNew,'cancel start'],
  [cancelFailure,cancelFailureNew,'cancel failure'],
  [changeStart,changeStartNew,'change start'],
  [changeFailure,changeFailureNew,'change failure']
]){
  if(!html.includes(before)){
    console.error('Manage destructive-mutation renderer: '+label+' anchor not found.');
    process.exit(1);
  }
  html=html.replace(before,after);
}

fs.writeFileSync(file,html);
console.log('Rendered mutually exclusive Manage cancellation/departure mutations.');

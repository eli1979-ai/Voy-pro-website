import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const beforeStart="if(!confirm(T('Cancel this booking?','לבטל את ההזמנה?','Biztosan lemondod ezt a foglalást?')))return; const st=document.getElementById('manage-cancel-status');";
const afterStart="if(!confirm(T('Cancel this booking?','לבטל את ההזמנה?','Biztosan lemondod ezt a foglalást?')))return;if(cancel.dataset.busy==='true')return;cancel.dataset.busy='true';cancel.disabled=true; const st=document.getElementById('manage-cancel-status');";
const beforeCatch="catch(err){if(st){const msg=err.code==='CANCELLATION_POLICY_NOT_CONFIGURED'?";
const afterCatch="catch(err){delete cancel.dataset.busy;cancel.disabled=false;if(st){const msg=err.code==='CANCELLATION_POLICY_NOT_CONFIGURED'?";

if(!html.includes(beforeStart)||!html.includes(beforeCatch)){
  console.error('Manage cancel-lock renderer: expected cancellation flow not found.');
  process.exit(1);
}
html=html.replace(beforeStart,afterStart).replace(beforeCatch,afterCatch);
fs.writeFileSync(file,html);
console.log('Rendered single-flight lock for Manage Booking cancellation.');

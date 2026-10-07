import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const confirmAnchor="if(!confirm(T('Cancel this booking?','לבטל את ההזמנה?','Biztosan lemondod ezt a foglalást?')))return;";
const lockInsert="if(cancel.dataset.busy==='true')return;cancel.dataset.busy='true';cancel.disabled=true;";
const beforeCatch="catch(err){if(st){const msg=err.code==='CANCELLATION_POLICY_NOT_CONFIGURED'?";
const afterCatch="catch(err){delete cancel.dataset.busy;cancel.disabled=false;if(st){const msg=err.code==='CANCELLATION_POLICY_NOT_CONFIGURED'?";

if(!html.includes(confirmAnchor)||!html.includes(beforeCatch)){
  console.error('Manage cancel-lock renderer: expected cancellation flow not found.');
  process.exit(1);
}
html=html.replace(confirmAnchor,confirmAnchor+lockInsert).replace(beforeCatch,afterCatch);
fs.writeFileSync(file,html);
console.log('Rendered single-flight lock for Manage Booking cancellation.');

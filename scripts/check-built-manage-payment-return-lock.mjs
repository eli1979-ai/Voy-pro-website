import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText('function applyPaymentReturnMutationLock(){','Manage payment-return mutation-lock helper is missing');
requireText('if(!paymentReturnPending)return;','Manage mutation lock is not scoped to active payment reconciliation');
requireText("box.setAttribute('aria-busy','true');",'Manage payment reconciliation does not expose a busy container state');
requireText("box.setAttribute('data-payment-return-lock','true');",'Manage payment reconciliation lock marker is missing');
requireText("box.querySelectorAll('form input,form select,form button,#manage-date,#manage-search,#manage-slots button,#manage-cancel').forEach(control=>{",'Manage mutation controls are not covered by the payment-reconciliation lock');
requireText('control.disabled=true;','Manage payment-reconciliation lock does not disable mutation controls');
requireText('bind();\n  applyPaymentReturnMutationLock();','Manage mutation lock is not applied synchronously after each reconciliation render');
requireText("if(paymentReturnPending){",'payment reconciliation pending state is missing');

for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  try{new vm.Script(code);}catch(error){failures.push('inline Manage script failed to compile: '+error.message);}
}
if(failures.length){
  console.error('Manage payment-return mutation lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage payment-return mutation lock guard OK: Manage forms stay non-editable until Stripe return reconciliation finishes.');

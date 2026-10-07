import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('const existingSubmission=bookingState.submissionSnapshot||null;','retry does not reuse an immutable prior submission snapshot');
requireText('bookingState.submissionSnapshot={','first submit does not persist a payload snapshot');
requireText('idempotency_key:idem,','submission snapshot does not bind the idempotency key');
requireText('customer:clone(customer),','submission snapshot does not freeze customer data');
requireText('extras:clone(bookingState.extras)||[],','submission snapshot does not freeze extras');
requireText("headers:{'Idempotency-Key':submission.idempotency_key}",'retry requests do not use the snapshotted idempotency key');
requireText('body:JSON.stringify({hold_id:submission.hold_id,session_id:submission.session_id,customer:submission.customer,payment_method:submission.payment_method','booking retry does not use the snapshotted payload');
requireText("body:JSON.stringify({payment_type:'online',payment_method:'pay_now_card',hold_id:submission.hold_id,session_id:submission.session_id,customer:submission.customer",'payment retry does not use the snapshotted payload');
requireText('function enableCheckoutRetryActions(){','safe retry action helper is missing');
requireText('if(!terminal)enableCheckoutRetryActions();','recoverable failures do not keep payload controls immutable');
requireText('bookingState.submissionSnapshot=null;\n      releaseHold();','Change selection does not discard the old idempotent submission snapshot');

if(failures.length){
  console.error('Checkout idempotent retry guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout idempotent retry guard OK: retries reuse one immutable payload and idempotency key; edits require a fresh checkout.');

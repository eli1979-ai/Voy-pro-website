import {readFile} from 'node:fs/promises';

const file='site/manage/index.html';
const source=await readFile(file,'utf8');
const failures=[];

function requireText(token){
  if(!source.includes(token))failures.push('missing '+token);
}

for(const token of [
  "paymentReturn=q.get('payment')==='success'",
  "['paid','partially_paid'].includes",
  'async function reconcilePaymentReturn()',
  'for(let attempt=0;attempt<5;attempt++)',
  'setTimeout(resolve,800)',
  "clean.searchParams.delete('payment')",
  'Payment received. Your booking payment status is updated.',
  'Payment completed in Stripe. We are confirming it in your booking now',
  'Payment was submitted and is still being confirmed.',
]){
  requireText(token);
}

const start=source.indexOf('async function reconcilePaymentReturn()');
const end=source.indexOf('async function load()',start);
const block=start>=0&&end>start?source.slice(start,end):'';

for(const forbidden of [
  '/payments/intents',
  '/webhooks/stripe',
  'settle',
  'payment_link_requests',
  'backend_settle',
]){
  if(block.includes(forbidden)){
    failures.push('success-return reconciliation must not perform settlement: '+forbidden);
  }
}

if(failures.length){
  console.error('Payment success-return guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Payment success-return guard passed: Manage Booking confirms provider settlement with bounded polling and never settles payments itself.');

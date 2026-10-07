import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const helperAnchor=" function render(){";
const helper=` function applyPaymentReturnMutationLock(){
  if(!paymentReturnPending)return;
  box.setAttribute('aria-busy','true');
  box.setAttribute('data-payment-return-lock','true');
  box.querySelectorAll('form input,form select,form button,#manage-date,#manage-search,#manage-slots button,#manage-cancel').forEach(control=>{
   control.disabled=true;
  });
 }
`;

if(!html.includes(helperAnchor)){
  console.error('Manage payment-return lock renderer: render() anchor not found.');
  process.exit(1);
}
html=html.replace(helperAnchor,helper+helperAnchor);

const renderTail="  bind();\n }";
const renderTailNew="  bind();\n  applyPaymentReturnMutationLock();\n }";
if(!html.includes(renderTail)){
  console.error('Manage payment-return lock renderer: render tail not found.');
  process.exit(1);
}
html=html.replace(renderTail,renderTailNew);

fs.writeFileSync(file,html);
console.log('Rendered Manage mutation lock during Stripe payment reconciliation.');

import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const checkoutFrozen=document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked')===true;",'late ancillary rendering does not detect a frozen submitted checkout');
requireText("if(checkoutFrozen)node.querySelectorAll('button').forEach(btn=>btn.disabled=true);",'ancillary buttons created after submit are not disabled');
requireText("if(document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked'))return;",'ancillary mutation handler can still change state after submit');
requireText('ancillary_details:clone(selectedAncillaryDetails())||[],','submission snapshot does not freeze display details for submitted extras');
requireText('extras:confirmedExtras.items','booking WhatsApp confirmation must use verified booking extras');
requireText('renderConfirmationAncillarySummary(confirmedExtras.items)','onscreen confirmation must use verified booking extras');
requireText('function renderConfirmationAncillarySummary(items=selectedAncillaryDetails()){','confirmation renderer must accept authoritative extras');
requireText('const confirmedExtras=confirmedAncillaryDetails(booking,submission.extras);','confirmation must reconcile the submitted extras against the server booking');

if(failures.length){
  console.error('Ancillary submit freeze guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Ancillary submit freeze guard OK: late offers stay non-mutable and confirmations use the submitted extras snapshot.');

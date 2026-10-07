import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const availabilityForm=document.querySelector('#availability-form');",'submit lock does not locate the availability form');
requireText("...(availabilityForm?.querySelectorAll('input,select,button')||[]),",'date/group/language/search controls are not included in the submit lock');
requireText("if(!silent&&document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked'))return;",'Standard/Private mode can still mutate during a frozen checkout');
const frozenFormGuards=(js.match(/if\(document\.querySelector\('#live-checkout-shell'\)\?\.hasAttribute\('data-submit-locked'\)\)return;/g)||[]).length;
if(frozenFormGuards<2)failures.push('availability change and submit paths are not both blocked while checkout is frozen');
requireText('setCheckoutSubmissionLock(false);\n      if(bookingState)bookingState.submissionSnapshot=null;','Change selection does not restore availability controls before starting a fresh checkout');
requireText('if(!terminal)enableCheckoutRetryActions();','retry must keep availability controls locked until Change selection is chosen');

if(failures.length){
  console.error('Checkout selection submission lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout selection submission lock guard OK: availability and tour-mode controls cannot invalidate an in-flight or retry-locked checkout.');

import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('let paymentSelectionTouched=false;','payment selection interaction state is missing');
requireText("select.addEventListener('change',()=>{paymentSelectionTouched=true;sync();});",'payment selection changes are not recorded');
requireText('if(onlineReady&&!paymentSelectionTouched){','late online-card capability can still override an explicit payment choice');
requireText('payNow.defaultSelected=true;','online card default behavior is missing');
requireText('payNow.selected=true;','online card selection behavior is missing');

if(failures.length){
  console.error('Payment capability selection guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Payment capability selection guard OK: late capability responses cannot overwrite an explicit payment choice.');

import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

if(js.includes('customer,attribution:attr})'))failures.push('capacity request still sends attribution unconditionally');
if(!js.includes("customer,...(analyticsAllowed()?{attribution:attr}:{})})"))failures.push('capacity request attribution is not gated by analytics consent');
if(!js.includes("const analyticsAllowed=()=>consent.analytics===true"))failures.push('canonical analytics consent predicate missing');

if(failures.length){
  console.error('Capacity-request attribution consent guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Capacity-request attribution consent guard OK: operational customer data can be submitted without optional attribution, which is sent only after analytics consent.');

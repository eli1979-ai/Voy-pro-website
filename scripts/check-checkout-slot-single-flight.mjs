import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('let checkoutPreparationGeneration=0;','checkout preparation generation state is missing');
requireText('let checkoutPreparationActiveGeneration=null;','checkout active-generation state is missing');
requireText('if(checkoutPreparationActiveGeneration===preparationGeneration)return;','duplicate checkout preparation is not blocked within the active generation');
requireText("slotList.setAttribute('aria-busy','true')",'slot list does not expose busy state while quote/hold is created');
requireText('enabledSlots.forEach(btn=>btn.disabled=true);','actionable departure buttons are not locked while quote/hold is created');
requireText("if(slotList)slotList.removeAttribute('aria-busy');",'slot busy state is not cleared for the active generation');
requireText('if(!completed&&preparationGeneration===checkoutPreparationGeneration)enabledSlots.forEach(btn=>btn.disabled=false);','departure buttons are not restored safely after a failed current-generation quote/hold attempt');
requireText("const hold=await api('/holds'",'hold creation call is missing');

if(failures.length){
  console.error('Checkout slot single-flight guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout slot single-flight guard OK: one active generation can create only one quote/hold preparation at a time.');

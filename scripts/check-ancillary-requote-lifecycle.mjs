import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('const checkoutKey=bookingState.idempotencyKey;','ancillary re-quote does not snapshot checkout identity');
requireText("const slotId=String(bookingState.slot?.id||'');",'ancillary re-quote does not snapshot slot identity');
requireText('const selectionGeneration=checkoutPreparationGeneration;','ancillary re-quote does not snapshot selection generation');
requireText('slot_id:slotId','ancillary re-quote does not use the slot snapshot');
requireText("if(selectionGeneration!==checkoutPreparationGeneration||bookingState.idempotencyKey!==checkoutKey||String(bookingState.slot?.id||'')!==slotId)return;\n      assertCheckoutQuote(quote);",'ancillary re-quote is not validated before replacing the current checkout quote');
requireText("e?.code==='QUOTE_INVALID'",'ancillary invalid quote does not surface a truthful recovery message');
const staleCheck="selectionGeneration!==checkoutPreparationGeneration||bookingState.idempotencyKey!==checkoutKey||String(bookingState.slot?.id||'')!==slotId";
if(js.split(staleCheck).length-1<2)failures.push('ancillary success and error paths do not reject stale checkout work');
requireText("if(selectionGeneration===checkoutPreparationGeneration&&bookingState.idempotencyKey===checkoutKey&&String(bookingState.slot?.id||'')===slotId&&node)node.removeAttribute('aria-busy');",'stale ancillary request can clear busy state for a newer checkout');

requireText("...(bookingState.isPrivate&&bookingState.hold?.id?{hold_id:bookingState.hold.id}:{})",'private ancillary re-quote must pass the current hold instead of re-checking blocked availability');
if(failures.length){
  console.error('Ancillary re-quote lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Ancillary re-quote lifecycle guard OK: stale quote responses cannot overwrite or revert a newer checkout selection.');

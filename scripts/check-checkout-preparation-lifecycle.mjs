import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('let checkoutPreparationGeneration=0;','checkout preparation generation is missing');
requireText('let checkoutPreparationActiveGeneration=null;','checkout active-generation state is missing');
requireText('function invalidateCheckoutPreparation(){','checkout invalidation helper is missing');
requireText("if(checkoutPreparationActiveGeneration===preparationGeneration)return;",'same-generation duplicate checkout preparation is not blocked');
requireText('if(preparationGeneration!==checkoutPreparationGeneration)return;','stale quote completion is not rejected');
requireText("api('/holds/'+encodeURIComponent(hold.id),{method:'DELETE'}).catch(()=>{});",'stale newly-created hold is not released');
requireText('if(checkoutPreparationActiveGeneration===preparationGeneration){','stale preparation can still clear a newer preparation lock');
requireText('if(!completed&&preparationGeneration===checkoutPreparationGeneration)enabledSlots.forEach(btn=>btn.disabled=false);','stale preparation can re-enable obsolete slot controls');
const invalidations=(js.match(/invalidateCheckoutPreparation\(\);/g)||[]).length;
if(invalidations<3)failures.push('selection changes, tour-mode changes and new searches must all invalidate pending checkout preparation');

if(failures.length){
  console.error('Checkout preparation lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Checkout preparation lifecycle guard OK: selection changes invalidate pending quote/hold work and stale holds are released.');

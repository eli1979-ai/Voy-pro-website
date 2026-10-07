import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText('let availabilitySearchGeneration=0;','shared availability generation state is missing');
requireText("if(!silent){\n        availabilitySearchGeneration++;",'tour-mode changes do not invalidate in-flight availability work');
requireText("availabilitySearchGeneration++;\n        invalidateCheckoutPreparation();\n        releaseHold();",'tour-mode changes do not invalidate pending checkout preparation before releasing hold/results');
requireText('const searchGeneration=++availabilitySearchGeneration;','availability searches do not share the same generation');
requireText('if(searchGeneration!==availabilitySearchGeneration)return;','stale availability responses are not rejected');
const declarations=(js.match(/let availabilitySearchGeneration=0;/g)||[]).length;
if(declarations!==1)failures.push('availability generation state must have exactly one shared declaration');

if(failures.length){
  console.error('Private-mode availability invalidation guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Private-mode availability invalidation guard OK: switching Standard/Private invalidates in-flight availability and checkout preparation work.');

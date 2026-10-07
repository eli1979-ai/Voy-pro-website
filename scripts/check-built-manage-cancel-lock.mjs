import fs from 'node:fs';
import vm from 'node:vm';

const file='dist/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("if(cancel.dataset.busy==='true'||document.getElementById('manage-change-status')?.dataset.busy==='true')return;",'cancellation mutation lacks single-flight/cross-mutation lock');
requireText("delete cancel.dataset.busy;cancel.disabled=false;if(cancelDate)cancelDate.disabled=false;if(cancelSearch)cancelSearch.disabled=false;",'failed cancellation does not release the mutation/cross-control lock');
requireText("'/cancel',{method:'POST'",'cancellation POST missing');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-cancel-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Manage cancellation lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage cancellation lock guard OK: destructive cancellation is single-flight and retryable after failure.');

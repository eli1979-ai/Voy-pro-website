import fs from 'node:fs';
import vm from 'node:vm';

const file='dist/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("if(cancel.dataset.busy==='true')return;cancel.dataset.busy='true';cancel.disabled=true",'cancellation mutation lacks single-flight lock');
requireText("delete cancel.dataset.busy;cancel.disabled=false",'failed cancellation does not release the lock');
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

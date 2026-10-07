import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("if(cf.dataset.busy==='true')return;cf.dataset.busy='true'",'contact update lacks single-flight lock');
requireText("delete cf.dataset.busy;if(submit)submit.disabled=false",'contact update does not release its lock');
requireText("if(riderForm.dataset.busy==='true')return;riderForm.dataset.busy='true'",'rider/waiver save lacks single-flight lock');
requireText("delete riderForm.dataset.busy;if(submit)submit.disabled=false",'rider/waiver save does not release its lock');
requireText("'/riders',{method:'PATCH'",'rider/waiver PATCH missing');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-form-lock-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Manage form mutation lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage form mutation lock guard OK: contact and rider/waiver saves are single-flight and final inline scripts compile.');

import fs from 'node:fs';
import vm from 'node:vm';

const file='dist/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];

const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(html.includes(text))failures.push(label);};

requireText("controller=externalSignal?null:new AbortController()",'Manage API wrapper lacks AbortController timeout');
requireText("Number(opt.timeoutMs||8000)",'Manage API wrapper lacks bounded default timeout');
requireText("er.code='REQUEST_TIMEOUT'",'Manage API wrapper lacks timeout error normalization');
requireText("finally{if(timer)clearTimeout(timer)}",'Manage API wrapper does not clear timeout timer');
forbidText("const api=async(path,opt={})=>{const r=await fetch(c.apiRoot+path,{...opt,headers:{...h,...(opt.headers||{})}});",'unbounded Manage API wrapper remains');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Built Manage API timeout guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built Manage API timeout guard OK: FBM calls are bounded and '+inlineScripts+' inline script(s) compile.');

import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(js.includes(text))failures.push(label);};

requireText("cache:fetchOptions.cache||'no-store'",'runtime API wrapper lacks no-store default');
requireText("const {timeoutMs:_timeoutMs,...fetchOptions}=options;",'runtime API wrapper no longer preserves caller options');
requireText("signal:externalSignal||controller?.signal,cache:fetchOptions.cache||'no-store'",'runtime API wrapper must keep timeout signal and no-store together');
forbidText("fetch(apiRoot+path,{...fetchOptions,headers,signal:externalSignal||controller?.signal});",'cacheable runtime API fetch remains');

if(failures.length){
  console.error('Runtime API no-store guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Runtime API no-store guard OK: browser-side FBM requests default to no-store while explicit caller cache options remain supported.');

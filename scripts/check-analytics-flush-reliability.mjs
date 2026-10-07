import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const controller=new AbortController();\n    const timer=setTimeout(()=>controller.abort(),5000);",'analytics flush timeout missing');
requireText("signal:controller.signal",'analytics event fetch is not abortable');
requireText("cache:'no-store'",'analytics event fetch should not use browser cache');
requireText("clearTimeout(timer);\n      eventFlushInFlight=false;",'analytics flush timer must be cleared before releasing in-flight state');
requireText("if(remaining.length&&!keepalive) scheduleEventFlush(false);",'failed analytics events must remain retryable');

if(failures.length){
  console.error('Analytics flush reliability guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Analytics flush reliability guard OK: event delivery is bounded, non-blocking and retryable.');

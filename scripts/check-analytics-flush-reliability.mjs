import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("const controller=new AbortController();\n    const timer=setTimeout(()=>controller.abort(),5000);",'analytics flush timeout missing');
requireText("signal:controller.signal",'analytics event fetch is not abortable');
requireText("cache:'no-store'",'analytics event fetch should not use browser cache');
requireText("clearTimeout(timer);", 'analytics request timeout must be cleared');
requireText("eventFlushInFlight=false;",'analytics in-flight flag must be reset after request');
requireText("eventFlushFailures=Math.min(8,eventFlushFailures+1)",'analytics retries must count bounded failures');
requireText("ANALYTICS_RETRY_MAX_MS=120000",'analytics retry backoff maximum must be defined');
requireText("if(generation!==eventFlushGeneration||!analyticsAllowed())return;",'stale in-flight responses cannot restore revoked consent data');
requireText("cancelEventFlush();",'consent revocation must cancel optional in-flight telemetry');
requireText("if(remaining.length&&!keepalive) scheduleEventFlush(false);",'failed analytics events must remain retryable');

if(failures.length){
  console.error('Analytics flush reliability guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Analytics flush reliability guard OK: event delivery is bounded, non-blocking and retryable.');

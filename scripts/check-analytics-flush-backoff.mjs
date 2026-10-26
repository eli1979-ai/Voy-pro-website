// Deterministic VM test of the actual shipped analytics queue functions.
// No browser APIs, network, third-party analytics, timers or customer data are used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('site/assets/site.js','utf8');
const begin=src.indexOf('  let eventFlushTimer=null;');
const end=src.indexOf('  function track(event,metadata={}){',begin);
assert.ok(begin>0&&end>begin,'expected analytics implementation boundaries');
const implementation=src.slice(begin,end);

function harness(respond){
  const data=new Map([['voy_event_queue_v1',JSON.stringify([
    {event_id:'synthetic-1',event:'synthetic_qa',metadata:{}}
  ])]]);
  const timers=new Map();
  const calls=[];
  let nextTimer=0;
  let allowed=true;
  const context={
    EVENT_KEY:'voy_event_queue_v1',
    analyticsAllowed:()=>allowed,bookingEnabled:true,
    safeJSON:(value,fallback)=>{try{return JSON.parse(value)}catch{return fallback}},
    getStore:key=>data.get(key)||null,
    setStore:(key,value)=>data.set(key,value),
    apiRoot:'https://fixture.invalid/api/v1',
    authHeaders:()=>({'Content-Type':'application/json'}),
    AbortController,
    fetch:async(url,options)=>{
      calls.push({url,options});
      return respond(calls.length,url,options);
    },
    setTimeout:(fn,ms)=>{
      const id=++nextTimer;timers.set(id,{fn,ms});return id;
    },
    clearTimeout:id=>timers.delete(id),
    JSON,Set,Math,
  };
  const api=vm.runInNewContext(implementation+
    '\n({flushEventQueue,scheduleEventFlush,cancelEventFlush})',context);
  return {
    ...api,calls,timers,data,
    get queue(){return JSON.parse(data.get('voy_event_queue_v1')||'[]')},
    get retryDelay(){
      return [...timers.values()].map(x=>x.ms).filter(ms=>ms!==5000||timers.size===1)
        .at(-1)??null;
    },
    setAllowed(value){allowed=value},
    clear(){data.delete('voy_event_queue_v1')}
  };
}

// A failed API must retain consented anonymous events but avoid hammering
// the endpoint every 1.4 seconds. Failure state never breaks booking.
const failures=harness(n=>({ok:n>=3,status:n>=3?200:503}));
await failures.flushEventQueue();
assert.equal(failures.calls.length,1);
assert.equal(failures.queue.length,1,'temporary HTTP error must not lose events');
assert.ok([...failures.timers.values()].some(t=>t.ms===5000),
  'first failed attempt must schedule a five-second retry');
failures.scheduleEventFlush(true);
assert.ok([...failures.timers.values()].every(t=>t.ms>=5000),
  'new conversion events may not bypass the active failure backoff');
await failures.flushEventQueue();
assert.ok([...failures.timers.values()].some(t=>t.ms===10000),
  'second failed attempt must double the retry delay');
await failures.flushEventQueue();
assert.equal(failures.queue.length,0,'successful response removes only accepted events');
assert.equal(failures.timers.size,0,'successful flush clears retry timers');
failures.data.set('voy_event_queue_v1',JSON.stringify([{event_id:'synthetic-2'}]));
failures.scheduleEventFlush(false);
assert.ok([...failures.timers.values()].some(t=>t.ms===1400),
  'backoff must reset after success');

// Persistent transport rejection should cap at two minutes, not overflow.
const broken=harness(()=>{throw Error('fixture network offline')});
for(let n=0;n<9;n++)await broken.flushEventQueue();
assert.ok([...broken.timers.values()].some(t=>t.ms===120000),
  'persistent errors must have a hard retry ceiling');
assert.equal(broken.queue.length,1,'offline errors keep the queue available');

// Revocation during an outstanding request invalidates the reply, even if
// the guest opts into analytics again before the old response completes.
let completeOld;
const pending=harness(()=>new Promise(resolve=>{completeOld=resolve}));
const outstanding=pending.flushEventQueue();
assert.equal(pending.calls.length,1);
pending.setAllowed(false);
pending.cancelEventFlush();
assert.ok(pending.calls[0].options.signal.aborted,
  'revoke must abort the in-flight optional analytics request');
pending.clear();
pending.setAllowed(true);
pending.data.set('voy_event_queue_v1',JSON.stringify([{event_id:'new-consented-event'}]));
completeOld({ok:true,status:200});
await outstanding;
assert.equal(pending.queue[0].event_id,'new-consented-event',
  'old response must not consume post-revocation telemetry');
assert.equal(pending.queue.length,1);
assert.ok([...pending.timers.values()].some(t=>t.ms===1400),
  'newly consented events remain eligible for later delivery');

// The background pagehide effort must not start any timed retry.
const background=harness(()=>({ok:false,status:503}));
await background.flushEventQueue({keepalive:true});
assert.equal(background.timers.size,0,'pagehide must not schedule retry loops');
assert.equal(background.queue.length,1);

console.log('PASS: analytics retry is bounded, consent revocation aborts and fences stale responses, successful delivery resets retries, and pagehide does not loop.');

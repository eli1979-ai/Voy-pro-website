import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('site/assets/site.js','utf8');
const start=src.indexOf('function startHoldTimer(expires)');
const end=src.indexOf('\n\n  function setBookingStep',start);
assert.ok(start>=0&&end>start,'hold timer source function missing');
const fn=src.slice(start,end);
const ready=src.slice(src.indexOf('async function prepareStandardCheckout('),src.indexOf('function capacityRequestForm(',src.indexOf('async function prepareStandardCheckout(')));
const holdCheck=ready.indexOf('if(!startHoldTimer(hold.expires_at)){');
assert.ok(holdCheck>=0,'checkout must fail closed when hold expiry is invalid or already past');
assert.ok(ready.indexOf('loadAncillaryOffers();')>holdCheck,'extras must not load for expired hold');
assert.ok(ready.indexOf("patchSession({stage:'checkout_ready'")>holdCheck,'invalid hold must not create checkout-ready session state');

function simulate(expires,{hasTimerNode=true}={}){
  const events=[], node=hasTimerNode?{textContent:''}:null;
  const sandbox={
    Date, Math, Number, String, holdTimer:null,
    document:{querySelector:()=>node},
    setInterval:()=>{events.push('interval');return 17},
    clearInterval:()=>events.push('clear'),
    releaseHold:()=>events.push('release'),
    lockExpiredCheckout:()=>events.push('lock'),
    patchSession:data=>events.push(data.stage),
    now:()=>new Date().toISOString(),
    t:english=>english,
  };
  vm.runInNewContext(fn,sandbox,{timeout:1000});
  const result=vm.runInNewContext('startHoldTimer('+JSON.stringify(expires)+')',sandbox,{timeout:1000});
  return {result,events,node};
}
const future=simulate(new Date(Date.now()+60000).toISOString());
assert.equal(future.result,true,'future valid hold should proceed');
assert.equal(future.events.filter(e=>e==='interval').length,1,'valid hold needs countdown');
assert.ok(future.node.textContent.includes('Your places are held for'),'valid hold countdown text missing');

const expired=simulate(new Date(Date.now()-60000).toISOString());
assert.equal(expired.result,false,'expired hold should fail closed');
assert.equal(expired.events.filter(e=>e==='interval').length,0,'expired hold must not create an interval');
assert.equal(expired.events.filter(e=>e==='hold_expired').length,1,'expired hold must report just once');
assert.ok(expired.events.includes('lock'),'expired hold should disable checkout');

const invalid=simulate('not-an-expiry');
assert.equal(invalid.result,false,'unverifiable expiry should fail closed');
assert.equal(invalid.events.filter(e=>e==='interval').length,0,'invalid expiry must not create interval');
assert.ok(invalid.events.includes('release')&&invalid.events.includes('lock'),'invalid expiry should release hold and disable checkout');
assert.ok(invalid.events.includes('hold_expired'),'invalid expiry must be recorded');

const missing=simulate(new Date(Date.now()+60000).toISOString(),{hasTimerNode:false});
assert.equal(missing.result,false,'missing timer node must fail closed');
assert.equal(missing.events.filter(e=>e==='interval').length,0,'missing timer node must not schedule hidden hold timer');
console.log('PASS: checkout holds validate before ready state; valid, expired, invalid, and missing-timer cases handled.');

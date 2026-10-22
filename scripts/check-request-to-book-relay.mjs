import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const route=require('../api/request-to-book.js');
const parse=async(method,body,headers={})=>{
  const h={'host':'preview.voy-pro.vercel.app','origin':'https://preview.voy-pro.vercel.app',
    'content-type':'application/json',...headers};
  let status=0,headersOut={},output='';
  const res={setHeader(k,v){headersOut[k]=v;},end(v){output=v;},
    get statusCode(){return status;},set statusCode(v){status=v;}};
  await route({method,headers:h,body},res);
  return {status,body:JSON.parse(output),headers:headersOut};
};
const original={...process.env};
const originalFetch=globalThis.fetch;
try{
  let calls=[];
  globalThis.fetch=async(url,opts)=>{
    calls.push({url:String(url),opts});
    return {status:202,json:async()=>({requestId:'test-request-id',status:'pending_review'})};
  };
  process.env.VOY_RTB_RELAY_ENABLED='false';
  process.env.VOY_RTB_ABUSE_PROTECTION_VERIFIED='true';
  process.env.VOY_RTB_FBM_BASE_URL='https://ezraider-os-staging.vercel.app/';
  process.env.VOY_RTB_FBM_INTAKE_SECRET='local-test-only-string-over-32-characters';
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',
    year:'numeric',month:'2-digit',day:'2-digit'});
  const p=Object.fromEntries(date.formatToParts(new Date(Date.now()+4*86400000))
    .map(x=>[x.type,x.value]));
  const day=p.year+'-'+p.month+'-'+p.day;
  const base={tourSlug:'heroes-square',preferredLocalDate:day,
    preferredLocalTime:'14:00',partySize:2,contactName:'Synthetic Guest',
    email:'synthetic@example.invalid',phone:'',
    requestedGuideLanguage:'he',englishAlternativeAccepted:false,
    requestId:'11111111-1111-4111-8111-111111111111'};
  let result=await parse('POST',base);
  assert.equal(result.status,404);
  assert.equal(calls.length,0);
  process.env.VOY_RTB_RELAY_ENABLED='true';
  process.env.VOY_RTB_ABUSE_PROTECTION_VERIFIED='false';
  assert.equal((await parse('POST',base)).status,404);
  assert.equal(calls.length,0);
  process.env.VOY_RTB_ABUSE_PROTECTION_VERIFIED='true';
  assert.equal((await parse('GET',base)).status,405);
  assert.equal((await parse('POST',base,{origin:'https://evil.example'})).status,403);
  assert.equal((await parse('POST',base,{'content-type':'text/plain'})).status,415);
  assert.equal((await parse('POST',base,{'content-length':'7000'})).status,413);
  assert.equal((await parse('POST',{...base,requestedGuideLanguage:''})).status,400);
  assert.equal((await parse('POST',{...base,englishAlternativeAccepted:'yes'})).status,400);
  assert.equal((await parse('POST',{...base,englishAlternativeAccepted:undefined})).status,400);
  assert.equal((await parse('POST',{...base,requestId:'missing'})).status,400);
  assert.equal((await parse('POST',{...base,requestId:'11111111-1111-1111-8111-111111111111'})).status,400);
  assert.equal((await parse('POST',{...base,requestId:'11111111-1111-4111-1111-111111111111'})).status,400);
  assert.equal((await parse('POST',{...base,requestedGuideLanguage:'en',englishAlternativeAccepted:true})).status,400);
  assert.equal((await parse('POST',{...base,extraSensitiveInput:'bad'})).status,400);
  assert.equal((await parse('POST',{...base,preferredLocalDate:'2026-10-25',preferredLocalTime:'02:30'})).status,400);
  assert.equal((await parse('POST',{...base,preferredLocalDate:'2027-03-28',preferredLocalTime:'02:30'})).status,400);
  assert.equal(route._test.resolveBudapestInstant('2026-10-25','02:30'),null);
  assert.equal(route._test.resolveBudapestInstant('2027-03-28','02:30'),null);
  assert.equal(route._test.resolveBudapestInstant('2026-10-25','03:30'),'2026-10-25T02:30:00.000Z');
  assert.equal(route._test.resolveBudapestInstant('2027-03-28','03:30'),'2027-03-28T01:30:00.000Z');
  assert.equal(route._test.resolveBudapestInstant('2026-02-30','10:00'),null);
  assert.equal(calls.length,0);
  const payload={...base,preferredLocalDate:day};
  // Date can fall on a DST transition; 14:00 is always unambiguous.
  result=await parse('POST',payload);
  assert.equal(result.status,202);
  assert.equal(result.body.status,'pending_review');
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).pathname,'/api/public/request-to-book');
  assert.equal(calls[0].opts.headers['x-fbm-intake-secret'],process.env.VOY_RTB_FBM_INTAKE_SECRET);
  const forwarded=JSON.parse(calls[0].opts.body);
  assert.equal(forwarded.requestedGuideLanguage,'he');
  assert.equal(forwarded.englishAlternativeAccepted,false);
  assert.equal(forwarded.requestId,payload.requestId);
  assert.ok(forwarded.preferredStartAt.endsWith('Z'));
  // A new request with an actual positive choice can carry English as an
  // alternative to Hebrew without inventing that consent from the locale.
  globalThis.fetch=async(url,opts)=>{
    calls.push({url:String(url),opts});
    return {status:202,json:async()=>({requestId:'opted-in',status:'pending_review'})};
  };
  const optedIn={...payload,requestId:'22222222-2222-4222-8222-222222222222',englishAlternativeAccepted:true};
  assert.equal((await parse('POST',optedIn)).status,202);
  assert.equal(JSON.parse(calls.at(-1).opts.body).englishAlternativeAccepted,true);
  calls.splice(1);
  // Deterministic FBM idempotency stand-in: identical request replays
  // produce the same acknowledgement, changed language/consent returns 409.
  const seen=new Map();
  globalThis.fetch=async(url,opts)=>{
    const submitted=JSON.parse(opts.body);
    const previous=seen.get(submitted.requestId);
    if(previous&&previous!==JSON.stringify(submitted))return {status:409};
    if(!previous)seen.set(submitted.requestId,JSON.stringify(submitted));
    return {status:202,json:async()=>({requestId:'stable-crm-request',status:'pending_review'})};
  };
  const stableA=await parse('POST',payload);
  const stableB=await parse('POST',payload);
  assert.equal(stableA.status,202);
  assert.deepEqual(stableB,stableA);
  assert.equal((await parse('POST',{...payload,requestedGuideLanguage:'hu'})).status,409);
  assert.equal((await parse('POST',{...payload,englishAlternativeAccepted:true})).status,409);
  assert.equal(seen.size,1);
  assert.equal(JSON.stringify(result.body).includes(process.env.VOY_RTB_FBM_INTAKE_SECRET),false);
  globalThis.fetch=async()=>({status:409});
  assert.equal((await parse('POST',payload)).status,409);
  globalThis.fetch=async()=>{throw new Error('private outage')};
  assert.deepEqual((await parse('POST',payload)).body,{error:'request_unavailable'});
  globalThis.fetch=async()=>({status:202,json:async()=>({requestId:'ok',status:'approved'})});
  assert.equal((await parse('POST',payload)).status,503);
  // A permitted hostname on an unapproved TCP port is not the permitted
  // Staging HTTPS origin; must fail closed before any outbound request.
  calls=[];
  globalThis.fetch=async()=>{calls.push(1)};
  process.env.VOY_RTB_FBM_BASE_URL='https://ezraider-os-staging.vercel.app:8443/';
  assert.equal((await parse('POST',payload)).status,503);
  assert.equal(calls.length,0);
  // Non-default ports are rejected, while the canonical default 443 form
  // remains equivalent to the vetted HTTPS origin.
  process.env.VOY_RTB_FBM_BASE_URL='https://ezraider-os-staging.vercel.app:443/';
  globalThis.fetch=async(url,opts)=>{
    calls.push({url:String(url),opts});
    return {status:202,json:async()=>({requestId:'test-default-port',status:'pending_review'})};
  };
  assert.equal((await parse('POST',payload)).status,202);
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).port,'');
  process.env.VOY_RTB_FBM_BASE_URL='https://example.com/';
  calls=[];
  globalThis.fetch=async()=>{calls.push(1)};
  assert.equal((await parse('POST',payload)).status,503);
  assert.equal(calls.length,0);
  console.log('Budapest RTB server relay (disabled-by-default, origin, DST, consent, request ID, upstream fail-closed) OK');
}finally{
  globalThis.fetch=originalFetch;
  for(const k of ['VOY_RTB_RELAY_ENABLED','VOY_RTB_ABUSE_PROTECTION_VERIFIED',
    'VOY_RTB_FBM_BASE_URL','VOY_RTB_FBM_INTAKE_SECRET']){
    if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];
  }
}

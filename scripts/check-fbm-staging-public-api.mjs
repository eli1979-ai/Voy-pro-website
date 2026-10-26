// Read-only network smoke for the public VOY PRO -> FBM *Staging* contract.
// Uses only the browser PUBLIC client key from tracked runtime config.
// No cookies, secrets, POST/holds, bookings, customer data, payment intent,
// Production host, or any mutation. Passing is NOT Production readiness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const STAGING='https://ezraider-os-staging.vercel.app/api/v1';
export const PROBES=[
  {id:'budapest_config',route:'/destinations/budapest'},
  {id:'budapest_catalog',route:'/experiences?destination=budapest'},
  {id:'payment_capability',route:'/payments/capabilities'}
];

function safeUrl(raw,expected){
  const url=new URL(raw);
  const base=new URL(STAGING);
  if(url.protocol!=='https:'||url.host!==base.host||url.username||
    url.password||url.port||url.hash||![
      expected.pathname, expected.pathname+'/'
    ].includes(url.pathname)||url.search!==expected.search)
    throw Error('Unsafe FBM Staging public endpoint or redirect');
  return url;
}
export function publicClientConfig(text){
  const root=text.match(/\bapiRoot\s*:\s*'([^']+)'/);
  const key=text.match(/\bclientKey\s*:\s*'([^']+)'/);
  if(!root||root[1]!==STAGING||!key||
    !/^[A-Za-z0-9_-]{12,180}$/.test(key[1]))
    throw Error('Public website FBM Staging API/client scope is missing or unexpected');
  return {apiRoot:root[1],clientKey:key[1]};
}
function fields(obj,keys){
  return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
    keys.every(key=>Object.prototype.hasOwnProperty.call(obj,key));
}
function validDestination(value){
  return fields(value,['id','currency','timezone','rider_policy','meeting_point'])&&
    value.id==='budapest'&&value.currency==='EUR'&&
    value.timezone==='Europe/Budapest'&&
    fields(value.rider_policy,['standard_min_age'])&&
    Number.isFinite(value.rider_policy.standard_min_age)&&
    fields(value.meeting_point,['address'])&&
    typeof value.meeting_point.address==='string'&&
    value.meeting_point.address.length>4;
}
function validCatalog(value){
  return Array.isArray(value)&&value.length>0&&value.length<=100&&
    value.every(item=>fields(item,
      ['id','slug','title','durationMinutes','priceFrom','currency','guideLanguages','bookingEnabled'])&&
      typeof item.id==='string'&&!!item.id&&
      typeof item.slug==='string'&&!!item.slug&&
      typeof item.title==='string'&&!!item.title&&
      Number.isFinite(item.durationMinutes)&&item.durationMinutes>0&&
      Number.isFinite(item.priceFrom)&&item.priceFrom>=0&&
      item.currency==='EUR'&&
      typeof item.bookingEnabled==='boolean'&&
      Array.isArray(item.guideLanguages)&&item.guideLanguages.length>0&&
      item.guideLanguages.every(lang=>/^[a-z]{2}$/.test(lang)));
}
function validPayment(value){
  // Match the full canonical FBM PublicPaymentCapabilitiesSchema and the
  // affiliate widget's fail-closed readiness gate. A 200 advertising online
  // card without actual provider, reason or mode consistency is not ready.
  if(!fields(value,['online_card','provider','mode','readiness'])||
     typeof value.online_card!=='boolean'||value.mode!=='test'||
     !fields(value.readiness,['status','reason']))return false;
  const {status,reason}=value.readiness;
  if(value.online_card)return value.provider==='stripe'&&
    status==='ready'&&reason===null;
  return value.provider===null&&status==='unavailable'&&
    ['provider_disabled','provider_secret_missing','webhook_secret_missing'].includes(reason);
}
const validators={
  budapest_config:validDestination,
  budapest_catalog:validCatalog,
  payment_capability:validPayment
};

async function readOne(probe,request,config){
  const canonical=new URL(STAGING+probe.route);
  let url=safeUrl(canonical.href,canonical);
  const seen=new Set();
  for(let redirects=0;redirects<=3;redirects++){
    if(seen.has(url.href))throw Error('Redirect loop');
    seen.add(url.href);
    const response=await request(url.href,{
      method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
      headers:{
        accept:'application/json',
        origin:'https://voy-pro.com',
        'x-voy-client':'voy-pro-website',
        'x-voy-client-key':config.clientKey
      },
      signal:AbortSignal.timeout(10000)
    });
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      await response.body?.cancel();
      if(!location)throw Error('Redirect without Location');
      url=safeUrl(new URL(location,url).href,canonical);
      continue;
    }
    if(response.status!==200){
      await response.body?.cancel();
      throw Error('Public GET returned HTTP '+response.status);
    }
    const type=response.headers.get('content-type')||'';
    if(!type.toLowerCase().includes('application/json'))
      throw Error('Public GET did not return JSON');
    const length=Number(response.headers.get('content-length')||'0');
    if(length>128000)throw Error('Unexpectedly large JSON payload');
    const raw=await response.text();
    if(raw.length>128000)throw Error('Unexpectedly large JSON payload');
    let value;
    try{value=JSON.parse(raw)}catch{throw Error('Invalid public JSON response')}
    if(!validators[probe.id](value))throw Error('Public response shape/semantics mismatched website consumer contract');
    const cors=response.headers.get('access-control-allow-origin');
    if(cors!=='https://voy-pro.com'&&cors!=='*')
      throw Error('Website Origin not allowed by Staging CORS');
    return {id:probe.id,ok:true,reason:'GET 200; public JSON contract; allowed website CORS'};
  }
  throw Error('Too many redirects');
}

// Real browser fetch to FBM sends x-voy-client-key, x-voy-client and
// application/json, which triggers a CORS OPTIONS preflight BEFORE any GET.
// A successful server-side GET alone cannot demonstrate browser usability.
async function readBrowserPreflight(probe,request){
  const canonical=new URL(STAGING+probe.route);
  let url=safeUrl(canonical.href,canonical);
  const seen=new Set();
  for(let redirects=0;redirects<=3;redirects++){
    if(seen.has(url.href))throw Error('OPTIONS redirect loop');
    seen.add(url.href);
    const response=await request(url.href,{
      method:'OPTIONS',redirect:'manual',credentials:'omit',cache:'no-store',
      headers:{
        origin:'https://voy-pro.com',
        'access-control-request-method':'GET',
        'access-control-request-headers':'content-type,x-voy-client-key,x-voy-client'
      },
      signal:AbortSignal.timeout(10000)
    });
    if([301,302,303,307,308].includes(response.status)){
      // Actual browser CORS preflight redirects are not consistently followed.
      await response.body?.cancel();
      throw Error('Browser CORS preflight redirected (requires direct response)');
    }
    if(response.status!==204){
      await response.body?.cancel();
      throw Error('Browser CORS preflight HTTP '+response.status+' (expected 204)');
    }
    const origin=response.headers.get('access-control-allow-origin');
    const methods=String(response.headers.get('access-control-allow-methods')||'')
      .toUpperCase().split(',').map(x=>x.trim());
    const headers=String(response.headers.get('access-control-allow-headers')||'')
      .toLowerCase().split(',').map(x=>x.trim());
    const vary=String(response.headers.get('vary')||'')
      .toLowerCase().split(',').map(x=>x.trim());
    await response.body?.cancel();
    if(origin!=='https://voy-pro.com')throw Error('Browser Origin missing from CORS preflight');
    if(!methods.includes('GET'))throw Error('GET not permitted in CORS preflight');
    if(!['content-type','x-voy-client-key','x-voy-client'].every(x=>headers.includes(x)))
      throw Error('Required public browser request headers not permitted');
    if(!vary.includes('origin'))throw Error('CORS response must vary by Origin');
    return {id:probe.id+'_browser_preflight',ok:true,
      reason:'OPTIONS 204; website Origin, GET, all browser headers and Vary: Origin'};
  }
  throw Error('Too many OPTIONS redirects');
}
export async function audit(request=fetch,config=publicClientConfig(
  fs.readFileSync('site/assets/runtime-config.js','utf8')),probes=PROBES){
  const rows=[];
  for(const probe of probes){
    try{
      rows.push(await readBrowserPreflight(probe,request));
    }catch(e){
      rows.push({id:probe.id+'_browser_preflight',ok:false,
        reason:String(e?.message||e).slice(0,170)});
    }
    try{
      rows.push(await readOne(probe,request,config));
    }catch(e){
      rows.push({id:probe.id,ok:false,reason:String(e?.message||e).slice(0,170)});
    }
  }
  return {rows,passed:rows.filter(row=>row.ok).length,
    failed:rows.filter(row=>!row.ok).length};
}
export function report(result){
  return [
    '# VOY PRO — FBM Staging public read-only API contract',
    '',
    '**Checked:** '+new Date().toISOString()+' (UTC). Public browser CORS OPTIONS preflight and GET only, no customer details, cookies, secret keys, bookings, holds or payment operations.',
    '',
    '**Result:** '+result.passed+'/'+result.rows.length+' passed; '+result.failed+' failed.',
    '',
    '| Staging endpoint | Result | Evidence |',
    '| --- | --- | --- |',
    ...result.rows.map(row=>'| '+row.id+' | '+(row.ok?'PASS':'FAIL')+' | '+row.reason.replace(/\|/g,'/')+' |'),
    '',
    '**Boundary:** browser OPTIONS+GET verifies only these three public Staging read routes. It does not verify Production, partner-origin CORS, or availability (its GET handler can invoke departure-creation RPC), checkout, card charging, staffing, or migrations. The cutover decision remains NO-GO.',
    ''
  ].join('\n');
}
async function test(){
  const key='voy_bud_stg_mock_public_12345';
  assert.deepEqual(publicClientConfig(
    "window.VOY_RUNTIME_CONFIG={apiRoot:'"+STAGING+"',clientKey:'"+key+"'};"),
    {apiRoot:STAGING,clientKey:key});
  assert.throws(()=>publicClientConfig(
    "window.VOY_RUNTIME_CONFIG={apiRoot:'https://my-production.example/api/v1',clientKey:'"+key+"'};"));
  const mocks={
    budapest_config:{
      id:'budapest',currency:'EUR',timezone:'Europe/Budapest',
      rider_policy:{standard_min_age:16},
      meeting_point:{address:'Test Budapest, Hungary'}
    },
    budapest_catalog:[{
      id:'tour-1',slug:'buda',title:'Buda',durationMinutes:90,priceFrom:70,
      currency:'EUR',guideLanguages:['en','he'],bookingEnabled:true
    }],
    payment_capability:{
      online_card:false,provider:null,mode:'test',readiness:{status:'unavailable',reason:'provider_disabled'}
    }
  };
  const configs={apiRoot:STAGING,clientKey:key};
  const apiHeaders={
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-origin':'https://voy-pro.com'
  };
  const requests=[];
  const preflightHeaders={
    'access-control-allow-origin':'https://voy-pro.com',
    'access-control-allow-methods':'GET,OPTIONS',
    'access-control-allow-headers':'content-type,x-voy-client-key,x-voy-client',
    vary:'Origin'
  };
  const respond=async(uri,init)=>{
    requests.push({uri,method:init.method,credentials:init.credentials});
    const probe=PROBES.find(p=>new URL(STAGING+p.route).href===uri);
    assert.ok(probe,'API audit must call only allowlisted public GET paths');
    assert.ok(['GET','OPTIONS'].includes(init.method),'No mutating HTTP verbs');
    assert.equal(init.credentials,'omit');
    if(init.method==='OPTIONS'){
      assert.equal(init.headers.origin,'https://voy-pro.com');
      assert.equal(init.headers['access-control-request-method'],'GET');
      assert.equal(init.headers['access-control-request-headers'],
        'content-type,x-voy-client-key,x-voy-client');
      assert.ok(!init.headers['x-voy-client-key'],'Browser preflight cannot send the client key');
      return new Response(null,{status:204,headers:preflightHeaders});
    }
    return new Response(JSON.stringify(mocks[probe.id]),{status:200,headers:apiHeaders});
  };
  const success=await audit(respond,configs);
  assert.equal(success.failed,0,report(success));
  assert.equal(requests.length,6);
  assert.equal(requests.filter(x=>x.method==='GET').length,3);
  assert.equal(requests.filter(x=>x.method==='OPTIONS').length,3);
  assert.ok(!report(success).includes(key),'Never print public client keys in result artifacts');
  mocks.budapest_catalog=[];
  assert.equal((await audit(respond,configs)).failed,1,'Empty product catalog must fail closed');
  mocks.budapest_catalog=[{
    id:'tour-1',slug:'buda',title:'Buda',durationMinutes:90,priceFrom:70,
    currency:'EUR',guideLanguages:['en'],bookingEnabled:true
  }];
  mocks.payment_capability={online_card:true,provider:'stripe',mode:'live',readiness:{status:'ready'}};
  assert.equal((await audit(respond,configs)).failed,1,'Staging live payment mode must be flagged');
  mocks.payment_capability={online_card:false,provider:null,mode:'test',
    readiness:{status:'unavailable',reason:'provider_disabled'}};
  const validOff=await audit(respond,configs);
  assert.equal(validOff.failed,0,'Explicitly disabled Stripe is valid FBM Staging readiness');
  for(const invalid of [
    {online_card:true,provider:'stripe',mode:'test',
      readiness:{status:'ready',reason:'provider_disabled'}},
    {online_card:true,provider:'stripe',mode:'test',
      readiness:{status:'unavailable',reason:'webhook_secret_missing'}},
    {online_card:false,provider:'stripe',mode:'test',
      readiness:{status:'unavailable',reason:'provider_disabled'}},
    {online_card:false,provider:null,mode:'test',
      readiness:{status:'unavailable',reason:null}},
    {online_card:false,provider:null,mode:'test',
      readiness:{status:'unavailable'}},
  ]){
    mocks.payment_capability=invalid;
    const result=await audit(respond,configs);
    assert.equal(result.failed,1,
      'Contradictory Stripe readiness must fail the real Staging contract smoke');
    assert.equal(result.rows.find(x=>x.id==='payment_capability').ok,false);
  }
  mocks.payment_capability={online_card:false,provider:null,mode:'test',
    readiness:{status:'unavailable',reason:'provider_disabled'}};
  const denyCors=async(uri,init)=>new Response(JSON.stringify(
    mocks[PROBES.find(p=>new URL(STAGING+p.route).href===uri).id]),
    {status:200,headers:{'content-type':'application/json'}});
  assert.equal((await audit(denyCors,configs)).failed,6,'OPTIONS and GET lacking website CORS must fail');
  const missing=async()=>new Response('Not found',{status:404});
  assert.equal((await audit(missing,configs)).failed,6);
  const redirect=async()=>new Response(null,{status:307,headers:{location:'https://attacker.invalid/api/v1/experiences'}});
  assert.equal((await audit(redirect,configs)).failed,6,'No redirect to an external host');
  const malicious=async()=>new Response(null,{status:307,headers:{location:'https://ezraider-os-staging.vercel.app/api/v1/holds'}});
  assert.equal((await audit(malicious,configs)).failed,6,'No redirect to a mutating API path');
  const negativePreflight=async(uri,init)=>{
    if(init.method==='OPTIONS')return new Response(null,{status:204,headers:{
      ...preflightHeaders,'access-control-allow-headers':'content-type'
    }});
    return respond(uri,init);
  };
  assert.equal((await audit(negativePreflight,configs)).failed,3,
    'Browser request key headers must be permitted by every CORS preflight');
  const preflightRedirect=async(uri,init)=>{
    if(init.method==='OPTIONS')return new Response(null,{status:308,headers:{
      location:uri+'/'
    }});
    return respond(uri,init);
  };
  assert.equal((await audit(preflightRedirect,configs)).failed,3,
    'Browser preflights must not rely on redirects');
  const missingOrigin=async(uri,init)=>{
    if(init.method==='OPTIONS')return new Response(null,{status:204,headers:{
      ...preflightHeaders,'access-control-allow-origin':'https://unrelated.example'
    }});
    return respond(uri,init);
  };
  assert.equal((await audit(missingOrigin,configs)).failed,3,
    'Browser preflight cannot permit another website instead of VOY PRO');
  console.log('Public Staging FBM OPTIONS+GET browser contract QA passed: allowlists, preflights, shapes, CORS, read-only calls and blocked live payment mode.');
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
  if(process.argv.includes('--test'))await test();
  else{
    const result=await audit();
    const markdown=report(result);
    fs.mkdirSync('fbm-staging-public-audit',{recursive:true});
    fs.writeFileSync('fbm-staging-public-audit/report.md',markdown);
    process.stdout.write(markdown+'\n');
    if(result.failed)process.exitCode=1;
  }
}

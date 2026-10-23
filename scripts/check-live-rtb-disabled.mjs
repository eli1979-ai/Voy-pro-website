// Read-only public safety preflight for the disabled Budapest Request-to-Book
// relay. Performs ONLY GET requests: never POSTs enquiries, personal data,
// credentials, test bookings, or payment events.
// A 404 is insufficient: require the exact deliberate disabled JSON response.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const GATES=[
  ['https://voy-pro.com/api/request-to-book','Apex domain'],
  ['https://www.voy-pro.com/api/request-to-book','www alias']
];
const allowed=new Set(['voy-pro.com','www.voy-pro.com']);

function checked(value){
  const u=new URL(value);
  if(u.protocol!=='https:'||!allowed.has(u.hostname)||u.port||u.username||
     u.password||u.search||u.hash||!['/api/request-to-book','/api/request-to-book/'].includes(u.pathname))
    throw Error('Refusing non-approved RTB gate URL or redirect');
  return u;
}
async function getGate(url,request){
  let u=checked(url);
  const visited=new Set();
  for(let hop=0;hop<=4;hop++){
    if(visited.has(u.href))throw Error('Redirect loop');
    visited.add(u.href);
    const response=await request(u.href,{
      method:'GET',redirect:'manual',credentials:'omit',
      headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)
    });
    if([301,302,303,307,308].includes(response.status)){
      const redirect=response.headers.get('location');
      await response.body?.cancel();
      if(!redirect)throw Error('Redirect missing Location');
      u=checked(new URL(redirect,u).href);
      continue;
    }
    const length=Number(response.headers.get('content-length')||'0');
    if(length>4096)throw Error('Unexpected response size');
    const body=await response.text();
    if(body.length>4096)throw Error('Unexpected response size');
    let data;
    try{data=JSON.parse(body);}catch{throw Error('Response not JSON');}
    return {url:u.href,status:response.status,headers:response.headers,body:data};
  }
  throw Error('Too many redirects');
}
function expectedDisabled(result){
  const data=result.body;
  return result.status===404&&data&&
    Object.keys(data).length===1&&data.error==='request_intake_disabled'&&
    /(?:^|,|\s)no-store(?:,|\s|$)/i.test(result.headers.get('cache-control')||'')&&
    (result.headers.get('content-type')||'').toLowerCase().includes('application/json')&&
    /(?:^|,|\s)noindex(?:,|\s|$)/i.test(result.headers.get('x-robots-tag')||'');
}
export async function auditDisabled(request=fetch,targets=GATES){
  const rows=[];
  for(const [url,label] of targets){
    try{
      const response=await getGate(url,request);
      const safe=expectedDisabled(response);
      rows.push({url,label,ok:!!safe,final:response.url,
        reason:safe?'GET 404 request_intake_disabled; no-store; noindex':
          'Public relay did not return the exact deliberate disabled response'});
    }catch(e){
      rows.push({url,label,ok:false,reason:String(e?.message||e).slice(0,250)});
    }
  }
  return {rows,passed:rows.filter(x=>x.ok).length,failed:rows.filter(x=>!x.ok).length};
}
export function report(result){
  return [
    '# VOY PRO — live Budapest Request-to-Book disabled-gate audit',
    '',
    '**Checked:** '+new Date().toISOString()+' (UTC). Read-only unauthenticated GET only; no customer details, POST requests, token or FBM API calls.',
    '',
    '**Expected while public site is staging:** 404 JSON \`{"error":"request_intake_disabled"}\`, HTTP no-store and noindex.',
    '',
    '**Result:** '+result.passed+'/'+result.rows.length+' passed; '+result.failed+' failed.',
    '',
    '| Alias | Result | Evidence |',
    '| --- | --- | --- |',
    ...result.rows.map(row=>'| '+row.url+' | '+(row.ok?'PASS':'FAIL')+' | '+row.reason.replace(/\|/g,'/')+' |'),
    '',
    '**A failing observation is a safety alert, not authorization to enable/disable a service.** It can also reflect temporary network or deployment errors; manually verify current flags and owner release approval before taking action.',
    ''
  ].join('\n');
}
async function test(){
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, max-age=0',
    'x-robots-tag':'noindex, nofollow'
  };
  const good=()=>new Response('{"error":"request_intake_disabled"}',{status:404,headers});
  const redirect=to=>()=>new Response(null,{status:308,headers:{location:to}});
  const fixtures=new Map([
    [GATES[0][0],good],
    [GATES[1][0],redirect(GATES[0][0])]
  ]);
  const mock=async(url,options)=>{
    assert.equal(options.method,'GET','Never POST a synthetic enquiry to the public domain');
    assert.equal(options.credentials,'omit');
    if(!fixtures.has(url))throw Error('Unexpected URL');
    return fixtures.get(url)();
  };
  const check=async failures=>assert.equal((await auditDisabled(mock)).failed,failures);
  await check(0);
  // Vercel trailingSlash:true canonically redirects this same API path.
  // Permit this exact canonicalization, never arbitrary API routes/hosts.
  fixtures.set(GATES[0][0],redirect('https://voy-pro.com/api/request-to-book/'));
  fixtures.set('https://voy-pro.com/api/request-to-book/',good);
  await check(0);
  fixtures.set(GATES[0][0],good);
  fixtures.delete('https://voy-pro.com/api/request-to-book/');
  fixtures.set(GATES[0][0],()=>new Response('{"error":"request_intake_disabled"}',{status:200,headers}));
  await check(2); // 200 is suspicious even with the same body.
  fixtures.set(GATES[0][0],()=>new Response('{"error":"method_not_allowed"}',{status:405,headers}));
  await check(2);
  fixtures.set(GATES[0][0],()=>new Response('Not found',{status:404,headers}));
  await check(2);
  fixtures.set(GATES[0][0],()=>new Response('{"error":"not_found"}',{status:404,headers}));
  await check(2);
  fixtures.set(GATES[0][0],()=>new Response('{"error":"request_intake_disabled","debug":"oops"}',{status:404,headers}));
  await check(2);
  fixtures.set(GATES[0][0],()=>new Response('{"error":"request_intake_disabled"}',{status:404,
    headers:{...headers,'cache-control':'public, max-age=60'}}));
  await check(2);
  fixtures.set(GATES[0][0],()=>new Response('{"error":"request_intake_disabled"}',{status:404,
    headers:{...headers,'x-robots-tag':'follow'}}));
  await check(2);
  fixtures.set(GATES[0][0],good);
  fixtures.set(GATES[1][0],redirect('https://evil.example/api/request-to-book'));
  await check(1);
  fixtures.set(GATES[1][0],redirect('http://voy-pro.com/api/request-to-book'));
  await check(1);
  fixtures.set(GATES[1][0],redirect('https://voy-pro.com/api/request-to-book?token=123'));
  await check(1);
  fixtures.set(GATES[1][0],redirect('https://voy-pro.com/api/holds/'));
  await check(1);
  fixtures.set(GATES[1][0],redirect(GATES[1][0]));
  await check(1);
  console.log('Live disabled RTB audit unit tests passed: deliberate 404, no-store/noindex, no POST, redirect safety, fail-closed.');
}
const isCli=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCli){
  if(process.argv.includes('--test'))await test();
  else{
    const result=await auditDisabled();
    const output=report(result);
    fs.mkdirSync('staging-http-audit',{recursive:true});
    fs.writeFileSync('staging-http-audit/rtb-disabled.md',output);
    process.stdout.write(output+'\n');
    if(result.failed)process.exitCode=1;
  }
}

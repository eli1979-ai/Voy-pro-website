// Read-only, opt-in RTB ingress smoke. Never POST, toggle flags, or contact FBM.
// This is a safety check that an explicitly named website ingress still fails
// closed. It is NOT a WAF/rate-limit test or a CRM end-to-end acceptance test.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const EXACT_HOSTS=new Set(['voy-pro.com','voy-pro-staging.vercel.app']);
function validateOrigin(input){
  if(typeof input!=='string')throw new Error('An explicit HTTPS website origin is required');
  let parsed;
  try{parsed=new URL(input);}catch{throw new Error('Invalid origin URL');}
  if(parsed.protocol!=='https:'||parsed.port||parsed.username||parsed.password||
    parsed.pathname!=='/'||parsed.search||parsed.hash)
    throw new Error('Only a clean HTTPS origin without path, port or credentials is allowed');
  const host=parsed.hostname;
  const known=EXACT_HOSTS.has(host)||
    /^voy-pro-staging-[a-z0-9-]+-eli1979-5448\.vercel\.app$/.test(host);
  if(!known)throw new Error('Not an allowlisted VOY PRO website ingress');
  return parsed.origin;
}

export async function verifyDisabledOrigin(origin,{fetchImpl=globalThis.fetch}={}){
  const base=validateOrigin(origin);
  const url=base+'/api/request-to-book';
  // No request body, no cookies, no authorization and NO redirects.
  const response=await fetchImpl(url,{
    method:'GET',headers:{accept:'application/json'},
    redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(response.status!==404)
    throw new Error('RTB disabled status not verified: expected HTTP 404, received '+response.status);
  const type=response.headers?.get('content-type')||'';
  const cache=response.headers?.get('cache-control')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(type)||
    !/(?:^|,)\s*no-store(?:\s*[,;]|$)/i.test(cache))
    throw new Error('RTB 404 is missing the expected JSON/no-store safety headers');
  const raw=await response.text();
  if(raw.length>512)throw new Error('RTB 404 body exceeds the disabled-response contract');
  let body;
  try{body=JSON.parse(raw);}catch{throw new Error('RTB 404 was not parseable JSON');}
  if(body?.error!=='request_intake_disabled')
    throw new Error('RTB 404 did not explicitly attest to disabled intake');
  return {origin:base,method:'GET',status:404,disabled:true};
}

async function cli(){
  const args=process.argv.slice(2);
  if(!args.length||args.some(x=>!x.startsWith('--origin='))||args.length>5)
    throw new Error('Usage: node scripts/verify-rtb-disabled-live.mjs --origin=https://voy-pro.com [--origin=https://voy-pro-staging.vercel.app]');
  const origins=[...new Set(args.map(x=>x.slice('--origin='.length)))];
  for(const origin of origins){
    const result=await verifyDisabledOrigin(origin);
    console.log('PASS — RTB disabled at '+result.origin+' (read-only GET 404, JSON, no-store)');
  }
  console.log('NOT VERIFIED: actual WAF throttling, safe POST intake, CRM linkage, or Production readiness.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  cli().catch(err=>{console.error('RTB live fail-closed check FAILED: '+err.message);process.exitCode=1;});
}

// Read-only audit of the public site's *actual* staging runtime boundary.
// Never calls FBM, submits bookings, or reports browser-public client keys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const STAGING_API='https://ezraider-os-staging.vercel.app/api/v1';
export const TARGETS=[
  ['https://voy-pro.com/release.json','apex release','/release.json'],
  ['https://voy-pro.com/assets/runtime-config.js','apex runtime','/assets/runtime-config.js'],
  ['https://www.voy-pro.com/release.json','www release','/release.json'],
  ['https://www.voy-pro.com/assets/runtime-config.js','www runtime','/assets/runtime-config.js']
];
const allowedHosts=new Set(['voy-pro.com','www.voy-pro.com']);

function allowURL(value,pathname){
  const url=new URL(value);
  if(url.protocol!=='https:'||!allowedHosts.has(url.hostname)||url.port||
     url.username||url.password||url.search||url.hash||url.pathname!==pathname)
    throw Error('Refusing non-approved runtime audit URL or redirect');
  return url;
}
async function readPublic(url,pathname,request){
  let target=allowURL(url,pathname);
  const visited=new Set();
  for(let hop=0;hop<5;hop++){
    if(visited.has(target.href))throw Error('Public alias redirect loop');
    visited.add(target.href);
    const response=await request(target.href,{
      method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
      headers:{accept:pathname.endsWith('.json')?'application/json':'text/javascript'},
      signal:AbortSignal.timeout(12000)
    });
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      await response.body?.cancel();
      if(!location)throw Error('Redirect missing Location');
      target=allowURL(new URL(location,target).href,pathname);
      continue;
    }
    if(response.status!==200)throw Error('Public configuration HTTP '+response.status);
    const size=Number(response.headers.get('content-length')||'0');
    if(size>8192)throw Error('Public configuration response too large');
    if(!/\bnoindex\b/i.test(response.headers.get('x-robots-tag')||'')||
       !/\bnofollow\b/i.test(response.headers.get('x-robots-tag')||''))
      throw Error('Public staging configuration must carry HTTP noindex,nofollow');
    const text=await response.text();
    if(text.length>8192)throw Error('Public configuration response too large');
    if(pathname.endsWith('.json')&&!/json/i.test(response.headers.get('content-type')||''))
      throw Error('Release document must use JSON content type');
    if(pathname.endsWith('.js')&&!/javascript/i.test(response.headers.get('content-type')||''))
      throw Error('Runtime document must use JavaScript content type');
    return {final:target.href,text};
  }
  throw Error('Too many public alias redirects');
}
function uniqueMatch(text,re,label){
  const matches=[...text.matchAll(re)];
  if(matches.length!==1)throw Error('Missing or ambiguous '+label);
  return matches[0][1];
}
export function inspect(releaseText,runtimeText){
  let release;
  try{release=JSON.parse(releaseText);}catch{throw Error('Release is not valid JSON');}
  if(release?.app!=='voy-pro-website-v2'||release.target!=='staging'||
     release.seo_indexable!==false||typeof release.version!=='string'||!release.version)
    throw Error('Public site no longer has an approved staging release identity');
  if(typeof release.booking_enabled!=='boolean')
    throw Error('Release booking flag is missing');
  // Parse only the non-secret browser fields; never return or print clientKey.
  const enabled=uniqueMatch(runtimeText,/\bbookingEnabled\s*:\s*(true|false)\b/g,'bookingEnabled')==='true';
  const apiRoot=uniqueMatch(runtimeText,/\bapiRoot\s*:\s*['"]([^'"]+)['"]/g,'apiRoot');
  if(apiRoot!==STAGING_API)throw Error('Public runtime API changed from the approved staging endpoint');
  if(enabled!==release.booking_enabled)
    throw Error('Public runtime booking flag does not match the release manifest');
  return {version:release.version,bookingEnabled:enabled,api:'FBM staging (expected)'};
}
export async function audit(request=fetch,targets=TARGETS){
  const rows=[];
  const byHost=new Map();
  for(const [url,label,pathname] of targets){
    try{
      const doc=await readPublic(url,pathname,request);
      const host=new URL(url).host;
      const files=byHost.get(host)||{};
      files[pathname]=doc.text;
      byHost.set(host,files);
      rows.push({url,label,ok:true,reason:'HTTP 200, expected content type and noindex/nofollow'});
    }catch(e){
      rows.push({url,label,ok:false,reason:String(e?.message||e).slice(0,180)});
    }
  }
  const snapshots=[];
  for(const [host,files] of byHost){
    if(!files['/release.json']||!files['/assets/runtime-config.js'])continue;
    try{
      const snapshot=inspect(files['/release.json'],files['/assets/runtime-config.js']);
      snapshots.push({host,...snapshot});
    }catch(e){
      rows.push({url:'https://'+host+'/',label:host+' runtime boundary',ok:false,
        reason:String(e?.message||e).slice(0,180)});
    }
  }
  if(snapshots.length!==2||snapshots.some(x=>x.version!==snapshots[0].version||
     x.bookingEnabled!==snapshots[0].bookingEnabled)){
    rows.push({url:'Public aliases',label:'cross-alias consistency',ok:false,
      reason:'Both aliases must expose the same approved staging release and runtime'});
  }
  const failed=rows.filter(row=>!row.ok).length;
  return {rows,passed:rows.length-failed,failed,snapshots};
}
export function report(result){
  return [
    '# VOY PRO — public staging runtime-boundary audit',
    '',
    '**Checked:** '+new Date().toISOString()+' (UTC). Anonymous read-only GET requests to public website configuration only.',
    '**Result:** '+result.passed+'/'+result.rows.length+' passed; '+result.failed+' failed.',
    '',
    '| Configuration surface | Result | Evidence |',
    '| --- | --- | --- |',
    ...result.rows.map(row=>'| '+row.label+' | '+(row.ok?'PASS':'FAIL')+' | '+row.reason.replace(/[|\n]/g,' ')+' |'),
    '',
    ...result.snapshots.map(s=>'- '+s.host+': website '+s.version+', '+s.api+
      ', bookingEnabled='+s.bookingEnabled),
    '',
    '**KNOWN RISK:** Public website booking is currently enabled against FBM Staging. This check does not prove that a genuine customer cannot submit a booking or payment, and does not authorize Production launch.',
    '**This audit never fetches or prints FBM client keys, makes booking requests, changes runtime configuration, SEO, payment, aliases or deploys.**',
    '**On failure:** inspect current domain deployment and release approval; do not silently enable or disable payment/booking or change a domain.',
    ''
  ].join('\n');
}
async function test(){
  const headers={
    'x-robots-tag':'noindex, nofollow',
    'content-type':'application/json'
  };
  const release=JSON.stringify({app:'voy-pro-website-v2',version:'1.48.99',
    target:'staging',seo_indexable:false,booking_enabled:true});
  const runtime="window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'"+
    STAGING_API+"',clientKey:'test_browser_public_value'};";
  const fixtures=new Map();
  for(const [url,,pathname] of TARGETS){
    if(url.includes('www.voy-pro.com')){
      fixtures.set(url,()=>new Response(null,{status:308,
        headers:{location:url.replace('www.voy-pro.com','voy-pro.com')}}));
    }else{
      fixtures.set(url,()=>new Response(pathname.endsWith('.json')?release:runtime,
        {status:200,headers:{...headers,
          'content-type':pathname.endsWith('.json')?'application/json':'application/javascript'}}));
    }
  }
  const request=async(url,options)=>{
    assert.equal(options.method,'GET');
    assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'manual');
    if(!fixtures.has(url))throw Error('Unexpected URL');
    return fixtures.get(url)();
  };
  assert.equal((await audit(request)).failed,0,'Safe public staging baseline must pass');
  assert.equal(inspect(release,runtime).bookingEnabled,true);
  assert.ok(!JSON.stringify(await audit(request)).includes('test_browser_public_value'),
    'Never print browser keys in reports');
  const replace=(url,text,type='application/javascript',additional={})=>
    fixtures.set(url,()=>new Response(text,{status:200,
      headers:{...headers,'content-type':type,...additional}}));
  const apiUrl=TARGETS[1][0],releaseUrl=TARGETS[0][0];
  replace(apiUrl,runtime.replace(STAGING_API,'https://fbm-production.example.com/api/v1'));
  assert.ok((await audit(request)).failed>0,'Unexpected Production API must fail');
  replace(apiUrl,runtime.replace('bookingEnabled:true','bookingEnabled:false'));
  assert.ok((await audit(request)).failed>0,'Booking flag drift must fail');
  replace(apiUrl,runtime,'application/javascript',{'x-robots-tag':'follow'});
  assert.ok((await audit(request)).failed>0,'Crawler gate removal must fail');
  replace(apiUrl,runtime);
  replace(releaseUrl,release.replace('"staging"','"production"'),'application/json');
  assert.ok((await audit(request)).failed>0,'Silent release target promotion must fail');
  replace(releaseUrl,release,'application/json');
  fixtures.set(TARGETS[2][0],()=>new Response(null,{status:308,
    headers:{location:'https://attacker.example/release.json'}}));
  assert.ok((await audit(request)).failed>0,'Off-host redirects must fail');
  fixtures.set(TARGETS[2][0],()=>new Response(null,{status:308,
    headers:{location:releaseUrl}}));
  assert.equal((await audit(request)).failed,0,'Approved www redirect must pass');
  console.log('Live staging runtime-boundary audit: offline tests passed');
}
const cli=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(cli){
  if(process.argv.includes('--test'))await test();
  else{
    const result=await audit();
    const output=report(result);
    fs.mkdirSync('staging-http-audit',{recursive:true});
    fs.writeFileSync('staging-http-audit/runtime-boundary.md',output);
    process.stdout.write(output+'\n');
    if(result.failed)process.exitCode=1;
  }
}

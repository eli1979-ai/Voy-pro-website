// Daily read-only validation that archived partner widget URLs still exist
// and serve their original SHA-256 bytes. Does not touch WordPress, FBM,
// payment APIs, customer data, credentials, DNS or deployment state.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const BASES=['https://voy-pro.com','https://www.voy-pro.com'];
const NAME=/^affiliate-booking-widget\.([a-f0-9]{24})\.js$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function archived(){
  const names=fs.readdirSync('site/assets').filter(x=>NAME.test(x)).sort();
  if(names.length<1||names.length>20)throw Error('Unexpected archived affiliate version count');
  return names.map(name=>{
    const bytes=fs.readFileSync('site/assets/'+name);
    const sha=digest(bytes);
    if(sha.slice(0,24)!==name.match(NAME)[1])throw Error('Checked-in archive hash is wrong');
    return {name,sha,bytes:bytes.length};
  });
}
function checkURL(value,expectedPath){
  const url=new URL(value);
  if(url.protocol!=='https:'||!BASES.includes(url.origin)||url.port||
     url.username||url.password||url.search||url.hash||
     url.pathname!==expectedPath)throw Error('Refusing unapproved asset URL or redirect');
  return url;
}
async function read(absolute,expectedPath,request,maxBytes=160000){
  let url=checkURL(absolute,expectedPath);
  const visited=new Set();
  for(let i=0;i<5;i++){
    if(visited.has(url.href))throw Error('Asset redirect loop');
    visited.add(url.href);
    const response=await request(url.href,{
      method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
      headers:{accept:expectedPath.endsWith('.json')?'application/json':'application/javascript'},
      signal:AbortSignal.timeout(12000)
    });
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      await response.body?.cancel();
      if(!location)throw Error('Missing redirect destination');
      url=checkURL(new URL(location,url).href,expectedPath);
      continue;
    }
    if(response.status!==200)throw Error('Archived asset HTTP '+response.status);
    if(Number(response.headers.get('content-length')||0)>maxBytes)
      throw Error('Unexpectedly large archived asset');
    const mime=response.headers.get('content-type')||'';
    if(!(expectedPath.endsWith('.json')?/json/i:/javascript/i).test(mime))
      throw Error('Unexpected archived asset content type');
    const robots=response.headers.get('x-robots-tag')||'';
    if(!/\bnoindex\b/i.test(robots)||!/\bnofollow\b/i.test(robots))
      throw Error('Staging archive crawler boundary missing');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>maxBytes)throw Error('Unexpectedly large archived asset body');
    return bytes;
  }
  throw Error('Too many archived asset redirects');
}
export async function audit(request=fetch,versions=archived()){
  const rows=[];
  for(const base of BASES){
    let manifest=null;
    const manifestPath='/assets/affiliate-booking-widget-manifest.json';
    try{
      const bytes=await read(base+manifestPath,manifestPath,request,8192);
      manifest=JSON.parse(bytes.toString('utf8'));
      if(manifest?.artifact!=='voy-pro-affiliate-booking-widget'||
        manifest.schema_version!==1||
        !['PERSISTED_ACROSS_DEPLOYS','BUILD_ONLY_NOT_RETAINED'].includes(manifest.archive_status)||
        manifest.release_status!=='NOT_APPROVED_FOR_WORDPRESS_INSTALLATION'||
        !/^\/assets\/affiliate-booking-widget\.[a-f0-9]{24}\.js$/.test(manifest.public_path)||
        !/^[a-f0-9]{64}$/.test(manifest.sha256))
        throw Error('Manifest unexpectedly changed its review/approval contract');
      if(manifest.archive_status==='PERSISTED_ACROSS_DEPLOYS'&&
        !versions.some(x=>'/assets/'+x.name===manifest.public_path&&
          x.sha===manifest.sha256&&x.bytes===manifest.bytes))
        throw Error('Manifest claims an archive that is not checked in');
      rows.push({label:base+' manifest',ok:true,reason:'Manifest schema and non-approval guard'});
    }catch(e){
      rows.push({label:base+' manifest',ok:false,reason:String(e.message||e).slice(0,180)});
    }
    for(const version of versions){
      const p='/assets/'+version.name;
      try{
        const bytes=await read(base+p,p,request);
        if(bytes.length!==version.bytes||digest(bytes)!==version.sha)
          throw Error('Published archived asset no longer matches reviewed SHA-256 bytes');
        rows.push({label:base+' '+version.name,ok:true,reason:'HTTP 200, noindex and exact reviewed SHA-256'});
      }catch(e){
        rows.push({label:base+' '+version.name,ok:false,reason:String(e.message||e).slice(0,180)});
      }
    }
  }
  return {rows,failed:rows.filter(x=>!x.ok).length,archives:versions.length};
}
export function report(result){
  return ['# Read-only VOY PRO affiliate archive integrity watch','',
    '**Checked (UTC):** '+new Date().toISOString(),
    '**Archived immutable versions:** '+result.archives,
    '**Result:** '+(result.rows.length-result.failed)+'/'+result.rows.length+
    ' checks passed; '+result.failed+' failed.','',
    '| Public alias asset | Result | Evidence |',
    '| --- | --- | --- |',
    ...result.rows.map(r=>'| '+r.label+' | '+(r.ok?'PASS':'FAIL')+' | '+r.reason+' |'),
    '',
    'All probes use bounded anonymous GET only; no visitor data, secrets, FBM calls or writes.',
    'A pass confirms currently served bytes, not WordPress installation approval, partner origin CORS or Production readiness.',''].join('\n');
}
async function test(){
  const versions=archived();
  const first=versions[0];
  const manifest=JSON.stringify({
    schema_version:1,artifact:'voy-pro-affiliate-booking-widget',
    public_path:'/assets/'+first.name,sha256:first.sha,bytes:first.bytes,
    archive_status:'PERSISTED_ACROSS_DEPLOYS',
    release_status:'NOT_APPROVED_FOR_WORDPRESS_INSTALLATION'
  });
  const fixtures=new Map();
  for(const v of versions){
    fixtures.set(BASES[0]+'/assets/'+v.name,()=>new Response(
      fs.readFileSync('site/assets/'+v.name),{status:200,
        headers:{'content-type':'application/javascript','x-robots-tag':'noindex, nofollow'}}));
  }
  const mp='/assets/affiliate-booking-widget-manifest.json';
  const goodManifest=()=>new Response(manifest,{status:200,
    headers:{'content-type':'application/json','x-robots-tag':'noindex, nofollow'}});
  fixtures.set(BASES[0]+mp,goodManifest);
  for(const name of [mp,...versions.map(v=>'/assets/'+v.name)]){
    fixtures.set(BASES[1]+name,()=>new Response(null,{status:308,
      headers:{location:BASES[0]+name}}));
  }
  const mock=async(url,opts)=>{
    assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');
    assert.equal(opts.redirect,'manual');
    if(!fixtures.has(url))throw Error('Unexpected test URL: '+url);
    return fixtures.get(url)();
  };
  assert.equal((await audit(mock,versions)).failed,0,'Healthy archives must pass');
  const asset=BASES[0]+'/assets/'+first.name;
  const saved=fixtures.get(asset);
  fixtures.set(asset,()=>new Response('tampered', {status:200,
    headers:{'content-type':'application/javascript','x-robots-tag':'noindex, nofollow'}}));
  assert.ok((await audit(mock,versions)).failed>0,'Tampered content must fail');
  fixtures.set(asset,()=>new Response(fs.readFileSync('site/assets/'+first.name),{status:200,
    headers:{'content-type':'application/javascript','x-robots-tag':'follow'}}));
  assert.ok((await audit(mock,versions)).failed>0,'Removed noindex must fail');
  fixtures.set(asset,()=>new Response(null,{status:308,
    headers:{location:'https://untrusted.example/assets/'+first.name}}));
  assert.ok((await audit(mock,versions)).failed>0,'External redirect must fail');
  fixtures.set(asset,()=>new Response('missing',{status:404}));
  assert.ok((await audit(mock,versions)).failed>0,'Missing old archive must fail');
  fixtures.set(asset,saved);
  fixtures.set(BASES[0]+mp,()=>new Response(manifest.replace(
    'NOT_APPROVED_FOR_WORDPRESS_INSTALLATION','APPROVED'),{status:200,
      headers:{'content-type':'application/json','x-robots-tag':'noindex, nofollow'}}));
  assert.ok((await audit(mock,versions)).failed>0,'False approval must fail');
  fixtures.set(BASES[0]+mp,goodManifest);
  assert.equal((await audit(mock,versions)).failed,0,'Restored archive fixtures pass');
  console.log('Public pinned affiliate asset watch: offline fail-closed tests passed');
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
  if(process.argv.includes('--test'))await test();
  else{
    const result=await audit();
    fs.mkdirSync('staging-http-audit',{recursive:true});
    const md=report(result);
    fs.writeFileSync('staging-http-audit/affiliate-archive.md',md);
    console.log(md);
    if(result.failed)process.exitCode=1;
  }
}

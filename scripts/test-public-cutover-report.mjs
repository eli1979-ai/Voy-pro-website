import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getCutoverSnapshot,renderCutoverStatus,validPublicApiUrl} from './report-public-cutover.mjs';

for(const malformed of [
  null,'not a URL','https://::::/api/v1','http://api.example.test/api/v1',
  'https://user:secret@api.example.test/api/v1',
  'https://api-staging.example.test/api/v1',
  'https://api.example.test:9999/api/v1',
  'https://api.example.test/api/v1?token=123',
  'https://localhost/api/v1','https://api.localhost/api/v1',
  'https://127.0.0.1/api/v1','https://192.168.1.10/api/v1',
  'https://8.8.8.8/api/v1','https://[::1]/api/v1',
  'https://service.local/api/v1','https://fbm.internal/api/v1'
]){
  assert.equal(validPublicApiUrl(malformed),false,
    'Malformed or unsafe Production API declarations must fail closed: '+String(malformed));
}
assert.equal(validPublicApiUrl('https://api.example.test/api/v1'),true);
const actual=getCutoverSnapshot();
assert.equal(actual.decision,'NO-GO','Static source must not self-authorize cutover');
assert.equal(actual.static_preflight,'BLOCKED','Current checked-in Staging is not Production');
assert(actual.source_blockers.length>0,'Staging source must retain explicit blockers');
assert.equal(actual.evidence.length,9);
assert.equal(actual.manual_checks.length,6);
assert(actual.evidence.some(x=>x.label==='Explicit owner cutover approval'&&x.state==='BLOCKED'));
const actualText=renderCutoverStatus(actual);
assert(actualText.includes('RECORDED" is not "verified live"'));
assert(!actualText.includes('voy_bud_stg_'),'Never expose browser client-key values in report');
assert(!actualText.includes('slfwrgssovjqcqdigzqo'),
  'Report should not unnecessarily expose Production database identifiers');
assert(actualText.includes('NO-GO'));

const root=fs.mkdtempSync(path.join(os.tmpdir(),'voy-source-readiness-'));
try{
  fs.mkdirSync(path.join(root,'site','assets'),{recursive:true});
  fs.mkdirSync(path.join(root,'launch'),{recursive:true});
  const save=(filename,body)=>fs.writeFileSync(path.join(root,filename),
    typeof body==='string'?body:JSON.stringify(body));
  const verified={
    schema_version:1,status:'verified',verified_at:'2026-10-23T14:00:00Z',
    owner_cutover_approved:true,
    website_vercel_project_id:'prj_AAAAAAAAAAAAAAAAAAAAAAAA',
    fbm_vercel_project_id:'prj_BBBBBBBBBBBBBBBBBBBBBBBB',
    supabase_project_ref:'abcdefghijklmnopqrst',
    public_api_base_url:'https://fbm-public.example.test/api/v1'
  };
  save('launch/production-environment.json',verified);
  save('site/release.json',{target:'production',seo_indexable:true,booking_enabled:true});
  save('site/assets/runtime-config.js',
    "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://fbm-public.example.test/api/v1',clientKey:'voy_public_example'};");
  save('site/robots.txt','User-agent: *\nAllow: /\nSitemap: https://voy-pro.com/sitemap.xml\n');
  save('site/sitemap.xml','<urlset><url><loc>https://voy-pro.com/</loc></url></urlset>');
  save('site/index.html','<meta name="robots" content="index,follow"><link href="https://voy-pro.com/" rel="canonical">');
  save('vercel.json',{headers:[{source:'/manage/(.*)',
    headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]});
  const claimed=getCutoverSnapshot(root);
  assert.equal(claimed.static_preflight,'PASS_NEEDS_LIVE_EVIDENCE',
    'Synthetic source fixture should satisfy only static gates');
  assert.equal(claimed.recorded,9);
  assert.equal(claimed.blocked,0);
  assert.equal(claimed.decision,'NO-GO',
    'Even synthetic owner-approved source cannot authorize a release without independent live evidence');
  assert.match(renderCutoverStatus(claimed),/Static checks are not sufficient for cutover/);
  save('vercel.json',{headers:[{source:'/(.*)',
    headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]});
  const leftStagingHeader=getCutoverSnapshot(root);
  assert.equal(leftStagingHeader.static_preflight,'BLOCKED');
  assert.equal(leftStagingHeader.evidence.find(x=>x.label==='Crawler cutover source').state,'BLOCKED');
  save('launch/production-environment.json',{...verified,owner_cutover_approved:false,status:'unverified'});
  const unapproved=getCutoverSnapshot(root);
  assert.equal(unapproved.evidence.find(x=>x.label==='Explicit owner cutover approval').state,'BLOCKED');
  assert.equal(unapproved.evidence.find(x=>x.label==='Production infrastructure verification').state,'BLOCKED');
  save('launch/production-environment.json',{...verified,public_api_base_url:null});
  assert.equal(getCutoverSnapshot(root).evidence.find(x=>x.label==='Production public API base URL').state,'BLOCKED');
  for(const bad of ['https://::::/api/v1','https://api.example.test:7777/api/v1']){
    save('launch/production-environment.json',{...verified,public_api_base_url:bad});
    const result=getCutoverSnapshot(root);
    assert.equal(result.decision,'NO-GO');
    assert.equal(result.evidence.find(x=>x.label==='Production public API base URL').state,'BLOCKED');
    assert.equal(result.evidence.find(x=>x.label==='Website runtime uses declared Production API').state,'BLOCKED');
  }
  console.log('Cutover report QA passed: real Staging NO-GO, synthetic source claims never authorize release, no client keys leaked.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}

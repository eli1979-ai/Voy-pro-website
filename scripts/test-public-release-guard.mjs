import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assessPublicRelease } from './check-public-release-readiness.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voy-public-guard-'));
const assets = path.join(root, 'assets');
const identityFile = path.join(root, 'production-environment.json');
fs.mkdirSync(assets);
const write = (name, content) => fs.writeFileSync(path.join(root, name), content);
const assess = () => assessPublicRelease(root, identityFile);
const verified = {
  schema_version:1,status:'verified',
  website_vercel_project_id:'prj_AAAAAAAAAAAAAAAAAAAAAAAA',
  fbm_vercel_project_id:'prj_BBBBBBBBBBBBBBBBBBBBBBBB',
  supabase_project_ref:'abcdefghijklmnopqrst',
  public_api_base_url:'https://fbm-production.example.com/api/v1',
  verified_at:'2026-10-22T00:00:00Z',owner_cutover_approved:true,
};
const attest = (overrides={}) => write('production-environment.json',JSON.stringify({...verified,...overrides}));
try {
  write('release.json', JSON.stringify({target:'production',seo_indexable:true,booking_enabled:true}));
  write('assets/runtime-config.js', "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://fbm-production.example.com/api/v1',clientKey:'voy_bud_public_x123'};");
  write('robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://voy-pro.com/sitemap.xml\n');
  write('sitemap.xml', '<urlset><url><loc>https://voy-pro.com/</loc></url></urlset>');
  write('index.html', '<meta name="robots" content="index,follow"><link href="https://voy-pro.com/" rel="canonical">');

  attest();
  assert.deepEqual(assess(), [], 'verified and explicitly approved public fixture must pass');
  // The normal npm build runs release-consistency, not the explicit
  // verify:public-release command. Exercise the actual CLI in a synthetic
  // project to ensure it cannot build a falsely approved Production release.
  const project=path.join(root,'fixture-project');
  const fixtureSite=path.join(project,'site');
  const fixtureLaunch=path.join(project,'launch');
  fs.mkdirSync(path.join(fixtureSite,'assets'),{recursive:true});
  fs.mkdirSync(fixtureLaunch,{recursive:true});
  for(const filename of ['assets/runtime-config.js','robots.txt','sitemap.xml','index.html']){
    fs.copyFileSync(path.join(root,filename),path.join(fixtureSite,filename));
  }
  fs.writeFileSync(path.join(project,'package.json'),JSON.stringify({
    name:'voy-pro-website-v2',version:'1.48.99'
  }));
  const buildRelease={
    app:'voy-pro-website-v2',version:'1.48.99',target:'production',
    seo_indexable:true,booking_enabled:true,sitemap_urls:1,
    built_at:'2026-10-23T11:00:00Z',
    build_model:'synthetic-fixture',brand_assets:'synthetic-fixture'
  };
  const writeBuildRelease=(overrides={})=>fs.writeFileSync(
    path.join(fixtureSite,'release.json'),JSON.stringify({...buildRelease,...overrides}));
  const writeBuildAttestation=(overrides={})=>fs.writeFileSync(
    path.join(fixtureLaunch,'production-environment.json'),JSON.stringify({...verified,...overrides}));
  const consistencyScript=path.resolve('scripts/check-release-consistency.mjs');
  const runBuildGate=()=>spawnSync(process.execPath,[consistencyScript],{
    cwd:project,encoding:'utf8'
  });
  writeBuildRelease();
  writeBuildAttestation();
  const verifiedBuild=runBuildGate();
  assert.equal(verifiedBuild.status,0,verifiedBuild.stderr);
  writeBuildAttestation({owner_cutover_approved:false});
  const deniedBuild=runBuildGate();
  assert.notEqual(deniedBuild.status,0,
    'build must fail when target=production without owner cutover approval');
  assert.ok(deniedBuild.stderr.includes('Production release gate:'),
    'regular build must explain the Production-specific failure');
  assert.ok(deniedBuild.stderr.includes('explicit owner approval'));
  writeBuildRelease({target:'staging',seo_indexable:false});
  const stagingBuild=runBuildGate();
  assert.equal(stagingBuild.status,0,
    'staging consistency must not require a Production attestation: '+stagingBuild.stderr);

  const deniedCases = [
    [{status:'unverified'},'attestation must be verified'],
    [{owner_cutover_approved:false},'explicit owner approval'],
    [{website_vercel_project_id:'prj_mllzA4eTnK6ITda3AI7BpHbmVe7j'},'Production website project'],
    [{fbm_vercel_project_id:'prj_h5j84vU4HLucTxiWtQQUue9zcn1V'},'Production FBM project'],
    [{supabase_project_ref:'ieuuobbfginqkngkzbfa'},'Production Supabase project'],
    [{fbm_vercel_project_id:verified.website_vercel_project_id},'Production FBM project'],
    [{public_api_base_url:'https://fbm-staging.example.com/api/v1'},'Runtime public API base URL'],
    [{verified_at:null},'verification timestamp'],
  ];
  for (const [mutation,message] of deniedCases) {
    attest(mutation);
    assert(assess().some(reason=>reason.includes(message)),
      'Cutover must fail on '+JSON.stringify(mutation)+': '+message);
  }
  attest();
  write('release.json', JSON.stringify({target:'staging',seo_indexable:false,booking_enabled:true}));
  write('robots.txt', 'User-agent: *\nDisallow: /\n');
  write('assets/runtime-config.js', "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://backend-staging.example.com/api',clientKey:'voy_bud_stg_x123'};");
  const failures = assess().join(' | ');
  for (const expected of ['release.target', 'release.seo_indexable', 'Disallow:', 'sitemap', 'API points to staging', 'staging key']) {
    assert.ok(failures.includes(expected), 'Expected failing check: ' + expected);
  }
  assert.ok(assessPublicRelease(path.resolve('site')).length > 0, 'current checked-in staging configuration must be reported as not public-ready');

  console.log('Public release guard tests OK: verified and approved identity passes, unverified/staging/reused infrastructure fails, checked-in staging blocked.');
} finally {
  fs.rmSync(root, {recursive:true,force:true});
}

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
const assess = () => assessPublicRelease(root, identityFile, path.join(root,'vercel.json'));
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
  // Protected /manage pages may remain noindex in a public release,
  // but a catch-all HTTP noindex header must be removed before cutover.
  const manageRobots={source:'/manage/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]};
  const globalRobots={source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]};
  const writeRootVercel=(globals=false)=>write('vercel.json',
    JSON.stringify({headers:globals?[globalRobots,manageRobots]:[manageRobots]}));
  writeRootVercel();


  attest();
  assert.deepEqual(assess(), [], 'verified and explicitly approved public fixture must pass');
  // These values used to pass a string-only Production check. Even with an
  // owner-approval fixture and an exactly matching runtime URL, fail closed.
  for (const endpoint of [
    'https://localhost/api/v1','https://api.localhost/api/v1',
    'https://127.0.0.1/api/v1','https://192.168.1.10/api/v1',
    'https://8.8.8.8/api/v1','https://[::1]/api/v1',
    'https://service.local/api/v1','https://fbm.internal/api/v1'
  ]) {
    attest({public_api_base_url:endpoint});
    write('assets/runtime-config.js',
      "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'"+endpoint+"',clientKey:'voy_bud_public_x123'};");
    assert.ok(assess().some(reason=>reason.includes('canonical public HTTPS hostname')),
      'Production release must reject unsafe host even when declared and runtime URLs match: '+endpoint);
  }
  attest();
  write('assets/runtime-config.js',
    "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://fbm-production.example.com/api/v1',clientKey:'voy_bud_public_x123'};");
  assert.deepEqual(assess(), [], 'restored canonical public hostname must pass the source guard');

  writeRootVercel(true);
  assert.ok(assess().some(reason=>reason.includes('must not globally declare X-Robots-Tag noindex')),
    'public release must reject the global Staging HTTP noindex header');
  writeRootVercel();
  assert.deepEqual(assess(), [], 'removing global Staging noindex must restore public eligibility');
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
  const writeBuildVercel=(globals=false)=>fs.writeFileSync(
    path.join(project,'vercel.json'),
    JSON.stringify({headers:globals?[globalRobots,manageRobots]:[manageRobots]}));
  const consistencyScript=path.resolve('scripts/check-release-consistency.mjs');
  const runBuildGate=()=>spawnSync(process.execPath,[consistencyScript],{
    cwd:project,encoding:'utf8'
  });
  writeBuildRelease();
  writeBuildAttestation();
  writeBuildVercel();
  const verifiedBuild=runBuildGate();
  assert.equal(verifiedBuild.status,0,verifiedBuild.stderr);
  writeBuildVercel(true);
  const deniedGlobalHeader=runBuildGate();
  assert.notEqual(deniedGlobalHeader.status,0,
    'public release cannot build with a global HTTP noindex header');
  assert.ok(deniedGlobalHeader.stderr.includes('must not globally declare X-Robots-Tag noindex'));
  writeBuildVercel();
  writeBuildAttestation({owner_cutover_approved:false});
  const deniedBuild=runBuildGate();
  assert.notEqual(deniedBuild.status,0,
    'build must fail when target=production without owner cutover approval');
  assert.ok(deniedBuild.stderr.includes('Production release gate:'),
    'regular build must explain the Production-specific failure');
  assert.ok(deniedBuild.stderr.includes('explicit owner approval'));
  writeBuildRelease({target:'staging',seo_indexable:false});
  const stagingRuntime="window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://ezraider-os-staging.vercel.app/api/v1',clientKey:'voy_bud_stg_fixture_public'};";
  const setBuildRuntime=code=>fs.writeFileSync(
    path.join(fixtureSite,'assets/runtime-config.js'),code);
  setBuildRuntime(stagingRuntime);
  fs.writeFileSync(path.join(fixtureSite,'robots.txt'),'User-agent: *\\nDisallow: /\\n'.replaceAll('\\n','\n'));
  const unprotectedStaging=runBuildGate();
  assert.notEqual(unprotectedStaging.status,0,
    'Staging must reject removed global HTTP noindex even if robots.txt blocks crawl');
  assert.ok(unprotectedStaging.stderr.includes('Staging requires a global Vercel X-Robots-Tag'));
  writeBuildVercel(true);
  const stagingBuild=runBuildGate();
  assert.equal(stagingBuild.status,0,
    'staging consistency must not require a Production attestation: '+stagingBuild.stderr);
  writeBuildRelease({target:'staging',seo_indexable:true});
  const accidentallyIndexed=runBuildGate();
  assert.notEqual(accidentallyIndexed.status,0,
    'Staging must reject enabling SEO flags even if a global HTTP noindex remains');
  assert.ok(accidentallyIndexed.stderr.includes('seo_indexable=false'));
  writeBuildRelease({target:'staging',seo_indexable:false});
  fs.writeFileSync(path.join(fixtureSite,'robots.txt'),
    'User-agent: *\\nAllow: /\\n'.replaceAll('\\n','\n'));
  const accidentallyCrawlable=runBuildGate();
  assert.notEqual(accidentallyCrawlable.status,0,
    'Staging must reject permissive robots even if release flags and HTTP headers are protected');
  assert.ok(accidentallyCrawlable.stderr.includes('Staging robots.txt'));
  fs.writeFileSync(path.join(fixtureSite,'robots.txt'),
    'User-agent: *\\nDisallow: /\\nAllow: /\\n'.replaceAll('\\n','\n'));
  const conflictingRobots=runBuildGate();
  assert.notEqual(conflictingRobots.status,0,
    'Conflicting Disallow and Allow root directives must not pass the staging guard');
  assert.ok(conflictingRobots.stderr.includes('unrestricted Allow'));
  fs.writeFileSync(path.join(fixtureSite,'robots.txt'),
    'User-agent: *\\nDisallow: /\\n'.replaceAll('\\n','\n'));
  assert.equal(runBuildGate().status,0,
    'All three Staging index controls must pass only when consistent');
  setBuildRuntime("window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://fbm-public.example.test/api/v1',clientKey:'voy_bud_stg_fixture_public'};");
  const accidentalProductionAPI=runBuildGate();
  assert.notEqual(accidentalProductionAPI.status,0,
    'Staging must reject even a plausible Production API URL');
  assert.ok(accidentalProductionAPI.stderr.includes('approved Staging FBM API endpoint'));
  setBuildRuntime("window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://ezraider-os-staging.vercel.app/api/v1',clientKey:'voy_bud_public_production'};");
  const accidentalProductionClientKey=runBuildGate();
  assert.notEqual(accidentalProductionClientKey.status,0,
    'Staging must reject an unscoped or Production-looking browser client key');
  assert.ok(accidentalProductionClientKey.stderr.includes('Staging-scoped public client key'));
  setBuildRuntime(stagingRuntime);
  assert.equal(runBuildGate().status,0,
    'Safe source-scoped Staging API and public key pass together');


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

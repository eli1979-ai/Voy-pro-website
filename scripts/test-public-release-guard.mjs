import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assessPublicRelease } from './check-public-release-readiness.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voy-public-guard-'));
const assets = path.join(root, 'assets');
fs.mkdirSync(assets);
const write = (name, content) => fs.writeFileSync(path.join(root, name), content);
try {
  write('release.json', JSON.stringify({target:'production',seo_indexable:true,booking_enabled:true}));
  write('assets/runtime-config.js', "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://api.example.com/v1',clientKey:'voy_bud_public_x123'};");
  write('robots.txt', 'User-agent: *\\nAllow: /\\nSitemap: https://voy-pro.com/sitemap.xml\\n');
  write('sitemap.xml', '<urlset><url><loc>https://voy-pro.com/</loc></url></urlset>');
  write('index.html', '<meta name="robots" content="index,follow"><link href="https://voy-pro.com/" rel="canonical">');

  assert.deepEqual(assessPublicRelease(root), [], 'valid public fixture must pass');
  write('release.json', JSON.stringify({target:'staging',seo_indexable:false,booking_enabled:true}));
  write('robots.txt', 'User-agent: *\\nDisallow: /\\n');
  write('assets/runtime-config.js', "window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'https://backend-staging.example.com/api',clientKey:'voy_bud_stg_x123'};");
  const failures = assessPublicRelease(root).join(' | ');
  for (const expected of ['release.target', 'release.seo_indexable', 'Disallow:', 'sitemap', 'API points to staging', 'staging key']) {
    assert.ok(failures.includes(expected), 'Expected failing check: ' + expected);
  }
  assert.ok(assessPublicRelease(path.resolve('site')).length > 0, 'current checked-in staging configuration must be reported as not public-ready');

  console.log('Public release readiness guard tests OK: production fixture passes, staging fixture fails, current repository is flagged.');
} finally {
  fs.rmSync(root, {recursive:true,force:true});
}

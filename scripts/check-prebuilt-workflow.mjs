#!/usr/bin/env node
// Offline safety contract for the manual, non-production prebuilt release pilot.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const workflow = read('.github/workflows/deploy-prebuilt-staging.yml');
const vercel = JSON.parse(read('vercel.json'));
const pkg = JSON.parse(read('package.json'));
const release = JSON.parse(read('site/release.json'));

assert.equal(release.version, pkg.version, 'Source/package versions must agree');
assert.equal(release.target, 'staging', 'Pilot must only package Staging source');
assert.equal(release.seo_indexable, false, 'Pilot must remain non-indexable');
assert.equal(vercel.buildCommand, 'npm run build');
assert.equal(vercel.outputDirectory, 'dist');
assert.equal(vercel.trailingSlash, true);
const common = vercel.headers.find(x => x.source === '/(.*)');
assert.ok(common, 'Global security headers are required');
const values = Object.fromEntries(common.headers.map(x => [x.key.toLowerCase(), x.value]));
for (const key of ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy', 'cross-origin-opener-policy', 'x-robots-tag']) {
  assert.ok(values[key], 'Missing security header: ' + key);
}
assert.match(values['x-robots-tag'], /noindex/i);
assert.ok(vercel.redirects.some(x => x.source === '/budapest/ezraider/' && x.destination === '/ezraider/?from=budapest'));
assert.ok(vercel.redirects.some(x => x.source === '/he/budapest/ezraider/' && x.destination === '/he/ezraider/?from=budapest'));
assert.ok(vercel.redirects.some(x => x.source === '/hu/budapest/ezraider/' && x.destination === '/hu/ezraider/?from=budapest'));

assert.match(workflow, /workflow_dispatch:/, 'Preview pilot must be manually dispatched');
assert.doesNotMatch(workflow, /^\s+(?:push|pull_request):/m, 'Pilot must not auto-deploy from Git');
assert.match(workflow, /publish_preview:.*(?:\r?\n[\s\S]*?)default: false/, 'Preview publishing defaults off');
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/, 'Only reviewed main is permitted to read deployment secrets');
assert.match(workflow, /vercel pull --yes --environment=preview/, 'Pull Vercel Preview configuration');
assert.match(workflow, /vercel build\b/, 'Let official CLI create complete Build Output API artifact');
assert.match(workflow, /vercel deploy --prebuilt\b/, 'Upload the reviewed output without building at Vercel');
assert.match(workflow, /vercel@[0-9]+\.[0-9]+\.[0-9]+/, 'CLI version must be pinned');
assert.doesNotMatch(workflow, /vercel@latest|--token(?:=|\s)|vercel (?:promote|alias)\b|--prod\b/, 'Do not expose CLI tokens or Production operations');
assert.doesNotMatch(workflow, /cat\s*>\s*\.vercel\/output\/config\.json|rm -rf \.vercel|1\.33\.0/, 'No hand-authored routing or obsolete release versions');
assert.match(workflow, /npm run verify:launch/);
assert.match(workflow, /npm run qa:site/);
assert.match(workflow, /node scripts\/check-prebuilt-output\.mjs/, 'Do not deploy before built-artifact route/header parity check');
assert.match(workflow, /node scripts\/check-prebuilt-preview-http\.mjs/, 'Manual Preview must verify served HTTP security headers, redirects, assets and noindex');
console.log('Prebuilt pilot source/workflow safety contract: OK (no Vercel calls)');

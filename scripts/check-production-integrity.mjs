import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const site = path.join(root, 'site');
const env = String(process.env.VERCEL_ENV || 'local').trim().toLowerCase();
const failures = [];

const required = {
  release: path.join(site, 'release.json'),
  runtime: path.join(site, 'assets', 'runtime-config.js'),
  robots: path.join(site, 'robots.txt'),
};

for (const [name, file] of Object.entries(required)) {
  if (!fs.existsSync(file)) failures.push(`missing required ${name} file: ${path.relative(root, file)}`);
}

let release = null;
let runtime = '';
let robots = '';

if (fs.existsSync(required.release)) {
  try {
    release = JSON.parse(fs.readFileSync(required.release, 'utf8'));
  } catch {
    failures.push('site/release.json is not valid JSON');
  }
}
if (fs.existsSync(required.runtime)) runtime = fs.readFileSync(required.runtime, 'utf8');
if (fs.existsSync(required.robots)) robots = fs.readFileSync(required.robots, 'utf8');

const apiRoot = (runtime.match(/\bapiRoot\s*:\s*['"]([^'"]+)['"]/i) || [])[1] || '';
const clientKey = (runtime.match(/\bclientKey\s*:\s*['"]([^'"]+)['"]/i) || [])[1] || '';
const runtimeBookingEnabled = /\bbookingEnabled\s*:\s*true\b/.test(runtime);

if (env === 'production') {
  if (release?.target !== 'production') {
    failures.push(`production build requires release.target="production" (found ${JSON.stringify(release?.target)})`);
  }
  if (release?.seo_indexable !== true) {
    failures.push('production build requires release.seo_indexable=true');
  }
  if (release?.booking_enabled !== true) {
    failures.push('production build requires release.booking_enabled=true');
  }

  if (/^\s*Disallow:\s*\/\s*$/im.test(robots)) {
    failures.push('production robots.txt must not block the entire site with Disallow: /');
  }
  if (!/Sitemap:\s*https:\/\/voy-pro\.com\/sitemap\.xml/i.test(robots)) {
    failures.push('production robots.txt must publish the canonical VOY PRO sitemap');
  }

  if (!runtimeBookingEnabled) {
    failures.push('production runtime-config.js must explicitly enable booking');
  }
  if (!apiRoot) {
    failures.push('production runtime-config.js is missing apiRoot');
  } else {
    if (!/^https:\/\//i.test(apiRoot)) failures.push('production apiRoot must use HTTPS');
    if (/staging/i.test(apiRoot)) failures.push(`production apiRoot must not point to staging: ${apiRoot}`);
  }
  if (!clientKey) {
    failures.push('production runtime-config.js is missing a public clientKey');
  } else if (/(?:^|[_-])stg(?:[_-]|$)|staging/i.test(clientKey)) {
    failures.push('production runtime-config.js appears to contain a staging public client key');
  }
}

if (failures.length) {
  console.error(`Production integrity guard failed for VERCEL_ENV=${env}.`);
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

if (env === 'production') {
  console.log('Production integrity guard OK: release metadata, robots and runtime configuration are production-safe.');
} else {
  console.log(`Production integrity guard: VERCEL_ENV=${env}; production-only invariants were not enforced.`);
}

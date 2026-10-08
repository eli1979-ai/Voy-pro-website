/**
 * Read-only source audit for the PUBLIC voy-pro.com release.
 *
 * Intentionally NOT a normal Vercel build gate: VERCEL_ENV=production also
 * describes the production *target* of the voy-pro-staging project, and that
 * project currently serves the public alias. Run explicitly before cutover.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function assessPublicRelease(siteDir = path.resolve('site')) {
  const failures = [];
  const read = (name) => {
    try { return fs.readFileSync(path.join(siteDir, name), 'utf8'); }
    catch { failures.push('Missing required file: ' + name); return ''; }
  };
  const releaseText = read('release.json');
  const runtime = read('assets/runtime-config.js');
  const robots = read('robots.txt');
  const sitemap = read('sitemap.xml');
  const home = read('index.html');
  let release;
  try { release = JSON.parse(releaseText); }
  catch { failures.push('release.json must contain valid JSON'); release = {}; }

  if (release.target !== 'production') failures.push('release.target must be production');
  if (release.seo_indexable !== true) failures.push('release.seo_indexable must be true');
  if (release.booking_enabled !== true) failures.push('release.booking_enabled must be true');

  if (/^\s*Disallow:\s*\/\s*$/im.test(robots)) failures.push('robots.txt blocks crawlers with Disallow: /');
  if (!/^\s*Sitemap:\s*https:\/\/voy-pro\.com\/sitemap\.xml\s*$/im.test(robots)) {
    failures.push('robots.txt must advertise the voy-pro.com sitemap');
  }
  if (!/<loc>https:\/\/voy-pro\.com\//i.test(sitemap)) {
    failures.push('sitemap.xml must contain canonical voy-pro.com URLs');
  }
  if (/name=["']robots["'][^>]*content=["'][^"']*noindex|content=["'][^"']*noindex[^>]*name=["']robots["']/i.test(home)) {
    failures.push('Homepage must not declare noindex');
  }
  if (!/href=["']https:\/\/voy-pro\.com\/["'][^>]*rel=["']canonical["']|rel=["']canonical["'][^>]*href=["']https:\/\/voy-pro\.com\/["']/i.test(home)) {
    failures.push('Homepage must declare the canonical public URL');
  }

  const apiRoot = (runtime.match(/\bapiRoot\s*:\s*['"]([^'"]+)['"]/i) || [])[1] || '';
  const clientKey = (runtime.match(/\bclientKey\s*:\s*['"]([^'"]+)['"]/i) || [])[1] || '';
  if (!/\bbookingEnabled\s*:\s*true\b/.test(runtime)) failures.push('Runtime must explicitly enable booking');
  if (!/^https:\/\//i.test(apiRoot)) failures.push('Runtime apiRoot must be HTTPS');
  else if (/(?:staging|\bstg\b)/i.test(apiRoot)) failures.push('Runtime API points to staging');
  if (!clientKey) failures.push('Runtime clientKey is missing');
  else if (/(?:^|[_-])stg(?:[_-]|$)|staging/i.test(clientKey)) failures.push('Runtime clientKey appears to be a staging key');

  return failures;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const failures = assessPublicRelease();
  if (failures.length) {
    console.error('Public release NOT READY (' + failures.length + ' static checks):');
    failures.forEach((failure, i) => console.error((i+1) + '. ' + failure));
    console.error('No deployment, DNS, or configuration was changed.');
    process.exitCode = 1;
  } else {
    console.log('Static public release checks passed. Manual payment, booking, analytics and domain-alias verification remain required.');
  }
}

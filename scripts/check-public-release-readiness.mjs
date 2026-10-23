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

export function assessPublicRelease(siteDir = path.resolve('site'), attestationFile = path.resolve('launch/production-environment.json'), deploymentConfigFile = path.resolve('vercel.json')) {
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
  // The public alias currently belongs to the Staging project. In addition
  // to a verified distinct Production project, its Vercel configuration must
  // stop returning a global noindex HTTP header before any SEO cutover.
  // Retain /manage/ noindex for private booking links.
  let vercelConfig;
  try { vercelConfig = JSON.parse(fs.readFileSync(deploymentConfigFile,'utf8')); }
  catch { failures.push('Vercel deployment config is missing or invalid JSON'); vercelConfig = {}; }
  const globalRobotRules=(vercelConfig.headers||[])
    .filter(rule=>['/(.*)','/:path*'].includes(rule.source))
    .flatMap(rule=>Array.isArray(rule.headers)?rule.headers:[]);
  if(globalRobotRules.some(header=>
      String(header.key||'').toLowerCase()==='x-robots-tag'&&
      /\\bnoindex\\b/i.test(String(header.value||'')))){
    failures.push('Production Vercel config must not globally declare X-Robots-Tag noindex');
  }
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


  // A Vercel deployment marked "production" is NOT proof of independent
  // infrastructure: the public alias previously pointed at voy-pro-staging.
  // The approved resource IDs below are public identifiers, never credentials.
  // This is only a source-level release gate; operators must separately
  // verify the actual Vercel aliases, Supabase ref, payments, and CORS.
  let identity;
  try { identity = JSON.parse(fs.readFileSync(attestationFile,'utf8')); }
  catch { failures.push('Production infrastructure attestation is missing or invalid JSON'); identity = {}; }

  if (identity.schema_version !== 1 || identity.status !== 'verified') {
    failures.push('Production infrastructure attestation must be verified');
  }
  if (identity.owner_cutover_approved !== true) {
    failures.push('Production cutover requires explicit owner approval');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(identity.verified_at || '') ||
      Number.isNaN(Date.parse(identity.verified_at || ''))) {
    failures.push('Production infrastructure verification timestamp is missing or invalid');
  }

  const stagingWebsiteProject = 'prj_mllzA4eTnK6ITda3AI7BpHbmVe7j';
  const stagingFbmProject = 'prj_h5j84vU4HLucTxiWtQQUue9zcn1V';
  const stagingDatabaseRef = 'ieuuobbfginqkngkzbfa';
  const siteProject = identity.website_vercel_project_id || '';
  const fbmProject = identity.fbm_vercel_project_id || '';
  const databaseRef = identity.supabase_project_ref || '';
  if (!/^prj_[A-Za-z0-9]{16,}$/.test(siteProject) ||
      siteProject === stagingWebsiteProject || siteProject === stagingFbmProject) {
    failures.push('A distinct verified Production website project ID is required');
  }
  if (!/^prj_[A-Za-z0-9]{16,}$/.test(fbmProject) ||
      fbmProject === stagingWebsiteProject || fbmProject === stagingFbmProject ||
      fbmProject === siteProject) {
    failures.push('A distinct verified Production FBM project ID is required');
  }
  if (!/^[a-z0-9]{20}$/.test(databaseRef) || databaseRef === stagingDatabaseRef) {
    failures.push('A distinct verified Production Supabase project ref is required');
  }

  const declaredApi = identity.public_api_base_url || '';
  if (declaredApi !== apiRoot) {
    failures.push('Runtime public API base URL must exactly match the verified Production API');
  }
  try {
    const url = new URL(declaredApi);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/api/v1' ||
        /staging|(^|[-.])stg([-.]|$)/i.test(url.hostname)) {
      failures.push('Production API must be a canonical HTTPS /api/v1 URL not associated with staging');
    }
  } catch {
    failures.push('Production API base URL is missing or invalid');
  }

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

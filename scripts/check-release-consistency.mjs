import fs from 'node:fs';
import { assessPublicRelease } from './check-public-release-readiness.mjs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const release=JSON.parse(fs.readFileSync('site/release.json','utf8'));
const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const robots=fs.readFileSync('site/robots.txt','utf8');
const runtime=fs.readFileSync('site/assets/runtime-config.js','utf8');
const deployment=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const globalHeaders=(deployment.headers||[])
  .filter(rule=>rule.source==='/(.*)')
  .flatMap(rule=>Array.isArray(rule.headers)?rule.headers:[]);
const globalRobots=globalHeaders.filter(header=>
  String(header.key||'').toLowerCase()==='x-robots-tag');
const stagingNoindex=globalRobots.some(header=>
  /\bnoindex\b/i.test(String(header.value||''))&&
  /\bnofollow\b/i.test(String(header.value||'')));
const failures=[];

const sitemapCount=(sitemap.match(/<loc>/g)||[]).length;
const runtimeBooking=(runtime.match(/\bbookingEnabled\s*:\s*(true|false)\b/)||[])[1];
const runtimeApiRoot=(runtime.match(/\bapiRoot\s*:\s*['"]([^'"]+)['"]/i)||[])[1]||'';
const runtimeClientKey=(runtime.match(/\bclientKey\s*:\s*['"]([^'"]+)['"]/i)||[])[1]||'';
// This hostname is the explicitly approved FBM Staging API. Any proposed
// replacement needs a reviewed code change, not an automatic redirect to
// Production. This is source guardrail, not proof of API identity at runtime.
const APPROVED_STAGING_API='https://ezraider-os-staging.vercel.app/api/v1';

if(pkg.name!==release.app)failures.push('release.app must match package name: '+release.app+' != '+pkg.name);
if(pkg.version!==release.version)failures.push('release.version must match package version: '+release.version+' != '+pkg.version);
if(release.sitemap_urls!==sitemapCount)failures.push('release.sitemap_urls must match sitemap count: '+release.sitemap_urls+' != '+sitemapCount);
if(!['staging','production'].includes(release.target))failures.push('release.target must be staging or production');
if(typeof release.booking_enabled!=='boolean')failures.push('release.booking_enabled must be boolean');
if(typeof release.seo_indexable!=='boolean')failures.push('release.seo_indexable must be boolean');
if(!release.build_model||typeof release.build_model!=='string')failures.push('release.build_model must be a non-empty string');
if(!release.brand_assets||typeof release.brand_assets!=='string')failures.push('release.brand_assets must be a non-empty string');
if(!release.built_at||Number.isNaN(Date.parse(release.built_at)))failures.push('release.built_at must be a valid timestamp');
if(runtimeBooking==null)failures.push('runtime-config.js must expose bookingEnabled');
else if((runtimeBooking==='true')!==release.booking_enabled)failures.push('release.booking_enabled must match runtime bookingEnabled');

// Staging's public aliases also expose indexing directives at HTTP level:
// robots.txt Disallow alone does NOT guarantee URLs cannot be indexed from
// third-party links. Fail closed if a developer accidentally removes the
// global X-Robots-Tag while this project still targets Staging.
if(release.target==='staging'){
  if(!stagingNoindex)
    failures.push('Staging requires a global Vercel X-Robots-Tag: noindex, nofollow');
  // Staging aliases currently serve voy-pro.com, so the source release
  // metadata and robots.txt must fail closed together with the HTTP header.
  // Never let a partial SEO change silently pass the normal build gate.
  if(release.seo_indexable!==false)
    failures.push('Staging release must explicitly set seo_indexable=false');
  const lines=robots.split(/\r?\n/).map(line=>line.replace(/#.*$/,'').trim());
  if(!/^User-agent:\s*\*$/im.test(robots)||!lines.some(line=>/^Disallow:\s*\/$/i.test(line)))
    failures.push('Staging robots.txt must have User-agent: * and Disallow: /');
  if(lines.some(line=>/^Allow:\s*\/?$/i.test(line)))
    failures.push('Staging robots.txt must not contain an unrestricted Allow: /');
  if(runtimeApiRoot!==APPROVED_STAGING_API)
    failures.push('Staging runtime must use the approved Staging FBM API endpoint, never Production');
  if(!/^voy_bud_stg_[A-Za-z0-9_-]+$/.test(runtimeClientKey))
    failures.push('Staging runtime must use a Staging-scoped public client key');

}
// A source bundle that claims Production must pass the separate owner's
// cutover audit; VERCEL_ENV=production is only a deployment target, not proof
// of independently provisioned Production infrastructure.
if(release.target==='production'){
  const publicFailures=assessPublicRelease();
  for(const reason of publicFailures)failures.push('Production release gate: '+reason);
}

if(failures.length){
  console.error('Release consistency guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Release consistency guard OK: '+release.app+' '+release.version+', '+sitemapCount+' sitemap URLs, target='+release.target+', booking='+release.booking_enabled+', indexable='+release.seo_indexable+'.');

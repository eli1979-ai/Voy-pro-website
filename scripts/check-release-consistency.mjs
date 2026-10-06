import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const release=JSON.parse(fs.readFileSync('site/release.json','utf8'));
const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const runtime=fs.readFileSync('site/assets/runtime-config.js','utf8');
const failures=[];

const sitemapCount=(sitemap.match(/<loc>/g)||[]).length;
const runtimeBooking=(runtime.match(/\bbookingEnabled\s*:\s*(true|false)\b/)||[])[1];

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

if(failures.length){
  console.error('Release consistency guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Release consistency guard OK: '+release.app+' '+release.version+', '+sitemapCount+' sitemap URLs, target='+release.target+', booking='+release.booking_enabled+', indexable='+release.seo_indexable+'.');

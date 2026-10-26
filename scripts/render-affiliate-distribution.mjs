// Build-only publisher for a REVIEWABLE affiliate embed asset.
// The existing mutable widget remains for first-party callers; partner sites
// should pin a reviewed SHA-derived path so later website deploys do not
// silently upgrade their booking UI or attribution behavior.
// No keys, partner configuration, network access, WordPress writes or deploys.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const sourcePath='site/assets/affiliate-booking-widget.js';
const builtPath='dist/assets/affiliate-booking-widget.js';
const manifestPath='dist/assets/affiliate-booking-widget-manifest.json';
const source=fs.readFileSync(sourcePath);
const built=fs.readFileSync(builtPath);
if(!source.equals(built))throw Error('Built affiliate widget differs from reviewed source');
const digest=createHash('sha256').update(source).digest('hex');
const filename='affiliate-booking-widget.'+digest.slice(0,24)+'.js';
const pinnedPath=path.join('dist/assets',filename);
const archivedPath=path.join('site/assets',filename);
// A pinned partner URL must survive NEXT month's unrelated website deploy.
// The reviewed snapshot is persisted in site/assets, not merely generated
// inside dist (which disappears on each fresh Vercel build).
const archiveStatus=fs.existsSync(archivedPath)?
  'PERSISTED_ACROSS_DEPLOYS':'BUILD_ONLY_NOT_RETAINED';
if(fs.existsSync(pinnedPath)){
  if(!fs.readFileSync(pinnedPath).equals(source))
    throw Error('Previously archived widget name has different bytes');
}else fs.writeFileSync(pinnedPath,source,{flag:'wx'});
// Reject a changed archived asset even when it is not today's current widget.
for(const name of fs.readdirSync('site/assets')){
  const m=name.match(/^affiliate-booking-widget\\.([a-f0-9]{24})\\.js$/);
  if(m&&createHash('sha256').update(
    fs.readFileSync(path.join('site/assets',name))).digest('hex').slice(0,24)!==m[1])
    throw Error('Archived affiliate widget tampered: SHA filename mismatch');
}
const manifest={
  schema_version:1,
  artifact:'voy-pro-affiliate-booking-widget',
  public_path:'/assets/'+filename,
  sha256:digest,
  bytes:source.length,
  archive_status:archiveStatus,
  release_status:'NOT_APPROVED_FOR_WORDPRESS_INSTALLATION'
};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('Affiliate reviewed-build fingerprint emitted: '+manifest.public_path+
  ' ('+manifest.bytes+' bytes, archive='+archiveStatus+
  '). Owner approval remains required for WordPress pilot.');

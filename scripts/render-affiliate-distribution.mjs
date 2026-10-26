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
// Write only a content-addressed static asset, never the mutable source.
fs.writeFileSync(pinnedPath,source,{flag:'wx'});
const manifest={
  schema_version:1,
  artifact:'voy-pro-affiliate-booking-widget',
  public_path:'/assets/'+filename,
  sha256:digest,
  bytes:source.length,
  release_status:'NOT_APPROVED_FOR_WORDPRESS_INSTALLATION'
};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('Affiliate reviewed-build fingerprint emitted: '+manifest.public_path+
  ' ('+manifest.bytes+' bytes). Owner approval remains required for WordPress pilot.');

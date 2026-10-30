#!/usr/bin/env node
/**
 * No-network Yoast Premium 28.8 compatibility preflight for the OLD WordPress
 * /budapest/ site. This only checks known vendor minimums and release gates.
 * It cannot read private WordPress settings or authorize any deployment.
 *
 * node scripts/check-legacy-ezraidereu-yoast-upgrade-preflight.mjs --self-test
 * node scripts/check-legacy-ezraidereu-yoast-upgrade-preflight.mjs --input /private/preflight.json
 *
 * Example JSON fields: wordpressVersion, phpVersion, installedFreeVersion,
 * targetFreeVersion, targetPremiumVersion, vendorPackageConfirmed, restorableBackupConfirmed,
 * isolatedStagingVerified, siteOwnerApproved.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
function version(value){
 if(typeof value!=='string'||!/^\d+\.\d+(?:\.\d+)?$/.test(value))return null;
 const numbers=value.split('.').map(Number);
 return numbers.every(Number.isSafeInteger)?[numbers[0],numbers[1],numbers[2]??0]:null;
}
function atLeast(actual,min){
 const a=version(actual),b=version(min);
 if(!a||!b)return null;
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];
 return true;
}
export function assessUpgrade(input){
 if(!input||Array.isArray(input)||typeof input!=='object')throw Error('Expected object');
 const target=input.targetPremiumVersion;
 const checks=[
  ['TARGET_PREMIUM_28_8_ONLY',target==='28.8',
   'This guard covers exactly Yoast Premium 28.8; for other targets re-verify the official version-specific requirements.'],
  ['WORDPRESS_CORE_MIN_7_0',atLeast(input.wordpressVersion,'7.0'),
   'Yoast Premium 28.8 changelog states minimum WordPress 7.0; actual core version must be verified.'],
  ['YOAST_FREE_TARGET_MIN_28_8',atLeast(input.targetFreeVersion,'28.8'),
   'The intended free Yoast target is >=28.8; a future intended version is not proof it is already installed.'],
  ['YOAST_FREE_INSTALLED_MIN_28_8',atLeast(input.installedFreeVersion,'28.8'),
   'The free Yoast SEO version actually installed in the isolated target must be >=28.8 before activating Premium 28.8.'],
  ['PHP_MIN_7_4_GENERAL',atLeast(input.phpVersion,'7.4'),
   'Vendor general requirements say PHP >=7.4; target-specific PHP requirements still require validation.'],
  ['OFFICIAL_VENDOR_PACKAGE',input.vendorPackageConfirmed===true,
   'Only a verified official licensed source for the Premium package is acceptable.'],
  ['RESTORE_TESTED',input.restorableBackupConfirmed===true,
   'Current files+database backup must be restored successfully to isolated staging.'],
  ['ISOLATED_STAGING_VERIFIED',input.isolatedStagingVerified===true,
   'Verify EN/HU/HE pages, PHP/ACF, WordPress editor, SEO, 21 tours, forms, menus and WPCode v6.2 in isolation.'],
  ['OWNER_RELEASE_APPROVAL',input.siteOwnerApproved===true,
   'Site owner must explicitly approve the actual maintenance release separately.']
 ];
 // Require a current source snapshot, not a version-only check. Full test is manual.
 const findings=checks.map(([code,pass,why])=>({
  code,result:pass===true?'satisfied':pass===false?'blocked':'unknown',
  detail:why
 }));
 const blocked=findings.filter(x=>x.result!=='satisfied');
 return {
  purpose:'Planning checklist only. Never auto-update or deploy from this result.',
  candidate:target??null,
  state:blocked.length?'blocked':'self-attested-requires-independent-review',
  blockers:blocked,
  satisfied:findings.length-blocked.length,
  totalChecks:findings.length,
  checks:findings,
  mayDeployAutomatically:false,
  independentEvidenceVerified:false,
  warning:'The JSON consists only of operator attestations. Even all true does not verify restore, package/license, owner approval, actual installed plugin state, CI or WordPress browser QA.'
 };
}
function selfTest(){
 const base={wordpressVersion:'7.0',phpVersion:'8.2',installedFreeVersion:'28.8',targetFreeVersion:'28.8',
  targetPremiumVersion:'28.8',vendorPackageConfirmed:true,restorableBackupConfirmed:true,
  isolatedStagingVerified:true,siteOwnerApproved:true};
 const good=assessUpgrade(base);
 assert.equal(good.state,'self-attested-requires-independent-review');
 assert.equal(good.independentEvidenceVerified,false);
 assert.equal(good.mayDeployAutomatically,false);
 assert.equal(good.blockers.length,0);
 const test=(patch,code,expected)=>{
  const result=assessUpgrade({...base,...patch});
  assert.equal(result.state,'blocked');
  assert.equal(result.blockers.find(x=>x.code===code)?.result,expected);
 };
 test({wordpressVersion:null},'WORDPRESS_CORE_MIN_7_0','unknown');
 test({wordpressVersion:'6.9'},'WORDPRESS_CORE_MIN_7_0','blocked');
 test({targetFreeVersion:'28.7'},'YOAST_FREE_TARGET_MIN_28_8','blocked');
 test({installedFreeVersion:'28.7'},'YOAST_FREE_INSTALLED_MIN_28_8','blocked');
 test({installedFreeVersion:null},'YOAST_FREE_INSTALLED_MIN_28_8','unknown');
 test({targetPremiumVersion:'27.6.1'},'TARGET_PREMIUM_28_8_ONLY','blocked');
 test({phpVersion:'7.3'},'PHP_MIN_7_4_GENERAL','blocked');
 test({vendorPackageConfirmed:false},'OFFICIAL_VENDOR_PACKAGE','blocked');
 test({restorableBackupConfirmed:false},'RESTORE_TESTED','blocked');
 test({isolatedStagingVerified:false},'ISOLATED_STAGING_VERIFIED','blocked');
 test({siteOwnerApproved:false},'OWNER_RELEASE_APPROVAL','blocked');
 const actual=assessUpgrade({wordpressVersion:'7.1.3',phpVersion:'7.4.33',
  installedFreeVersion:'28.7',targetFreeVersion:'28.8',
  targetPremiumVersion:'28.8',vendorPackageConfirmed:false,
  restorableBackupConfirmed:false,isolatedStagingVerified:false,siteOwnerApproved:false});
 assert.equal(actual.state,'blocked');
 assert.equal(actual.blockers.length,5);
 assert.ok(actual.blockers.some(x=>x.code==='YOAST_FREE_INSTALLED_MIN_28_8'));
 assert.equal(actual.checks.find(x=>x.code==='WORDPRESS_CORE_MIN_7_0').result,'satisfied');
 assert.equal(actual.checks.find(x=>x.code==='PHP_MIN_7_4_GENERAL').result,'satisfied');
 assert.equal(actual.mayDeployAutomatically,false);
 console.log('PASS: 13 conservative Yoast Premium compatibility/release-gate scenarios');
}
if(process.argv.includes('--self-test'))selfTest();
else{
 const pos=process.argv.indexOf('--input');
 if(pos<0||!process.argv[pos+1]){console.error('Use --self-test or --input /private/preflight.json');process.exitCode=2;}
 else{
  const outcome=assessUpgrade(JSON.parse(readFileSync(process.argv[pos+1],'utf8')));
  console.log(JSON.stringify(outcome,null,2));
  process.exitCode=2; // Attestations are not independent release clearance, even with all flags true.
 }
}

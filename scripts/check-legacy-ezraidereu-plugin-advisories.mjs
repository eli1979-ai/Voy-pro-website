#!/usr/bin/env node
/**
 * Version-only, read-only triage of three legacy Budapest WordPress plugins.
 * No network, WordPress credentials, user enumeration or runtime writes.
 *
 * node scripts/check-legacy-ezraidereu-plugin-advisories.mjs --self-test
 * node scripts/check-legacy-ezraidereu-plugin-advisories.mjs --input /private/plugin-versions.json
 *
 * Input: {"plugins":[{"slug":"wordpress-seo-premium/wp-seo-premium","version":"21.0","status":"active"}]}
 * Output is a scoped advisory-range match, NOT proof of exploitability,
 * compromise, site safety, or the absence of unlisted vulnerabilities.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ADVISORIES=Object.freeze([
 {slug:'wordpress-seo-premium/wp-seo-premium',id:'CVE-2026-10821',max:'27.6.1',exclusive:true,
  fixed:'27.6.1',privilege:'author+',applicability:'Depends on file-based redirect / .htaccess handling, host configuration and role access',
  source:'https://patchstack.com/database/wordpress/plugin/wordpress-seo-premium/vulnerability/wordpress-yoast-seo-premium-plugin-27-6-1-author-arbitrary-htaccess-directive-injection-to-rce-vulnerability'},
 {slug:'wordpress-seo-premium/wp-seo-premium',id:'CVE-2026-40722',max:'26.6',exclusive:false,
  fixed:'26.7',privilege:'author+',applicability:'Depends on the vulnerable authorization path being reachable',
  source:'https://patchstack.com/database/wordpress/plugin/wordpress-seo-premium/vulnerability/wordpress-yoast-seo-premium-plugin-26-6-broken-access-control-vulnerability'},
 {slug:'elementor/elementor',id:'CVE-2024-5416',max:'3.23.4',exclusive:false,
  fixed:'3.24.0',privilege:'contributor+',applicability:'Requires affected Elementor widget feature, relevant user capability and interaction',
  source:'https://www.wordfence.com/threat-intel/vulnerabilities/wordpress-plugins/elementor/elementor-website-builder-more-than-just-a-page-builder-3234-authenticated-contributor-stored-cross-site-scripting-in-the-url-parameter-in-multiple-widgets'},
 {slug:'contact-form-7/wp-contact-form-7',id:'CVE-2025-3247',max:'6.0.5',exclusive:false,
  fixed:'6.0.6',privilege:'unauthenticated',applicability:'Conditional: affected Contact Form 7 Stripe PaymentIntent workflow must be in use',
  source:'https://www.wordfence.com/threat-intel/vulnerabilities/wordpress-plugins/contact-form-7/contact-form-7-605-order-replay-vulnerability'}
]);
const CHECKED=Object.freeze([...new Set(ADVISORIES.map(x=>x.slug))]);

function parseVersion(version){
 if(typeof version!=='string'||!/^\d+\.\d+(?:\.\d+)?$/.test(version))return null;
 const n=version.split('.').map(Number);
 return n.every(x=>Number.isSafeInteger(x))?[n[0],n[1],n[2]??0]:null;
}
function compare(a,b){
 const x=parseVersion(a),y=parseVersion(b);
 if(!x||!y)return null;
 for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;
 return 0;
}
export function reviewPlugins(input){
 const records=Array.isArray(input)?input:input?.plugins;
 if(!Array.isArray(records))throw Error('Expected {plugins:[{slug,version,status}]} or a plugin array');
 const known=records.filter(x=>x&&typeof x.slug==='string'&&CHECKED.includes(x.slug));
 const ambiguities=CHECKED.filter(slug=>known.filter(x=>x.slug===slug).length!==1);
 const results=ADVISORIES.map(advisory=>{
  const item=known.find(x=>x.slug===advisory.slug);
  const version=item?.version;
  const c=compare(version,advisory.max);
  let match='unknown';
  if(c!==null)match=c<0||(c===0&&!advisory.exclusive)?'within-advisory-version-range':'outside-this-advisory-version-range';
  if(ambiguities.includes(advisory.slug))match='unknown';
  return {slug:advisory.slug,installedVersion:typeof version==='string'?version:null,
   pluginState:item?.status??'unknown',advisory:advisory.id,match,
   fixedIn:advisory.fixed,requiredPrivilege:advisory.privilege,
   applicability:advisory.applicability,reference:advisory.source};
 });
 const matches=results.filter(x=>x.match==='within-advisory-version-range').length;
 const unknown=results.filter(x=>x.match==='unknown').length;
 return {scope:'four historical advisories only; no complete vulnerability scan',
   status:unknown?'inconclusive':matches?'review-needed':'no-version-match-to-these-four-advisories',
   matches,unknown,ambiguousPluginSlugs:ambiguities,results};
}
function selfTest(){
 const item=(slug,version,status='active')=>({slug,version,status});
 const premium='wordpress-seo-premium/wp-seo-premium';
 const elementor='elementor/elementor';
 const cf7='contact-form-7/wp-contact-form-7';
 const all=(prem,elm,contact)=>({plugins:[item(premium,prem),item(elementor,elm),item(cf7,contact)]});
 const current=reviewPlugins(all('21.0','3.23.4','5.9.8'));
 assert.equal(current.status,'review-needed');assert.equal(current.matches,4);assert.equal(current.unknown,0);
 const patched=reviewPlugins(all('27.6.1','3.24.0','6.0.6'));
 assert.equal(patched.status,'no-version-match-to-these-four-advisories');assert.equal(patched.matches,0);
 const edge=reviewPlugins(all('27.6.0','3.23.4','6.0.5'));
 assert.equal(edge.matches,3);
 const mid=reviewPlugins(all('26.7','3.24.0','6.0.6'));
 assert.equal(mid.matches,1);
 const missing=reviewPlugins({plugins:[item(premium,'21.0')]});
 assert.equal(missing.status,'inconclusive');assert.equal(missing.unknown,2);
 const malformed=reviewPlugins(all('invalid','3.24.0','6.0.6'));
 assert.equal(malformed.status,'inconclusive');assert.equal(malformed.unknown,2);
 const dup=reviewPlugins({plugins:[...all('21.0','3.24.0','6.0.6').plugins,item(premium,'27.6.1')]});
 assert.equal(dup.status,'inconclusive');assert.equal(dup.unknown,2);
 const inactive=reviewPlugins({plugins:[item(premium,'21.0','inactive'),item(elementor,'3.24.0'),item(cf7,'6.0.6')]});
 assert.equal(inactive.matches,2);assert.equal(inactive.results[0].pluginState,'inactive');
 assert.equal(compare('21.0','21.0.0'),0);
 assert.equal(compare('27.6.1','27.6.0'),1);
 assert.equal(compare('1.0-beta','1.0'),null);
 assert.equal(reviewPlugins(all('27.6.1','3.24.0','6.0.6')).results.length,4);
 console.log('PASS: 12 read-only advisory/version/unknown-boundary checks');
}
if(process.argv.includes('--self-test'))selfTest();
else{
 const index=process.argv.indexOf('--input');
 if(index<0||!process.argv[index+1]){console.error('Use --self-test or --input /private/plugin-versions.json');process.exitCode=2;}
 else {
  const report=reviewPlugins(JSON.parse(readFileSync(process.argv[index+1],'utf8')));
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.status==='inconclusive'?2:report.matches?1:0;
 }
}

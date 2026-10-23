// Read-only, source-grounded cutover status for VOY PRO.
// "Production" deployment target in voy-pro-staging is not a production identity.
// Never reads secret values, deploys, runs migrations, changes payment, aliases or SEO.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessPublicRelease} from './check-public-release-readiness.mjs';

const STAGING_SITE='prj_mllzA4eTnK6ITda3AI7BpHbmVe7j';
const STAGING_FBM='prj_h5j84vU4HLucTxiWtQQUue9zcn1V';
const STAGING_DB='ieuuobbfginqkngkzbfa';
const MANUAL=[
  'Verify distinct live Vercel website and FBM deployments, deployed commits, aliases, CORS and public client-key scope; project shells alone do not pass.',
  'Reconcile Staging migration history against a distinct Production Supabase database; verify schema, policies, backups and restoration plan without importing live data.',
  'Run approved production-safe API/booking contract checks: catalog, availability, prices, hold lifecycle, request approval, booking confirmation, ancillary and Manage Booking.',
  'Obtain independent payment capability, provider mode, security, refund/cancellation and rollback verification without unapproved real-money transactions.',
  'Verify desktop/mobile/RTL, all destinations, attribution, WhatsApp, private Manage Booking, canonical/hreflang and gradual SEO rollout.',
  'Obtain explicit owner approval before DNS/alias switching, Production credentials, any payment enablement, public indexing or data migration.'
];
function readJSON(filename){
  try{return JSON.parse(fs.readFileSync(filename,'utf8'));}
  catch{return {};}
}
function readText(filename){
  try{return fs.readFileSync(filename,'utf8');}
  catch{return '';}
}
function validProject(value,excluded=[]){
  return /^prj_[A-Za-z0-9]{16,}$/.test(String(value||''))&&!excluded.includes(value);
}
function entry(label,state,evidence){
  return {label,state,evidence};
}
export function getCutoverSnapshot(root=process.cwd()){
  const site=path.join(root,'site');
  const manifest=readJSON(path.join(root,'launch/production-environment.json'));
  const release=readJSON(path.join(site,'release.json'));
  const runtime=readText(path.join(site,'assets/runtime-config.js'));
  const vercel=readJSON(path.join(root,'vercel.json'));
  const robots=readText(path.join(site,'robots.txt'));
  const checks=assessPublicRelease(site,path.join(root,'launch/production-environment.json'),path.join(root,'vercel.json'));
  const websiteRecorded=validProject(manifest.website_vercel_project_id,[STAGING_SITE,STAGING_FBM]);
  const fbmRecorded=validProject(manifest.fbm_vercel_project_id,
    [STAGING_SITE,STAGING_FBM,manifest.website_vercel_project_id]);
  const dbRecorded=/^[a-z0-9]{20}$/.test(String(manifest.supabase_project_ref||''))&&
    manifest.supabase_project_ref!==STAGING_DB;
  const api=String(manifest.public_api_base_url||'');
  const actualRuntime=(runtime.match(/\bapiRoot\s*:\s*['"]([^'"]+)['"]/i)||[])[1]||'';
  const productionApiDeclared=/^https:\/\/[^/?#]+\/api\/v1$/.test(api)&&
    !/staging|(^|[-.])stg([-.]|$)/i.test(new URL(api).hostname);
  const runtimeMatches=productionApiDeclared&&actualRuntime===api;
  const globalNoindex=(vercel.headers||[]).some(rule=>rule.source==='/(.*)'&&
    (rule.headers||[]).some(h=>String(h.key||'').toLowerCase()==='x-robots-tag'&&
      /\bnoindex\b/i.test(String(h.value||''))));
  const steps=[
    entry('Separate website Vercel project ID',websiteRecorded?'RECORDED':'BLOCKED',
      websiteRecorded?'Distinct project identity is recorded; live deployment and domain are not attested':'A distinct project ID is not recorded'),
    entry('Separate FBM Vercel project ID',fbmRecorded?'RECORDED':'BLOCKED',
      fbmRecorded?'Distinct project identity is recorded; API is not attested':'A distinct FBM project ID is not recorded'),
    entry('Separate Production Supabase project ref',dbRecorded?'RECORDED':'BLOCKED',
      dbRecorded?'Distinct database identity is recorded; schema, permissions and backups not attested':'A distinct database ref is not recorded'),
    entry('Production infrastructure verification',manifest.status==='verified'&&!!manifest.verified_at?'RECORDED':'BLOCKED',
      manifest.status==='verified'?'Manifest claims verified; separate live evidence must still be checked':'Manifest is unverified or lacks a verification timestamp'),
    entry('Production public API base URL',productionApiDeclared?'RECORDED':'BLOCKED',
      productionApiDeclared?'Public HTTPS /api/v1 host recorded; consumer tests still required':'Production public API host is missing or invalid'),
    entry('Website runtime uses declared Production API',runtimeMatches?'RECORDED':'BLOCKED',
      runtimeMatches?'Configured API matches declared host; CORS/auth tests still required':'Website API does not point to the declared Production API'),
    entry('Website release source target',release.target==='production'?'RECORDED':'BLOCKED',
      release.target==='production'?'Production target declared; independent deployment still required':'Source release still targets Staging'),
    entry('Crawler cutover source',release.seo_indexable===true&&!globalNoindex&&
      !/^\s*Disallow:\s*\/\s*$/im.test(robots)?'RECORDED':'BLOCKED',
      release.seo_indexable===true&&!globalNoindex?'Source indexing toggles appear enabled; live approval still required':'Staging deliberately blocks crawler access and/or sends global noindex'),
    entry('Explicit owner cutover approval',manifest.owner_cutover_approved===true?'RECORDED':'BLOCKED',
      manifest.owner_cutover_approved===true?'Manifest records approval; verify actual sign-off separately':'Owner approval is not recorded')
  ];
  const recorded=steps.filter(s=>s.state==='RECORDED').length;
  return {
    decision:'NO-GO',
    scope:'Read-only static evidence; never a deploy, payment or owner authorization',
    static_preflight:checks.length===0?'PASS_NEEDS_LIVE_EVIDENCE':'BLOCKED',
    source_blockers:checks,
    evidence:steps,
    recorded,blocked:steps.length-recorded,
    manual_checks:MANUAL
  };
}
export function renderCutoverStatus(result){
  return [
    '# VOY PRO — Production cutover evidence (read-only)',
    '',
    '**Decision: NO-GO.** This report must never authorize a release by itself.',
    '',
    '**Static preflight:** '+result.static_preflight+'; '+result.recorded+'/'+result.evidence.length+
      ' source claims recorded, '+result.blocked+' still blocked. "RECORDED" is not "verified live".',
    '',
    '| Gate | Source claim | Meaning |',
    '| --- | --- | --- |',
    ...result.evidence.map(s=>'| '+s.label+' | '+s.state+' | '+s.evidence+' |'),
    '',
    '## Source checks still failing ('+result.source_blockers.length+')',
    '',
    ...(result.source_blockers.map(s=>'- '+s).length?result.source_blockers.map(s=>'- '+s):['- None. Static checks are not sufficient for cutover.']),
    '',
    '## Required independent evidence before owner approval',
    '',
    ...result.manual_checks.map((s,i)=>(i+1)+'. '+s),
    '',
    '**Never conflate:** a Vercel production-target deployment inside the staging project, a recorded project ID, or a synthetic test with an independently verified Production service.',
    '',
    '**No actions performed:** no DNS, aliases, FBM API, schema migrations, payments, keys, public SEO or real customer data were accessed or changed.',
    ''
  ].join('\n');
}
const cli=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(cli){
  const status=getCutoverSnapshot();
  if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(status,null,2)+'\n');
  else process.stdout.write(renderCutoverStatus(status)+'\n');
  if(process.argv.includes('--strict')&&status.static_preflight!=='PASS_NEEDS_LIVE_EVIDENCE')process.exitCode=1;
}

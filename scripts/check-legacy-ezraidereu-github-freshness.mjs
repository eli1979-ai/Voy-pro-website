#!/usr/bin/env node
/**
 * Read-only GitHub PR/CI snapshot freshness audit for archived EZRaiderEU plans.
 * PUBLIC data only; no GitHub credential, secret, WordPress write or deploy.
 *
 * node scripts/check-legacy-ezraidereu-github-freshness.mjs --self-test
 * node scripts/check-legacy-ezraidereu-github-freshness.mjs --live
 *
 * --live fetches GitHub's public API (18 GETs; NOT CI).
 * A success result requires unchanged archived PR heads, pinned CI, AND no
 * divergent commits behind current main. This still does NOT authorize a merge,
 * WordPress change, production deployment or a third-party provider action.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const CONTRACT=JSON.parse(readFileSync(
 new URL('../docs/legacy-wordpress/ezraidereu-release-contract-20261029.json',import.meta.url),'utf8'));
const OWNER='eli1979-ai',REPO='Voy-pro-website';
const EXPECTED_WORKFLOW='Verify VOY PRO staging artifact';
const EXPECTED_WORKFLOW_ID=362186496;
const SHA=/^[0-9a-f]{40}$/i;
function summarizePull(payload){
 const v=payload?.result??payload;
 return {number:v.number,state:v.state,draft:v.draft,merged:v.merged??false,
   head:v.head?.sha??v.head_sha??v.head,base:v.base?.ref??v.base??'main'};
}
function summarizeRun(payload){
 const v=payload?.result??payload;
 const runs=Array.isArray(v)?v:v?.workflow_runs??[];
 return runs.map(x=>({id:x.id,name:x.name,status:x.status,conclusion:x.conclusion,
   workflowId:x.workflow_id,head:x.head_sha}));
}
function summarizeComparison(payload){
 const v=payload?.result??payload;
 if(!v||!Number.isSafeInteger(v.behind_by)||v.behind_by<0||
   !Number.isSafeInteger(v.ahead_by)||v.ahead_by<0||
   !['identical','ahead','behind','diverged'].includes(v.status))
   return null;
 return {behind:v.behind_by,ahead:v.ahead_by,status:v.status};
}
export function inspectSnapshots(contract,snapshots){
 if(!Array.isArray(contract?.preparedPullRequests)||!snapshots||typeof snapshots!=='object')
  return {status:'inconclusive',findings:['MISSING_INPUT'],checks:[],releaseAuthorized:false};
 const findings=[],checks=[];
 for(const expected of contract.preparedPullRequests){
  const pair=snapshots[String(expected.number)];
  if(!pair){findings.push('NO_LIVE_SNAPSHOT:'+expected.number);continue;}
  const pull=summarizePull(pair.pull),runs=summarizeRun(pair.runs);
  const problems=[];
  if(pull.number!==expected.number)problems.push('WRONG_PR_NUMBER');
  if(pull.state!=='open'||pull.draft!==true||pull.merged===true)
   problems.push('PR_NOT_OPEN_DRAFT');
  if(!SHA.test(pull.head??''))problems.push('INVALID_HEAD_SHA');
  if(pull.head!==expected.head)problems.push('PR_HEAD_CHANGED');
  if(pull.base!=='main')problems.push('PR_BASE_CHANGED');
  if(!Array.isArray(pair.runs?.result?.workflow_runs??pair.runs?.workflow_runs??pair.runs))
   problems.push('MALFORMED_RUNS');
  const matching=runs.filter(x=>x.id===expected.ciRun&&x.name===EXPECTED_WORKFLOW&&
    x.workflowId===EXPECTED_WORKFLOW_ID&&x.status==='completed'&&x.conclusion==='success');
  if(!matching.length)problems.push('PINNED_SOURCE_CI_NOT_VERIFIED');
  if(matching.some(x=>x.head!==undefined&&x.head!==expected.head))
   problems.push('SOURCE_CI_HEAD_MISMATCH');
  const comparison=summarizeComparison(pair.comparison);
  if(!comparison)problems.push('MAIN_COMPARISON_UNAVAILABLE');
  else if(comparison.behind>0)problems.push('BRANCH_BEHIND_CURRENT_MAIN');
  checks.push({pr:expected.number,head:pull.head,
   aheadOfMain:comparison?.ahead??null,behindMain:comparison?.behind??null,
   status:problems.length?'stale-or-unverified':'snapshot-matches',problems});
  findings.push(...problems.map(s=>expected.number+':'+s));
 }
 const unknown=Object.keys(snapshots).filter(x=>!contract.preparedPullRequests.some(p=>String(p.number)===x));
 if(unknown.length)findings.push('UNEXPECTED_SNAPSHOT_ITEMS');
 const incomplete=findings.some(x=>/MAIN_COMPARISON_UNAVAILABLE|MALFORMED_RUNS|NO_LIVE_SNAPSHOT/.test(x));
 return {status:incomplete?'inconclusive':findings.length?'review-needed':'snapshot-matches',
   findings,checks,releaseAuthorized:false,
   scope:'Six archived PR heads + pinned CI + current main...head commit divergence only; no merge conflict resolution, fresh post-rebase tests, live site verification, private restore or deployment approval'};
}
function selfTest(){
 const all=Object.fromEntries(CONTRACT.preparedPullRequests.map(p=>[String(p.number),{
  pull:{number:p.number,state:'open',draft:true,merged:false,head:{sha:p.head},base:{ref:'main'}},
  runs:{workflow_runs:[{id:p.ciRun,name:EXPECTED_WORKFLOW,status:'completed',
    conclusion:'success',workflow_id:EXPECTED_WORKFLOW_ID,head_sha:p.head}]},
  comparison:{status:'ahead',behind_by:0,ahead_by:3}
 }]));
 const clean=inspectSnapshots(CONTRACT,all);
 assert.equal(clean.status,'snapshot-matches');
 assert.equal(clean.releaseAuthorized,false);
 assert.equal(clean.checks.length,6);
 const changed=JSON.parse(JSON.stringify(all));changed['598'].pull.head.sha='a'.repeat(40);
 assert.ok(inspectSnapshots(CONTRACT,changed).findings.includes('598:PR_HEAD_CHANGED'));
 const merged=JSON.parse(JSON.stringify(all));merged['601'].pull.merged=true;
 assert.ok(inspectSnapshots(CONTRACT,merged).findings.includes('601:PR_NOT_OPEN_DRAFT'));
 const rebase=JSON.parse(JSON.stringify(all));rebase['591'].pull.base.ref='oldbranch';
 assert.ok(inspectSnapshots(CONTRACT,rebase).findings.includes('591:PR_BASE_CHANGED'));
 const failed=JSON.parse(JSON.stringify(all));failed['610'].runs.workflow_runs[0].conclusion='failure';
 assert.ok(inspectSnapshots(CONTRACT,failed).findings.includes('610:PINNED_SOURCE_CI_NOT_VERIFIED'));
 const wrongWorkflow=JSON.parse(JSON.stringify(all));wrongWorkflow['625'].runs.workflow_runs[0].workflow_id=123;
 assert.ok(inspectSnapshots(CONTRACT,wrongWorkflow).findings.includes('625:PINNED_SOURCE_CI_NOT_VERIFIED'));
 const changedRun=JSON.parse(JSON.stringify(all));changedRun['625'].runs.workflow_runs[0].head_sha='b'.repeat(40);
 assert.ok(inspectSnapshots(CONTRACT,changedRun).findings.includes('625:SOURCE_CI_HEAD_MISMATCH'));
 const noRuns=JSON.parse(JSON.stringify(all));noRuns['610'].runs={};
 assert.ok(inspectSnapshots(CONTRACT,noRuns).findings.includes('610:MALFORMED_RUNS'));
 const missing=JSON.parse(JSON.stringify(all));delete missing['596'];
 assert.ok(inspectSnapshots(CONTRACT,missing).findings.includes('NO_LIVE_SNAPSHOT:596'));
 const unexpected=JSON.parse(JSON.stringify(all));unexpected['630']={};
 assert.ok(inspectSnapshots(CONTRACT,unexpected).findings.includes('UNEXPECTED_SNAPSHOT_ITEMS'));
 const noStatus=JSON.parse(JSON.stringify(all));noStatus['591'].pull.state='closed';
 assert.ok(inspectSnapshots(CONTRACT,noStatus).findings.includes('591:PR_NOT_OPEN_DRAFT'));
 const dubious=JSON.parse(JSON.stringify(all));dubious['625'].runs={};
 assert.ok(inspectSnapshots(CONTRACT,dubious).findings.includes('625:MALFORMED_RUNS'));
 const advanced=JSON.parse(JSON.stringify(all));advanced['610'].comparison={status:'diverged',behind_by:12,ahead_by:7};
 const drift=inspectSnapshots(CONTRACT,advanced);
 assert.equal(drift.status,'review-needed');
 assert.ok(drift.findings.includes('610:BRANCH_BEHIND_CURRENT_MAIN'));
 assert.equal(drift.releaseAuthorized,false);
 const missingCompare=JSON.parse(JSON.stringify(all));delete missingCompare['596'].comparison;
 assert.equal(inspectSnapshots(CONTRACT,missingCompare).status,'inconclusive');
 assert.ok(inspectSnapshots(CONTRACT,missingCompare).findings.includes('596:MAIN_COMPARISON_UNAVAILABLE'));
 const missingCount=JSON.parse(JSON.stringify(all));missingCount['625'].comparison={status:'ahead',ahead_by:1};
 assert.ok(inspectSnapshots(CONTRACT,missingCount).findings.includes('625:MAIN_COMPARISON_UNAVAILABLE'));
 const alreadyBehind=JSON.parse(JSON.stringify(all));alreadyBehind['591'].comparison={status:'behind',behind_by:1,ahead_by:0};
 assert.ok(inspectSnapshots(CONTRACT,alreadyBehind).findings.includes('591:BRANCH_BEHIND_CURRENT_MAIN'));
 const unknown=inspectSnapshots(CONTRACT,{});
 assert.equal(unknown.status,'inconclusive');
 console.log('PASS: 17 read-only GitHub snapshot and main-divergence checks');
}
async function getJSON(path){
 const url=new URL('https://api.github.com/repos/'+OWNER+'/'+REPO+path);
 if(url.hostname!=='api.github.com')throw Error('Unexpected source');
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(14000),headers:{
   'Accept':'application/vnd.github+json','User-Agent':'EZRaiderEU-ReadOnlyReleaseAudit/1.0',
   'X-GitHub-Api-Version':'2022-11-28'
 }});
 if(!response.ok)throw Error('GitHub API '+response.status+' for '+path);
 return response.json();
}
async function live(){
 const snapshots={};
 for(const p of CONTRACT.preparedPullRequests){
  // Separate reads ensure the CI run is pinned to the exact archived head,
  // not a newer unrelated successful workflow.
  const pull=await getJSON('/pulls/'+p.number);
  const runs=await getJSON('/actions/runs?head_sha='+encodeURIComponent(p.head)+'&per_page=100');
  const comparison=await getJSON('/compare/main...'+encodeURIComponent(p.head));
  snapshots[String(p.number)]={pull,runs,comparison};
 }
 return inspectSnapshots(CONTRACT,snapshots);
}
if(process.argv.includes('--self-test'))selfTest();
else if(process.argv.includes('--live')){
 try{
  const result=await live();
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.status==='snapshot-matches'?0:1;
 }catch(error){
  console.error(JSON.stringify({status:'inconclusive',reason:String(error),releaseAuthorized:false}));
  process.exitCode=2;
 }
}else{
 console.error('Use --self-test or --live (public GitHub GET only; no deployment).');
 process.exitCode=2;
}

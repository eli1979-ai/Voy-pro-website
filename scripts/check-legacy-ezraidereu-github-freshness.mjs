#!/usr/bin/env node
/**
 * Read-only GitHub PR/CI snapshot freshness audit for archived EZRaiderEU plans.
 * PUBLIC data only; no GitHub credential, secret, WordPress write or deploy.
 *
 * node scripts/check-legacy-ezraidereu-github-freshness.mjs --self-test
 * node scripts/check-legacy-ezraidereu-github-freshness.mjs --live
 *
 * --live fetches GitHub's public API (up to 12 GETs; NOT CI).
 * A success result means only the archived PR heads and required website build
 * are unchanged. It DOES NOT permit merge or WordPress deployment.
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
  checks.push({pr:expected.number,head:pull.head,
   status:problems.length?'stale-or-unverified':'snapshot-matches',problems});
  findings.push(...problems.map(s=>expected.number+':'+s));
 }
 const unknown=Object.keys(snapshots).filter(x=>!contract.preparedPullRequests.some(p=>String(p.number)===x));
 if(unknown.length)findings.push('UNEXPECTED_SNAPSHOT_ITEMS');
 return {status:findings.length?'review-needed':'snapshot-matches',
   findings,checks,releaseAuthorized:false,
   scope:'Only six historic draft PR heads + pinned website CI run fields; no live site, actual human review, private restore, or current main conflict testing'};
}
function selfTest(){
 const all=Object.fromEntries(CONTRACT.preparedPullRequests.map(p=>[String(p.number),{
  pull:{number:p.number,state:'open',draft:true,merged:false,head:{sha:p.head},base:{ref:'main'}},
  runs:{workflow_runs:[{id:p.ciRun,name:EXPECTED_WORKFLOW,status:'completed',
    conclusion:'success',workflow_id:EXPECTED_WORKFLOW_ID,head_sha:p.head}]}
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
 const noRuns=JSON.parse(JSON.stringify(all));noRuns['630']={};
 assert.ok(inspectSnapshots(CONTRACT,noRuns).status==='snapshot-matches'); // unknown key is forbidden below
 const missing=JSON.parse(JSON.stringify(all));delete missing['596'];
 assert.ok(inspectSnapshots(CONTRACT,missing).findings.includes('NO_LIVE_SNAPSHOT:596'));
 const unexpected=JSON.parse(JSON.stringify(all));unexpected['630']={};
 assert.ok(inspectSnapshots(CONTRACT,unexpected).findings.includes('UNEXPECTED_SNAPSHOT_ITEMS'));
 const noStatus=JSON.parse(JSON.stringify(all));noStatus['591'].pull.state='closed';
 assert.ok(inspectSnapshots(CONTRACT,noStatus).findings.includes('591:PR_NOT_OPEN_DRAFT'));
 const dubious=JSON.parse(JSON.stringify(all));dubious['625'].runs={};
 assert.ok(inspectSnapshots(CONTRACT,dubious).findings.includes('625:MALFORMED_RUNS'));
 const unknown=inspectSnapshots(CONTRACT,{});
 assert.equal(unknown.status,'review-needed');
 console.log('PASS: 13 read-only GitHub snapshot freshness / stale-state checks');
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
  snapshots[String(p.number)]={pull,runs};
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

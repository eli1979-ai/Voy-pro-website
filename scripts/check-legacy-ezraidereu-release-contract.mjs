#!/usr/bin/env node
/**
 * Offline fail-closed review of the legacy EZRaiderEU handoff contract.
 * No network, no WP/GitHub credentials, no deploy, and no automatic approvals.
 *
 * node scripts/check-legacy-ezraidereu-release-contract.mjs --self-test
 * node scripts/check-legacy-ezraidereu-release-contract.mjs --input /private/release-evidence.json
 *
 * Evidence schema: {"workstream":"wp-acf-content","exactHead":"<SHA>",
 * "gates":{"gateKey":{"verified":true,"evidenceRef":"private checkpoint reference"}}}
 * NEVER put private evidence, customer records or credentials in the public repo.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const CONTRACT=JSON.parse(readFileSync(
 new URL('../docs/legacy-wordpress/ezraidereu-release-contract-20261029.json',import.meta.url),'utf8'));
const REQUIRED_RULES=[
 'mergeRequiresExplicitOwnerApproval','noWordpressProductionWriteFromGithubMerge',
 'doNotAutoInstallWpcodeV7','neverInstallArchivedV61InsteadOfV62',
 'legacyBookingRemainsWhatsAppEnquiryUntilSeparateAuthorizedCutover',
 'rootLisbonDeployIndependentFromBudapestWordpress',
 'securityReleaseMustNotShareRollbackWithEditorialOrMapChanges',
 'neverInferGuestEntranceFromParcelPostalAddress','noVercelPreviewForDocsOnly'
];
const HEX=/^[0-9a-f]{40}$/i;
const EXPECTED_PR_TARGETS=Object.freeze({
  591:'none',
  596:'budapest-wordpress-ACF',
  598:'budapest-WPCode-488',
  601:'documentation-only-do-not-reinstall',
  610:'root-and-lisbon-separate-host',
  625:'staging-security-planning'
});
const EXPECTED_STREAMS=Object.freeze({
  'wp-baseline':{pr:591,target:'budapest-wordpress-ACF',status:'source-only-green',releaseKind:'read-only-QA',gates:[]},
  'wp-acf-content':{pr:596,target:'budapest-wordpress-ACF',status:'blocked',releaseKind:'content-after-review',
    gates:['freshFullBackupRestored','acfFieldMappingVerified','homeTemplateRead','hungarianCopyReviewed',
      'stagingContentAndSeoQaPassed','productionChangeApproved']},
  'wp-map':{pr:598,target:'budapest-WPCode-488',status:'blocked',releaseKind:'map-only-after-pin-verification',
    gates:['freshFullBackupRestored','actualGuestEntranceVerified','officialGoogleEmbedVerified',
      'installedWpcodeSnapshotRead','v62CompatibilityConfirmed','stagingVisualQaPassed','productionChangeApproved']},
  'wp-v62-checkpoint':{pr:601,target:'documentation-only-do-not-reinstall',
    status:'owner-reported-installed',releaseKind:'retain-owner-installed-v6.2',gates:[]},
  'wp-security':{pr:625,target:'staging-security-planning',status:'blocked',
    releaseKind:'staged-one-plugin-at-a-time',
    gates:['freshFullBackupRestored','wpCorePhpVersionsVerified','officialVendorUpdatesVerified',
      'premiumLicensingVerified','stagingSecurityQaPassed','productionChangeApproved']},
  'root-lisbon':{pr:610,target:'root-and-lisbon-separate-host',status:'blocked',
    releaseKind:'independent-site-ownership-and-booking-audit',
    gates:['rootHostSourceIdentified','rootAndLisbonBackupRestored','lisbonExistingBookingsReviewed',
      'providerSalePathReviewed','publicMessagingApproved','rootLisbonStagingQaPassed','productionChangeApproved']}
});

export function validateContract(contract){
 const findings=[];
 const fail=(when,issue)=>{if(when)findings.push(issue);};
 fail(contract?.schemaVersion!==1,'UNSUPPORTED_SCHEMA');
 fail(contract?.sourceRepository!=='eli1979-ai/Voy-pro-website','WRONG_SOURCE_REPOSITORY');
 fail(contract?.ownerDeferredIssue!==604,'MISSING_DEFERRED_OWNER_QUEUE');
 for(const key of REQUIRED_RULES)fail(contract?.hardRules?.[key]!==true,'UNSAFE_OR_MISSING_HARD_RULE:'+key);
 const prs=contract?.preparedPullRequests??[],streams=contract?.workstreams??[];
 fail(!Array.isArray(prs)||prs.length!==6,'PR_INVENTORY_MUST_HAVE_SIX_RECORDS');
 fail(!Array.isArray(streams)||streams.length!==6,'WORKSTREAM_INVENTORY_MUST_HAVE_SIX_RECORDS');
 if(!Array.isArray(prs)||!Array.isArray(streams))return findings;
 const unique=(arr,fn)=>new Set(arr.map(fn)).size===arr.length;
 fail(!unique(prs,x=>x.number),'DUPLICATE_PR');
 fail(!unique(streams,x=>x.id),'DUPLICATE_WORKSTREAM');
 fail(Object.keys(EXPECTED_STREAMS).some(id=>!streams.some(s=>s.id===id)),
   'MISSING_REQUIRED_WORKSTREAM');
 fail(Object.keys(EXPECTED_PR_TARGETS).some(id=>!prs.some(p=>p.number===Number(id))),
   'MISSING_REQUIRED_PR');
 for(const p of prs){
  fail(!Number.isInteger(p.number)||!HEX.test(p.head)||p.state!=='draft-unmerged'||
   !p.branch||!Number.isInteger(p.ciRun),'INVALID_PR_SNAPSHOT:'+p.number);
  fail(!Object.hasOwn(EXPECTED_PR_TARGETS,p.number)||EXPECTED_PR_TARGETS[p.number]!==p.target,
    'PR_TARGET_MISMATCH:'+p.number);
 }
 for(const s of streams){
  const p=prs.find(p=>p.number===s.pr);
  fail(!p,'UNREFERENCED_PR:'+s.id);
  const expected=EXPECTED_STREAMS[s.id];
  fail(!expected,'UNEXPECTED_WORKSTREAM:'+s.id);
  if(expected){
   fail(s.pr!==expected.pr,'WRONG_PR_FOR_STREAM:'+s.id);
   fail(s.target!==expected.target,'WRONG_TARGET_FOR_STREAM:'+s.id);
   fail(s.status!==expected.status,'WRONG_STREAM_STATUS:'+s.id);
   fail(s.releaseKind!==expected.releaseKind,'WRONG_RELEASE_KIND:'+s.id);
   fail(!Array.isArray(s.gateKeys)||s.gateKeys.length!==expected.gates.length
     ||expected.gates.some(k=>!s.gateKeys.includes(k)),'REQUIRED_GATE_SET_MISMATCH:'+s.id);
  }
  fail(s.ownerIssue!==604,'OWNER_QUEUE_MISMATCH:'+s.id);
  fail(s.automaticDeploy!==false,'AUTOMATIC_DEPLOY_NOT_DISABLED:'+s.id);
  fail(!Array.isArray(s.gateKeys)||new Set(s.gateKeys).size!==s.gateKeys.length,
   'INVALID_GATES:'+s.id);
  if(s.status==='blocked'){
   fail(!s.gateKeys?.length,'BLOCKED_STREAM_HAS_NO_GATES:'+s.id);
   fail(!s.gateKeys?.includes('productionChangeApproved'),'MISSING_OWNER_APPROVAL_GATE:'+s.id);
  }else {
   fail(s.gateKeys?.length>0,'NONRELEASE_STREAM_HAS_GATES:'+s.id);
   fail(s.status!=='source-only-green'&&s.status!=='owner-reported-installed','UNKNOWN_NO_RELEASE_STATUS:'+s.id);
  }
 }
 fail(streams.find(x=>x.id==='wp-v62-checkpoint')?.releaseKind!=='retain-owner-installed-v6.2',
   'CANNOT_REPLACE_OWNER_INSTALLED_V62');
 fail(prs.find(x=>x.number===601)?.target!=='documentation-only-do-not-reinstall',
   'ARCHIVED_WPCODE_SNAPSHOT_MUST_NOT_INSTALL');
 fail(streams.find(x=>x.id==='root-lisbon')?.target!=='root-and-lisbon-separate-host',
   'ROOT_LISBON_OWNERSHIP_BOUNDARY');
 return findings;
}
export function assessRelease(contract,evidence={}){
 const errors=validateContract(contract);
 if(errors.length)return {state:'invalid-contract',errors,mayDeployAutomatically:false};
 if(typeof evidence!=='object'||!evidence||Array.isArray(evidence))return {
   state:'invalid-evidence',errors:['NOT_AN_EVIDENCE_OBJECT'],mayDeployAutomatically:false};
 if(Array.isArray(evidence.workstream)||Array.isArray(evidence.workstreams))
   return {state:'blocked',errors:['ONE_ATOMIC_WORKSTREAM_PER_RELEASE'],mayDeployAutomatically:false};
 const stream=contract.workstreams.find(x=>x.id===evidence.workstream);
 if(!stream)return {state:'blocked',errors:['UNKNOWN_OR_UNSELECTED_WORKSTREAM'],mayDeployAutomatically:false};
 const pr=contract.preparedPullRequests.find(x=>x.number===stream.pr);
 if(stream.status==='source-only-green')return {state:'documentation-only',
   workstream:stream.id,pr:pr.number,reason:'Source QA does not authorize or perform any live release.',mayDeployAutomatically:false};
 if(stream.status==='owner-reported-installed')return {state:'retain-installed-v6.2',
   workstream:stream.id,pr:pr.number,reason:'Owner-reported v6.2 must not be reinstalled or replaced by archived candidate.',mayDeployAutomatically:false};
 const errorsFound=[];
 if(evidence.exactHead!==pr.head)errorsFound.push('EXACT_HEAD_NOT_REVERIFIED');
 const provided=evidence.gates;
 if(!provided||typeof provided!=='object'||Array.isArray(provided))errorsFound.push('NO_GATE_EVIDENCE');
 const pending=stream.gateKeys.filter(key=>{
  const result=provided?.[key];
  return result?.verified!==true||typeof result?.evidenceRef!=='string'||!result.evidenceRef.trim();
 });
 const unknown=Object.keys(provided&&typeof provided==='object'&&!Array.isArray(provided)?provided:{})
  .filter(key=>!stream.gateKeys.includes(key));
 if(unknown.length)errorsFound.push('UNKNOWN_GATE_EVIDENCE');
 // This tool only parses *self-reported* evidence. It has no independent way to
 // authenticate private restore logs, owner approval, upstream SHA freshness, or CI.
 // Even a complete set of claimed checks is NOT a verified release clearance.
 return {state:errorsFound.length||pending.length?'blocked':'unverified-attestations-awaiting-review',
   workstream:stream.id,pr:pr.number,exactHead:pr.head,
   missingEvidence:pending,errors:errorsFound,
   note:'Self-reported evidence references are untrusted claims, NOT verified restore, approval, current CI or deployment readiness. A separate authorized human review of actual private evidence and latest PR SHA is mandatory.',
   mayDeployAutomatically:false};
}
function selfTest(){
 const good=validateContract(CONTRACT);
 assert.deepEqual(good,[]);
 const noEvidence=assessRelease(CONTRACT,{workstream:'wp-acf-content'});
 assert.equal(noEvidence.state,'blocked');
 assert.ok(noEvidence.missingEvidence.includes('freshFullBackupRestored'));
 const stillHeld=assessRelease(CONTRACT,{workstream:'wp-map',exactHead:CONTRACT.preparedPullRequests.find(x=>x.number===598).head,gates:{}});
 assert.equal(stillHeld.state,'blocked');
 assert.ok(stillHeld.missingEvidence.includes('actualGuestEntranceVerified'));
 assert.equal(assessRelease(CONTRACT,{workstream:'wp-v62-checkpoint'}).state,'retain-installed-v6.2');
 assert.equal(assessRelease(CONTRACT,{workstream:'wp-baseline'}).state,'documentation-only');
 assert.ok(assessRelease(CONTRACT,{workstreams:['wp-acf-content','wp-security']}).errors.includes('ONE_ATOMIC_WORKSTREAM_PER_RELEASE'));
 const acf=CONTRACT.workstreams.find(x=>x.id==='wp-acf-content');
 const ref=CONTRACT.preparedPullRequests.find(x=>x.number===acf.pr);
 const gates=Object.fromEntries(acf.gateKeys.map(x=>[x,{verified:true,evidenceRef:'private-review:'+x}]));
 assert.equal(assessRelease(CONTRACT,{workstream:acf.id,exactHead:ref.head,gates}).state,'unverified-attestations-awaiting-review');
 assert.equal(assessRelease(CONTRACT,{workstream:acf.id,exactHead:'deadbeef',gates}).state,'blocked');
 const noApproval={...gates,productionChangeApproved:{verified:false,evidenceRef:'owner has not approved'}};
 const blocked=assessRelease(CONTRACT,{workstream:acf.id,exactHead:ref.head,gates:noApproval});
 assert.equal(blocked.state,'blocked');
 assert.ok(blocked.missingEvidence.includes('productionChangeApproved'));
 const fakeEmpty={...gates,freshFullBackupRestored:{verified:true,evidenceRef:''}};
 assert.equal(assessRelease(CONTRACT,{workstream:acf.id,exactHead:ref.head,gates:fakeEmpty}).state,'blocked');
 const typo=assessRelease(CONTRACT,{workstream:acf.id,exactHead:ref.head,gates:{...gates,makeChangesNow:{verified:true,evidenceRef:'no'}}});
 assert.equal(typo.state,'blocked');
 assert.ok(typo.errors.includes('UNKNOWN_GATE_EVIDENCE'));
 const tampered=JSON.parse(JSON.stringify(CONTRACT));tampered.hardRules.mergeRequiresExplicitOwnerApproval=false;
 assert.ok(assessRelease(tampered,{}).errors.some(x=>x.includes('UNSAFE_OR_MISSING_HARD_RULE')));
 const dupe=JSON.parse(JSON.stringify(CONTRACT));dupe.preparedPullRequests[0].number=dupe.preparedPullRequests[1].number;
 assert.ok(validateContract(dupe).includes('DUPLICATE_PR'));
 const noPin=JSON.parse(JSON.stringify(CONTRACT));noPin.workstreams.find(x=>x.id==='wp-map').gateKeys=[];
 assert.ok(validateContract(noPin).includes('BLOCKED_STREAM_HAS_NO_GATES:wp-map'));
 const unsafeArchive=JSON.parse(JSON.stringify(CONTRACT));unsafeArchive.preparedPullRequests.find(x=>x.number===601).target='budapest-WPCode-488';
 assert.ok(validateContract(unsafeArchive).includes('ARCHIVED_WPCODE_SNAPSHOT_MUST_NOT_INSTALL'));
 assert.equal(assessRelease(CONTRACT,{workstream:'root-lisbon'}).state,'blocked');
 assert.equal(assessRelease(CONTRACT,{workstream:'wp-security'}).state,'blocked');
 assert.equal(assessRelease(CONTRACT,{workstream:'unknown'}).state,'blocked');
 assert.equal(assessRelease(CONTRACT,{workstream:'wp-map'}).mayDeployAutomatically,false);
 const swapped=JSON.parse(JSON.stringify(CONTRACT));
 swapped.workstreams.find(x=>x.id==='wp-map').pr=596;
 assert.ok(validateContract(swapped).includes('WRONG_PR_FOR_STREAM:wp-map'));
 const missingGate=JSON.parse(JSON.stringify(CONTRACT));
 missingGate.workstreams.find(x=>x.id==='wp-security').gateKeys.pop();
 assert.ok(validateContract(missingGate).includes('REQUIRED_GATE_SET_MISMATCH:wp-security'));
 const renamedTarget=JSON.parse(JSON.stringify(CONTRACT));
 renamedTarget.workstreams.find(x=>x.id==='root-lisbon').target='budapest-wordpress-ACF';
 assert.ok(validateContract(renamedTarget).includes('WRONG_TARGET_FOR_STREAM:root-lisbon'));
 const retargetPR=JSON.parse(JSON.stringify(CONTRACT));
 retargetPR.preparedPullRequests.find(x=>x.number===598).target='budapest-wordpress-ACF';
 assert.ok(validateContract(retargetPR).includes('PR_TARGET_MISMATCH:598'));
 const forged=assessRelease(CONTRACT,{workstream:acf.id,exactHead:ref.head,
   gates:Object.fromEntries(acf.gateKeys.map(k=>[k,{verified:true,evidenceRef:'anything'}]))});
 assert.equal(forged.state,'unverified-attestations-awaiting-review');
 assert.equal(forged.mayDeployAutomatically,false);
 const masquerade=JSON.parse(JSON.stringify(CONTRACT));
 masquerade.workstreams.find(x=>x.id==='wp-map').status='source-only-green';
 assert.ok(validateContract(masquerade).includes('WRONG_STREAM_STATUS:wp-map'));
 console.log('PASS: 24 read-only release-control and fail-closed gate cases');
}
if(process.argv.includes('--self-test'))selfTest();
else{
 const i=process.argv.indexOf('--input');
 if(i>=0&&process.argv[i+1]){
  const report=assessRelease(CONTRACT,JSON.parse(readFileSync(process.argv[i+1],'utf8')));
  console.log(JSON.stringify(report,null,2));process.exitCode=2; // no asserted evidence can produce an automatic green release
 }else{
  const report={asOf:CONTRACT.asOf,repository:CONTRACT.sourceRepository,
    workstreams:CONTRACT.workstreams.map(s=>assessRelease(CONTRACT,{workstream:s.id})),
    contractProblems:validateContract(CONTRACT),
    message:'Read-only planning snapshot; no standalone CI or production certification'};
  console.log(JSON.stringify(report,null,2));process.exitCode=report.contractProblems.length?2:0;
 }
}

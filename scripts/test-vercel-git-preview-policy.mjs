#!/usr/bin/env node
// Structural guard for a NOT-ACTIVE Vercel Git deployment policy candidate.
// This does not alter vercel.json, Vercel settings, deployments or aliases.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const filename='docs/candidates/vercel-git-preview-allowlist.json';
const candidate=JSON.parse(readFileSync(filename,'utf8'));
const expected={'**':false,'main':true,'release/**':true,'preview/**':true};

function assertCandidate(source){
  const keys=Object.keys(source?.git?.deploymentEnabled||{}).sort();
  assert.deepEqual(keys,Object.keys(expected).sort(),
    'Only blanket-deny + main/release/preview allowlist rules are permitted');
  for(const [pattern,enabled] of Object.entries(expected))
    assert.equal(source.git.deploymentEnabled[pattern],enabled,
      'Unexpected deploymentEnabled setting: '+pattern);
  if(Object.keys(source).some(x=>x!=='git')||
     Object.keys(source.git).some(x=>x!=='deploymentEnabled'))
    throw Error('Candidate must not override headers, redirects, security or release flags');
  return true;
}
assertCandidate(candidate);
const invalid=[
  {...candidate,git:{deploymentEnabled:{...expected,main:false}}},
  {...candidate,git:{deploymentEnabled:{...expected,'**':true}}},
  {...candidate,git:{deploymentEnabled:{...expected,'feature/**':true}}},
  {...candidate,git:{deploymentEnabled:{...expected,'release/**':false}}},
  {...candidate,git:{deploymentEnabled:{...expected,'preview/**':false}}},
  {...candidate,git:{deploymentEnabled:{main:true,'preview/**':true,'release/**':true}}},
  {...candidate,headers:[{source:'/(.*)',headers:[]}]},
  {...candidate,git:{...candidate.git,unknownSetting:true}}
];
for(const bad of invalid)
  assert.throws(()=>assertCandidate(bad),'Unsafe preview policy candidate must be rejected');

const live=JSON.parse(readFileSync('vercel.json','utf8'));
assert.equal(live.git?.deploymentEnabled,undefined,
  'The candidate test must not be used after activating Git suppression without a release-gate review');
assert.equal(live.ignoreCommand,undefined,
  'Do not silently apply the alternative ignored-build policy');
console.log('PASS: proposed preview suppression policy is strictly main/release/preview allowlisted and NOT ACTIVE (eight negatives)');

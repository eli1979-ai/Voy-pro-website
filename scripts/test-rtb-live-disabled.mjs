// Offline regression: verifies the opt-in live safety probe itself.
// No network traffic is made by this file or by the normal site build.
import assert from 'node:assert/strict';
import {verifyDisabledOrigin} from './verify-rtb-disabled-live.mjs';

const headers=values=>({get:k=>values[k.toLowerCase()]||null});
const good=()=>({
  status:404,
  headers:headers({'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, max-age=0'}),
  text:async()=>JSON.stringify({error:'request_intake_disabled'})
});
const valid=['https://voy-pro.com','https://voy-pro-staging.vercel.app',
  'https://voy-pro-staging-git-test-eli1979-5448.vercel.app'];
for(const origin of valid){
  let calls=0;
  const check=await verifyDisabledOrigin(origin,{fetchImpl:async(url,options)=>{
    calls++;
    assert.equal(url,origin+'/api/request-to-book');
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'manual');
    assert.equal(options.cache,'no-store');
    assert.equal(options.headers.accept,'application/json');
    assert.equal('body' in options,false,'Never POST or include a body');
    assert.equal('authorization' in options.headers,false,'No credentials on probes');
    return good();
  }});
  assert.equal(calls,1);
  assert.equal(check.disabled,true);
  assert.equal(check.status,404);
}
for(const disallowed of [
  'http://voy-pro.com','https://voy-pro.com:8443',
  'https://user:pw@voy-pro.com','https://voy-pro.com/admin',
  'https://voy-pro.com/?token=secret','https://voy-pro.com/#frag',
  'https://voy-pro.com.evil.example','https://evil.example',
  'https://voy-pro-staging-evil.vercel.app'
]){
  let calls=0;
  await assert.rejects(()=>verifyDisabledOrigin(disallowed,{fetchImpl:async()=>{
    calls++;return good();
  }}));
  assert.equal(calls,0,'Unknown URL must not be contacted: '+disallowed);
}
for(const invalid of [
  {...good(),status:200},
  {...good(),status:405},
  {...good(),status:307},
  {...good(),status:403},
  {...good(),headers:headers({'content-type':'text/html','cache-control':'no-store'})},
  {...good(),headers:headers({'content-type':'application/json','cache-control':'public, max-age=3600'})},
  {...good(),text:async()=>'<html>404 Not Found</html>'},
  {...good(),text:async()=>JSON.stringify({error:'not_found'})},
  {...good(),text:async()=>JSON.stringify({status:'pending_review'})}
]){
  await assert.rejects(()=>verifyDisabledOrigin('https://voy-pro.com',{
    fetchImpl:async()=>invalid
  }), 'An ordinary 404/SSO/misrouted path must never be mistaken for disabled RTB');
}
await assert.rejects(()=>verifyDisabledOrigin('https://voy-pro.com',{
  fetchImpl:async()=>{throw new Error('synthetic TLS failure');}
}));
console.log('RTB live disabled read-only probe QA OK: GET only, explicit hosts, exact 404 JSON/no-store, no silent redirect or false-positive 404.');

import fs from 'node:fs';
import vm from 'node:vm';

const file='site/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];
const pos=token=>html.indexOf(token);

const cleanup=pos("if(q.get('token'))");
const removeQuery=pos("clean.searchParams.delete('token')");
const putHash=pos("safeHash.set('token',token)");
const replaceUrl=pos("history.replaceState");
const siteJs=pos('<script src="/assets/site.js"></script>');
const siteJsCount=(html.match(/\/assets\/site\.js/g)||[]).length;

if(cleanup<0)failures.push('query-token cleanup entry point missing');
if(removeQuery<0)failures.push('token is not removed from query params');
if(putHash<0)failures.push('token is not moved to URL hash');
if(replaceUrl<0)failures.push('cleaned URL is not written with history.replaceState');
if(siteJs<0)failures.push('site.js script tag missing');
if(siteJsCount!==1)failures.push('expected exactly one site.js load, found '+siteJsCount);
if(!(cleanup>=0&&removeQuery>cleanup&&putHash>removeQuery&&replaceUrl>putHash&&siteJs>replaceUrl)){
  failures.push('token cleanup must complete before site.js loads');
}


// Execute the exact deployed cleanup snippet with fabricated tokens. Source-order
// checks above alone would pass some semantically broken URL rewrites.
const blockEnd=cleanup>=0?html.indexOf(" const home=",cleanup):-1;
if(cleanup<0||blockEnd<=cleanup){
  failures.push('cannot isolate the runtime token cleanup block for execution');
}else{
  const runtimeBlock=html.slice(cleanup,blockEnd);
  if(!runtimeBlock.trim().startsWith("if(q.get('token')){")||
     !runtimeBlock.trim().endsWith('}')){
    failures.push('runtime cleanup block changed shape; update synthetic tests explicitly');
  }else{
    function executeCleanup(input){
      const url=new URL(input),query=new URLSearchParams(url.search);
      const fragment=new URLSearchParams(url.hash.replace(/^#/,''));
      const historyCalls=[];
      const context={
        URL,URLSearchParams,
        q:query,
        token:query.get('token')||fragment.get('token'),
        location:{href:url.href},
        history:{replaceState(_state,_title,next){historyCalls.push(next);}}
      };
      vm.runInNewContext(runtimeBlock,context,{timeout:1000,filename:'Manage token cleanup'});
      const updated=historyCalls.length
        ?new URL(historyCalls[historyCalls.length-1],url.origin):url;
      return {updated,historyCalls};
    }
    try{
      const queryCase=executeCleanup(
        'https://voy-pro.com/manage/?token=synthetic-alpha&lang=he&payment=success#source=confirmation');
      const moved=new URLSearchParams(queryCase.updated.hash.slice(1));
      if(queryCase.historyCalls.length!==1||
        queryCase.updated.pathname!=='/manage/'||
        queryCase.updated.searchParams.has('token')||
        queryCase.updated.searchParams.get('lang')!=='he'||
        queryCase.updated.searchParams.get('payment')!=='success'||
        moved.get('token')!=='synthetic-alpha'||
        moved.get('source')!=='confirmation')
        failures.push('query token not safely moved to fragment with unrelated query/hash preserved');

      const repeated=executeCleanup(
        'https://voy-pro.com/manage/?lang=hu&token=synthetic-first&token=synthetic-second#token=old&source=mail');
      const repeatedHash=new URLSearchParams(repeated.updated.hash.slice(1));
      if(repeated.historyCalls.length!==1||
        repeated.updated.searchParams.has('token')||
        repeated.updated.searchParams.get('lang')!=='hu'||
        repeatedHash.get('token')!=='synthetic-first'||
        repeatedHash.getAll('token').length!==1||
        repeatedHash.get('source')!=='mail')
        failures.push('duplicate query tokens or stale fragment token survived cleanup');

      const hashOnly=executeCleanup(
        'https://voy-pro.com/manage/?lang=he#token=synthetic-hash&source=confirmation');
      if(hashOnly.historyCalls.length!==0||
        hashOnly.updated.searchParams.has('token')||
        new URLSearchParams(hashOnly.updated.hash.slice(1)).get('token')!=='synthetic-hash')
        failures.push('fragment-only booking token must not be rewritten into URL query');

      const tokenless=executeCleanup('https://voy-pro.com/manage/?lang=hu#source=footer');
      if(tokenless.historyCalls.length!==0||tokenless.updated.searchParams.has('token')||
        tokenless.updated.searchParams.get('lang')!=='hu')
        failures.push('tokenless Manage link should not create or expose any token');
    }catch(error){
      failures.push('synthetic runtime token URL cleanup execution failed: '+error.message);
    }
  }
}

if(failures.length){
  console.error('Manage token URL-boundary guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Manage token URL-boundary guard OK: query token moves to hash and is removed before global site.js analytics loads.');

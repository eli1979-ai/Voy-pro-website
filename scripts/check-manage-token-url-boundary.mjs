import fs from 'node:fs';

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

if(failures.length){
  console.error('Manage token URL-boundary guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Manage token URL-boundary guard OK: query token moves to hash and is removed before global site.js analytics loads.');

#!/usr/bin/env node
// No network, Vercel tokens or deployments; simulate served HTTP responses.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {verifyPreviewHttp} from './check-prebuilt-preview-http.mjs';

const root=mkdtempSync(join(tmpdir(),'voy-http-fixtures-'));
const save=(path,content)=>{
  const target=join(root,path);mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,typeof content==='string'?content:JSON.stringify(content));
};
const previewUrl='https://voy-pro-preview-123.vercel.app';
const policy={
  headers:[
    {source:'/(.*)',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), usb=()'},
      {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
      {key:'X-Robots-Tag',value:'noindex, nofollow'}]},
    {source:'/manage/(.*)',headers:[
      {key:'X-Robots-Tag',value:'noindex, nofollow'},
      {key:'Cache-Control',value:'private, no-store, max-age=0'}]}],
  redirects:[
    {source:'/budapest/ezraider/',destination:'/ezraider/?from=budapest',permanent:true},
    {source:'/he/budapest/ezraider/',destination:'/he/ezraider/?from=budapest',permanent:true},
    {source:'/hu/budapest/ezraider/',destination:'/hu/ezraider/?from=budapest',permanent:true}]
};
save('vercel.json',policy);
save('site/release.json',{version:'1.48.99',target:'staging',seo_indexable:false});
save('site/robots.txt','User-agent: *\nDisallow: /\n');
save('dist/assets/site.js','// reviewed booking client');
const common=Object.fromEntries(policy.headers[0].headers.map(x=>[x.key,x.value]));
const privateHeaders=Object.fromEntries(policy.headers[1].headers.map(x=>[x.key,x.value]));
function good(path){
  const redirect=policy.redirects.find(rule=>rule.source===path);
  if(redirect)return {status:308,headers:{Location:redirect.destination},body:''};
  const headers={...common,...(path.startsWith('/manage/')?privateHeaders:{})};
  const body=path==='/release.json'?JSON.stringify({version:'1.48.99',target:'staging',seo_indexable:false}):
    path==='/robots.txt'?'User-agent: *\nDisallow: /\n':
    path==='/assets/site.js'?'// reviewed booking client':
    '<!doctype html><html lang="en"><body>VOY PRO</body></html>';
  return {status:200,headers,body};
}
const exercise=({mutate,url=previewUrl}={})=>verifyPreviewHttp({
  rootDir:root,previewUrl:url,
  request:async path=>mutate?mutate(path,structuredClone(good(path))):good(path)
});
async function reject(fn,pattern){
  await assert.rejects(exercise({mutate:fn}),pattern);
}
try{
  assert.deepEqual(await exercise(),{pages:8,staticChecks:3,redirects:3});
  await reject((p,r)=>{if(p==='/assets/site.js')delete r.headers['X-Robots-Tag'];return r;},/X-Robots-Tag/);
  await reject((p,r)=>{if(p==='/manage/')delete r.headers['Cache-Control'];return r;},/Cache-Control/);
  await reject((p,r)=>{if(p==='/')r.status=302;return r;},/expected HTTP 200/);
  await reject((p,r)=>{if(p==='/portugal/')r.body='not html';return r;},/non-HTML/);
  await reject((p,r)=>{if(p==='/robots.txt')r.body='User-agent: *\nAllow: /';return r;},/robots/);
  await reject((p,r)=>{if(p==='/release.json')r.body=JSON.stringify({version:'0',target:'staging',seo_indexable:false});return r;},/release identity/);
  await reject((p,r)=>{if(p==='/assets/site.js')r.body='// injected';return r;},/booking JavaScript/);
  await reject((p,r)=>{if(p==='/budapest/ezraider/')r.status=307;return r;},/status mismatch/);
  await reject((p,r)=>{if(p==='/budapest/ezraider/')r.headers.Location='https://evil.example/ezraider/?from=budapest';return r;},/external origin/);
  await reject((p,r)=>{if(p==='/he/budapest/ezraider/')r.headers.Location='/hu/ezraider/?from=budapest';return r;},/destination mismatch/);
  await reject((p,r)=>{if(p==='/')r.headers['Referrer-Policy']='unsafe-url';return r;},/Referrer-Policy/);
  await assert.rejects(exercise({url:'https://voy-pro.com'}),/isolated HTTPS/);
  await assert.rejects(exercise({url:'https://voy-pro-preview-123.vercel.app.evil.example'}),/isolated HTTPS/);
  console.log('PASS: protected Preview HTTP parity (positive + 13 fail-closed fixtures, offline)');
}finally{rmSync(root,{recursive:true,force:true});}

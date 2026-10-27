#!/usr/bin/env node
// Fast hermetic negative/positive tests; no network, credentials or deployments.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {verifyPrebuilt} from './check-prebuilt-output.mjs';
const root=mkdtempSync(join(tmpdir(),'voy-prebuilt-'));
const save=(path,content)=>{
  const target=join(root,path);mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,typeof content==='string'?content:JSON.stringify(content));
};
const defaults={
  version:3,
  routes:[
    {src:'^/budapest/ezraider/$',status:308,headers:{Location:'/ezraider/?from=budapest'}},
    {src:'^/he/budapest/ezraider/$',status:308,headers:{Location:'/he/ezraider/?from=budapest'}},
    {src:'^/hu/budapest/ezraider/$',status:308,headers:{Location:'/hu/ezraider/?from=budapest'}},
    {src:'^/manage/.*',continue:true,headers:{'X-Robots-Tag':'noindex, nofollow','Cache-Control':'private, no-store, max-age=0'}},
    {src:'^/.*',continue:true,headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=(), usb=()','Cross-Origin-Opener-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow'}},
    {handle:'filesystem'}
  ]
};
const rootPolicy={
  buildCommand:'npm run build',outputDirectory:'dist',
  headers:[
    {source:'/(.*)',headers:Object.entries(defaults.routes[4].headers).map(([key,value])=>({key,value}))},
    {source:'/manage/(.*)',headers:Object.entries(defaults.routes[3].headers).map(([key,value])=>({key,value}))}
  ],
  redirects:[
    {source:'/budapest/ezraider/',destination:'/ezraider/?from=budapest',permanent:true},
    {source:'/he/budapest/ezraider/',destination:'/he/ezraider/?from=budapest',permanent:true},
    {source:'/hu/budapest/ezraider/',destination:'/hu/ezraider/?from=budapest',permanent:true}
  ]
};
const release={version:'1.48.99',target:'staging',seo_indexable:false};
function setup(config=defaults,rebuilt=release,robots='User-agent: *\nDisallow: /'){
  save('vercel.json',rootPolicy);save('package.json',{version:'1.48.99'});
  save('site/release.json',release);save('site/robots.txt','User-agent: *\nDisallow: /');
  save('.vercel/output/config.json',config);save('.vercel/output/static/release.json',rebuilt);
  save('.vercel/output/static/robots.txt',robots);
  const html=['index.html','budapest/index.html','he/budapest/index.html',
    'hu/budapest/index.html','portugal/index.html','he/portugal/index.html',
    'pt/portugal/index.html','manage/index.html'];
  for(const h of html)save('.vercel/output/static/'+h,'<!doctype html>'+h);
  save('dist/index.html','<!doctype html>index.html');
  save('dist/assets/site.js','// tested runtime');
  save('.vercel/output/static/assets/site.js','// tested runtime');
}
const clone=()=>structuredClone(defaults);
function reject(mutation,pattern){
  setup();mutation();
  assert.throws(()=>verifyPrebuilt(root),pattern);
}
try{
  setup();assert.equal(verifyPrebuilt(root).redirects,3);
  reject(()=>{const c=clone();delete c.routes[4].headers['X-Robots-Tag'];save('.vercel/output/config.json',c);},/X-Robots-Tag/);
  reject(()=>{const c=clone();c.routes.splice(1,1);save('.vercel/output/config.json',c);},/Missing exact redirect/);
  reject(()=>{const c=clone();delete c.routes[3].headers['Cache-Control'];save('.vercel/output/config.json',c);},/Cache-Control/);
  reject(()=>save('.vercel/output/static/release.json',{...release,version:'0.0.0'}),/release identity/);
  reject(()=>save('.vercel/output/static/robots.txt','User-agent: *\nAllow: /'),/robots/);
  reject(()=>{const c=clone();c.routes.unshift({src:'^/$',status:307,headers:{Location:'/budapest/'}});save('.vercel/output/config.json',c);},/Unexpected redirect/);
  reject(()=>{const c=clone();c.routes[4].continue=false;save('.vercel/output/config.json',c);},/Non-continuing/);
  reject(()=>save('.vercel/output/config.json',{version:3,routes:[]}),/routing rules/);
  reject(()=>{const c=clone();c.routes.splice(4,0,{handle:'filesystem'});save('.vercel/output/config.json',c);},/missing\/mismatched/);
  reject(()=>{const c=clone();c.routes[4].has=[{type:'header',key:'x-bypass',value:'yes'}];save('.vercel/output/config.json',c);},/Conditional or transformed/);
  reject(()=>{const c=clone();c.routes[0].methods=['POST'];save('.vercel/output/config.json',c);},/Conditional or transformed/);
  reject(()=>{const c=clone();c.routes[4].src='^\\/(?!assets\\/).*';save('.vercel/output/config.json',c);},/missing\/mismatched/);
  reject(()=>{const c=clone();c.routes.unshift({src:'^/
}finally{rmSync(root,{recursive:true,force:true});}
,dest:'/budapest/index.html'});save('.vercel/output/config.json',c);},/cross-page rewrite/);
  console.log('PASS: prebuilt parity hermetic tests (valid and thirteen fail-closed scenarios)');
}finally{rmSync(root,{recursive:true,force:true});}

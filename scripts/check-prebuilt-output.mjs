#!/usr/bin/env node
// Fail closed before uploading a Vercel Build Output API artifact.
// The PREBUILT config must carry the same sensitive routing policy as vercel.json.
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

function read(root,path){return readFileSync(join(root,path),'utf8');}
function json(root,path){return JSON.parse(read(root,path));}
function fail(msg){throw Error('Unsafe prebuilt artifact: '+msg);}
function headerValue(headers,key){
  const entry=Object.entries(headers||{}).find(([k])=>k.toLowerCase()===key.toLowerCase());
  return entry?.[1];
}
function routeMatches(route,url){
  if(!route?.src)return false;
  let re;
  try{re=new RegExp(route.src);}catch{fail('Unsupported route expression: '+route.src);}
  return re.test(url);
}
function simulate(config,pathname){
  let headers={},redirect=null;
  // Vercel Build Output API routes are ordered. A redirect/dest ends this phase;
  // a security header needs continue:true or it can hide later routes.
  for(const route of config.routes){
    // A Build Output API handler changes the routing phase. Do not claim a
    // header/redirect applies when it appears in a later phase after a hit.
    // This intentionally fails closed rather than pretending all rules form
    // one unordered route list.
    if(route.handle)break;
    if(!routeMatches(route,pathname))continue;
    // Such rules depend on request headers, cookies, methods or middleware,
    // which an offline pathname-only simulation cannot prove safe.
    if(route.has||route.missing||route.methods||route.locale||route.check||
       route.middlewarePath||route.middlewareRawSrc||route.mitigate||
       route.transforms)fail('Conditional or transformed route cannot prove parity: '+route.src);
    Object.assign(headers,route.headers||{});
    if(route.status && (headerValue(route.headers,'location')||route.dest)){
      redirect={status:Number(route.status),location:headerValue(route.headers,'location')||route.dest};
      break;
    }
    if(route.headers && Object.keys(route.headers).length && route.continue!==true && !route.dest){
      fail('Non-continuing header-only route applies to '+pathname+': '+route.src);
    }
    if(route.continue!==true && (route.dest||route.status)){
      return {headers,redirect,rewrite:route.dest||null,status:Number(route.status||200)};
    }
  }
  return {headers,redirect,rewrite:null,status:200};
}
export function verifyPrebuilt(rootDir=process.cwd()){
  const root=resolve(rootDir);
  const config=json(root,'.vercel/output/config.json');
  const source=json(root,'vercel.json');
  const release=json(root,'site/release.json');
  const built=json(root,'.vercel/output/static/release.json');
  const pkg=json(root,'package.json');
  if(config.version!==3||!Array.isArray(config.routes)||!config.routes.length)
    fail('Missing official Build Output API v3 routing rules');
  if(source.outputDirectory!=='dist'||source.buildCommand!=='npm run build')
    fail('Unexpected canonical website build contract');
  if(release.version!==pkg.version||built.version!==release.version||
     release.target!=='staging'||built.target!=='staging'||
     release.seo_indexable!==false||built.seo_indexable!==false)
    fail('Staging release identity/SEO safety mismatch');
  const staticRoot=join(root,'.vercel/output/static');
  const required=[
    'index.html','release.json','robots.txt','assets/site.js',
    'budapest/index.html','he/budapest/index.html','hu/budapest/index.html',
    'portugal/index.html','he/portugal/index.html','pt/portugal/index.html',
    'manage/index.html'
  ];
  for(const file of required)if(!existsSync(join(staticRoot,file)))fail('Missing built static file '+file);
  const rootRobots=read(root,'site/robots.txt').trim();
  if(!/^User-agent:\s*\*\s*$/im.test(rootRobots)||!/^Disallow:\s*\/\s*$/im.test(rootRobots))
    fail('Staging robots source must disallow crawling');
  if(read(root,'.vercel/output/static/robots.txt').trim()!==rootRobots)
    fail('Built robots.txt differs from reviewed source');
  if(read(root,'.vercel/output/static/index.html')!==read(root,'dist/index.html'))
    fail('Root HTML changed between GitHub build and official prebuilt');
  if(read(root,'.vercel/output/static/assets/site.js')!==read(root,'dist/assets/site.js'))
    fail('Booking JavaScript changed between GitHub build and prebuilt');
  // Check every served static file, not just the 8 sample pages: a narrow
  // noindex/security matcher could otherwise pass sample checks but expose
  // images, JS, languages or other HTML to crawlers.
  const paths=[];
  const walk=(relative='')=>{
    for(const entry of readdirSync(join(staticRoot,relative),{withFileTypes:true})){
      const name=relative?relative+'/'+entry.name:entry.name;
      if(entry.isDirectory())walk(name);
      else if(entry.isFile())
        paths.push(name==='index.html'?'/':name.endsWith('/index.html')
          ?'/'+name.slice(0,-'index.html'.length):'/'+name);
    }
  };
  walk();
  paths.push('/manage/__sensitive_probe__');
  for(const pathname of [...new Set(paths)]){
    const actual=simulate(config,pathname);
    if(actual.redirect||actual.status>=400)fail('Unexpected redirect/error for public resource '+pathname);
    const canonicalStatic=pathname.endsWith('/')?pathname+'index.html':pathname;
    if(actual.rewrite&&actual.rewrite!==canonicalStatic&&actual.rewrite!==pathname)
      fail('Unexpected cross-page rewrite for '+pathname+' => '+actual.rewrite);
    const requiredHeaders=source.headers.filter(item=>{
      const matcher=item.source.replace(/\(\.\*\)/g,'.*');
      return routeMatches({src:'^'+matcher+'$'},pathname);
    });
    for(const policy of requiredHeaders){
      for(const hdr of policy.headers){
        const got=headerValue(actual.headers,hdr.key);
        if(typeof got!=='string'||got.trim().toLowerCase()!==hdr.value.trim().toLowerCase())
          fail(pathname+' missing/mismatched '+hdr.key+' (expected '+hdr.value+')');
      }
    }
  }
  for(const rule of source.redirects||[]){
    const got=simulate(config,rule.source).redirect;
    const status=rule.permanent?308:307;
    if(!got||got.status!==status||got.location!==rule.destination)
      fail('Missing exact redirect: '+rule.source+' => '+rule.destination);
  }
  return {resources:new Set(paths).size,redirects:(source.redirects||[]).length,release:release.version};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const ok=verifyPrebuilt();console.log('PASS: prebuilt route/header/redirect/asset parity '+JSON.stringify(ok));}
  catch(err){console.error(err.message);process.exitCode=1;}
}

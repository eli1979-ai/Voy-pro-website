#!/usr/bin/env node
// Protected Preview HTTP parity gate. Never called by ordinary PR CI.
// Only the manually approved publish_preview branch can contact Vercel.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const read=(root,p)=>readFileSync(join(root,p),'utf8');
const json=(root,p)=>JSON.parse(read(root,p));
const norm=value=>String(value||'').trim().toLowerCase();
const header=(headers,key)=>Object.entries(headers||{})
  .find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1];
const PAGES=['/','/budapest/','/he/budapest/','/hu/budapest/',
  '/portugal/','/he/portugal/','/pt/portugal/','/manage/'];
const ASSETS=['/assets/site.js','/robots.txt','/release.json'];

export async function verifyPreviewHttp({rootDir=process.cwd(),previewUrl,request}){
  const root=resolve(rootDir);
  if(typeof previewUrl!=='string'||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(previewUrl))
    throw Error('Preview must be one exact isolated HTTPS vercel.app origin');
  if(typeof request!=='function')throw Error('A protected Preview request function is required');
  const config=json(root,'vercel.json');
  const expectedRelease=json(root,'site/release.json');
  assert.equal(expectedRelease.target,'staging');
  assert.equal(expectedRelease.seo_indexable,false);
  const globals=config.headers.find(rule=>rule.source==='/(.*)')?.headers||[];
  const manage=config.headers.find(rule=>rule.source==='/manage/(.*)')?.headers||[];
  if(!globals.length||!manage.length)throw Error('Canonical HTTP security policies missing');

  const checked=[];
  for(const path of [...PAGES,...ASSETS]){
    const response=await request(path);
    if(response.status!==200){
      // Fail closed on an authentication redirect: a Vercel login page does
      // not prove that the deployed application passed its HTTP security gate.
      // Do not print the Location query (which may contain auth parameters).
      if(response.status===302){
        let host='unknown';
        try{host=new URL(header(response.headers,'Location')||'/',previewUrl).hostname;}catch{}
        throw Error(path+': HTTP 302 before application response (redirect host '+host+
          '); check protected Preview authentication, never disable protection');
      }
      throw Error(path+': expected HTTP 200, received '+response.status);
    }
    if(typeof response.body!=='string')throw Error(path+': response body unavailable');
    for(const required of globals){
      if(norm(header(response.headers,required.key))!==norm(required.value))
        throw Error(path+': missing/mismatched HTTP security header '+required.key);
    }
    if(path.startsWith('/manage/')){
      for(const required of manage){
        if(norm(header(response.headers,required.key))!==norm(required.value))
          throw Error(path+': missing/mismatched private HTTP header '+required.key);
      }
      if(!norm(header(response.headers,'Cache-Control')).includes('no-store'))
        throw Error('Manage Booking must be no-store');
    }
    if(PAGES.includes(path)&&!/<(?:!doctype html|html)\b/i.test(response.body))
      throw Error(path+': unexpected non-HTML content');
    if(path==='/robots.txt'&&response.body.trim()!==read(root,'site/robots.txt').trim())
      throw Error('Published robots.txt differs from reviewed noindex source');
    if(path==='/assets/site.js'&&response.body!==read(root,'dist/assets/site.js'))
      throw Error('Published booking JavaScript differs from reviewed build');
    if(path==='/release.json'){
      const release=JSON.parse(response.body);
      if(release.version!==expectedRelease.version||release.target!=='staging'||
        release.seo_indexable!==false)
        throw Error('Published Preview release identity or SEO flags mismatch');
    }
    checked.push(path);
  }
  for(const rule of config.redirects||[]){
    const response=await request(rule.source);
    const status=rule.permanent?308:307;
    if(response.status!==status)throw Error(rule.source+': redirect status mismatch');
    const location=header(response.headers,'Location');
    if(!location)throw Error(rule.source+': redirect Location missing');
    const parsed=new URL(location,previewUrl);
    const expected=new URL(rule.destination,previewUrl);
    if(parsed.origin!==previewUrl||parsed.pathname!==expected.pathname||
       parsed.search!==expected.search||parsed.hash!==expected.hash)
      throw Error(rule.source+': redirect destination mismatch or external origin');
    checked.push(rule.source);
  }
  return {pages:PAGES.length,staticChecks:ASSETS.length,redirects:(config.redirects||[]).length};
}

function curlHeaders(raw){
  const blocks=String(raw).trim().split(/\r?\n\r?\n/);
  const block=blocks.filter(x=>/^HTTP\/[\d.]+\s+\d{3}/.test(x.trim())).at(-1);
  if(!block)throw Error('Protected Preview response status/headers missing');
  const lines=block.trim().split(/\r?\n/);
  const match=lines.shift().match(/^HTTP\/[\d.]+\s+(\d{3})/);
  if(!match)throw Error('Protected Preview invalid HTTP status');
  const headers={};
  for(const line of lines){
    const sep=line.indexOf(':');
    if(sep>0)headers[line.slice(0,sep).trim()]=line.slice(sep+1).trim();
  }
  return {status:Number(match[1]),headers};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const previewUrl=process.env.PREVIEW_URL;
  const temporary=mkdtempSync(join(tmpdir(),'voy-http-parity-'));
  let seq=0;
  try{
    const request=async path=>{
      const n=seq++;
      const headersFile=join(temporary,'headers-'+n);
      const bodyFile=join(temporary,'body-'+n);
      // Invoke the exact immutable Preview URL rather than a project-relative
      // path. Vercel CLI supports URL-based protected requests and uses its
      // existing CI authentication; never put a bypass token in arguments.
      // Keep redirects disabled so a login 302 cannot be mistaken for HTTP 200.
      if(!path.startsWith('/'))throw Error('Expected origin-relative Preview resource');
      const exact=new URL(path,previewUrl);
      if(exact.origin!==previewUrl)throw Error('Refusing non-Preview HTTP target');
      const response=spawnSync('vercel',['curl',exact.href,
        '--silent','--show-error','--max-redirs','0',
        '--dump-header',headersFile,'--output',bodyFile],{
        encoding:'utf8',timeout:45000,maxBuffer:1024*1024
      });
      if(response.error||response.status!==0)
        throw Error(path+': protected Vercel HTTP request failed (exit '+response.status+')');
      const parsed=curlHeaders(readFileSync(headersFile,'utf8'));
      return {...parsed,body:readFileSync(bodyFile,'utf8')};
    };
    const result=await verifyPreviewHttp({previewUrl,request});
    console.log('PASS: protected isolated Preview HTTP policy parity '+JSON.stringify(result));
  }catch(err){
    console.error('FAIL: protected isolated Preview parity: '+err.message);
    process.exitCode=1;
  }finally{rmSync(temporary,{recursive:true,force:true});}
}

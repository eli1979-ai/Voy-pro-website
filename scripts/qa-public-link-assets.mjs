// Public-site internal navigation and static asset integrity sweep.
// Reads the built dist directory only; never queries FBM, payment APIs or public search services.
import assert from 'node:assert/strict';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep,extname,join} from 'node:path';

const origin='https://voy-pro.com';
const dist=resolve('dist');
const output=resolve('visual-qa-output/link-integrity');
await mkdir(output,{recursive:true});
const xml=await readFile('site/sitemap.xml','utf8');
const paths=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
assert.ok(paths.length>=40,'Expected all localized public sitemap pages');
const knownPaths=new Set(paths);
const checks=new Map(),errors=[],advisories=[];
const checkedAssets=new Set();
let resourceCount=0,anchorCount=0;

function value(tag,attr){
  const re=new RegExp('\\b'+attr+'\\s*=\\s*(["\\x27])(.*?)\\1','i');
  return tag.match(re)?.[2]||'';
}
function mappedUrl(src,page){
  if(!src||src==='#'||src.startsWith('data:')||src.startsWith('blob:'))return null;
  try{
    const target=new URL(src,origin+page);
    if(target.origin!==origin)return null;
    return target;
  }catch{return null;}
}
function fileFor(path){
  if(path.endsWith('/'))path+='index.html';
  const target=resolve(dist,'.'+decodeURIComponent(path));
  if(!target.startsWith(dist+sep))throw new Error('Unsafe local reference');
  return target;
}
async function exists(path){
  if(checks.has(path))return checks.get(path);
  let valid=false;
  try{valid=(await stat(fileFor(path))).isFile();}catch{}
  checks.set(path,valid);
  return valid;
}
for(const page of paths){
  const file=fileFor(page);
  let html;
  try{html=await readFile(file,'utf8');}
  catch{errors.push({page,kind:'sitemap',target:page,problem:'Missing sitemap document'});continue;}
  const ids=new Set([...html.matchAll(/\bid\s*=\s*(["'])([^"']+)\1/g)].map(m=>m[2]));
  for(const match of html.matchAll(/<(a|img|source|script|link|video)\b[^>]*>/gi)){
    const tag=match[0],kind=match[1].toLowerCase();
    const raw=kind==='a'||kind==='link'?value(tag,'href'):(value(tag,'src')||value(tag,'poster'));
    if(kind==='img'&&!/\balt\s*=/.test(tag))
      advisories.push({page,kind:'image-alt',target:raw||'',problem:'Image without alt attribute'});
    const attrRefs=raw?[raw]:[];
    const srcset=value(tag,'srcset');
    if(srcset)for(const part of srcset.split(',')){const first=part.trim().split(/\s+/)[0];if(first)attrRefs.push(first);}
    for(const ref of attrRefs){
      const url=mappedUrl(ref,page);
      if(!url)continue;
      // API routes and query-only booking endpoints run through FBM, not static files.
      if(url.pathname.startsWith('/api/'))continue;
      resourceCount++;
      const target=url.pathname;
      if(!await exists(target)){
        errors.push({page,kind,target,problem:'Missing same-origin destination / asset'});
        continue;
      }
      if(kind==='a'&&url.hash){
        anchorCount++;
        // Cross-page hash targets and client-injected section IDs are advisory,
        // avoiding false hard failures in the source-only scan.
        if(target===page&&!ids.has(decodeURIComponent(url.hash.slice(1)))){
          advisories.push({page,kind:'anchor',target:ref,problem:'Anchor not found in source HTML (may be runtime injected)'});
        }
      }
    }
  }
}
const results={
  pages:paths.length,
  references:resourceCount,
  uniqueTargets:checks.size,
  missing:errors.length,
  advisories:advisories.length,
  anchorsInspected:anchorCount,
  errors,advisories
};
await writeFile(join(output,'results.json'),JSON.stringify(results,null,2));
const report=[
  '# VOY PRO link and asset integrity',
  '',
  'Checks all 50 sitemap HTML documents against local built dist; external and API destinations are never requested.',
  '',
  '| Metric | Count |','| --- | ---: |',
  '| Sitemap pages | '+results.pages+' |',
  '| Same-origin references | '+resourceCount+' |',
  '| Distinct local targets | '+checks.size+' |',
  '| Missing targets | '+errors.length+' |',
  '| Advisories | '+advisories.length+' |','',
  '## Broken references',
  ...(errors.length?errors.map(e=>'- '+e.page+' — '+e.kind+' → '+e.target+' ('+e.problem+')'):['- None']),
  '',
  '## Advisory examples (first 35)',
  ...advisories.slice(0,35).map(a=>'- '+a.page+' — '+a.kind+' → '+a.target+' ('+a.problem+')'),
  '',
  'Cross-page anchors and dynamic anchors require real-browser verification; advisories do not block builds.'
].join('\n');
await writeFile(join(output,'report.md'),report);
console.log('Link and asset QA:',results.pages,'pages,',resourceCount,'references,',errors.length,'broken,',advisories.length,'advisories');
if(errors.length)process.exitCode=1;

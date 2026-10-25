// Offline SEO release-readiness audit, not an indexing or deployment action.
// This script reads built HTML and the local sitemap only; it never contacts
// search engines, DNS, Google Search Console, FBM, payments or customer data.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
const origin='https://voy-pro.com';
const root=resolve('dist'),out=resolve('visual-qa-output/seo-readiness');
await mkdir(out,{recursive:true});
const xml=await readFile('site/sitemap.xml','utf8');
const publicUrls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1].trim());
const pages=new Map(),issues=[],notes=[];
function flag(path,problem){issues.push({path,problem});}
function attributes(tag){
  const o={};
  for(const m of tag.matchAll(/([a-z][\w-]*)\s*=\s*(["'])(.*?)\2/gi))
    o[m[1].toLowerCase()]=m[3];
  return o;
}
function parseUrl(raw,path,kind){
  try{
    const x=new URL(raw);
    if(x.origin!==origin||x.protocol!=='https:'||x.search||x.hash)
      throw Error('not an absolute first-party URL without tracking parameters');
    return x.href;
  }catch{
    flag(path,kind+' invalid or non-canonical URL: '+String(raw).slice(0,150));
    return null;
  }
}
if(new Set(publicUrls).size!==publicUrls.length)
  flag('sitemap.xml','Duplicate sitemap URLs');
if(publicUrls.length<40)flag('sitemap.xml','Missing public URLs');
for(const raw of publicUrls){
  const canonicalUrl=parseUrl(raw,'sitemap.xml','sitemap loc');
  if(!canonicalUrl)continue;
  const path=new URL(canonicalUrl).pathname;
  const local=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!local.startsWith(root+sep)){flag(path,'Unsafe build path');continue;}
  let html;
  try{html=await readFile(local,'utf8');}
  catch{flag(path,'Sitemap route absent from built site');continue;}
  const lang=html.match(/<html\b[^>]*\blang\s*=\s*(["'])([^"']+)\1/i)?.[2]||'';
  const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>attributes(x[0]));
  const canonicals=links.filter(x=>(x.rel||'').split(/\s+/).includes('canonical'));
  if(canonicals.length!==1)flag(path,'Expected exactly one canonical link, found '+canonicals.length);
  const canonical=canonicals.length===1?parseUrl(canonicals[0].href,path,'canonical'):null;
  if(canonical&&canonical!==canonicalUrl)
    flag(path,'Canonical URL does not match its sitemap URL: '+canonical);
  const alternate=links.filter(x=>(x.rel||'').split(/\s+/).includes('alternate')&&x.hreflang);
  const langs=new Map();
  for(const a of alternate){
    const code=a.hreflang.toLowerCase();
    if(langs.has(code))flag(path,'Duplicate hreflang code '+code);
    const target=parseUrl(a.href,path,'hreflang '+code);
    if(target)langs.set(code,target);
  }
  pages.set(canonicalUrl,{path,lang,canonical,alternate:langs});
}
for(const [url,page] of pages){
  const {path,lang,alternate}=page;
  const self=alternate.get(lang.toLowerCase());
  if(alternate.size&&self!==url)
    flag(path,'Has hreflang alternates but missing its own '+lang+' self-reference');
  for(const [code,target] of alternate){
    const dest=pages.get(target);
    if(!dest){
      flag(path,'hreflang '+code+' points outside sitemap: '+target);
      continue;
    }
    if(code!=='x-default'&&dest.lang.toLowerCase()!==code)
      flag(path,'hreflang '+code+' target has document language '+dest.lang);
    if(code!=='x-default'&&dest.alternate.get(lang.toLowerCase())!==url)
      flag(path,'hreflang '+code+' target does not link reciprocally to '+lang+' page');
  }
  if(!alternate.size&&lang&&path!=='/')
    notes.push(path+': no hreflang cluster (may be intentional for language-specific content)');
}
const report=[
  '# VOY PRO SEO canonical and language-link readiness','',
  'This is a local preflight. The live site MUST remain noindex until an approved launch.','',
  '| Check | Value |','| --- | ---: |',
  '| Sitemap URLs | '+publicUrls.length+' |',
  '| Readable built pages | '+pages.size+' |',
  '| Pages with hreflang clusters | '+[...pages.values()].filter(x=>x.alternate.size).length+' |',
  '| Canonical / hreflang errors | '+issues.length+' |',
  '| Optional follow-ups | '+notes.length+' |','',
  '## Errors',
  ...(issues.length?issues.map(i=>'- '+i.path+': '+i.problem):['- None']),
  '',
  '## Intentional coverage observations (first 30)',
  ...notes.slice(0,30).map(x=>'- '+x),
  '',
  'No crawler, search console, sitemap submission, DNS change, robots.txt or production activation is performed.',''
];
await writeFile(join(out,'report.md'),report.join('\n'));
await writeFile(join(out,'results.json'),JSON.stringify({pages:pages.size,urls:publicUrls.length,issues,notes},null,2));
console.log('SEO preflight: '+pages.size+'/'+publicUrls.length+
  ' built pages; '+issues.length+' canonical/hreflang errors; '+notes.length+' intentional candidates');
if(issues.length)process.exitCode=1;

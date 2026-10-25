// Read-only audit of the actual PUBLIC aliases of the Staging website.
// This never changes DNS, aliases, indexing, bookings, or payment settings.
// The static noindex build guard alone cannot prove that Vercel serves headers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const PROBES=[
  ['https://voy-pro.com/','Homepage'],
  ['https://voy-pro.com/budapest/','Budapest'],
  ['https://voy-pro.com/he/budapest/','Budapest Hebrew'],
  ['https://voy-pro.com/portugal/','Marvão English'],
  ['https://voy-pro.com/pt/portugal/','Marvão Portuguese'],
  ['https://voy-pro.com/ezraider/','EZRaider vehicle'],
  ['https://voy-pro.com/pt/ezraider/','EZRaider Portuguese'],
  ['https://voy-pro.com/manage/','Private booking management'],
  ['https://www.voy-pro.com/','www public alias'],
  ['https://voy-pro.com/robots.txt','Robots instructions'],
];
const ALLOWED=new Set(['voy-pro.com','www.voy-pro.com']);

function checkedUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||!ALLOWED.has(url.hostname)||
     url.username||url.password||url.port||url.search||url.hash)
    throw Error('Refusing non-public or unexpected redirect target');
  return url;
}
// Derive the protected public page set from the checked-in canonical sitemap.
// The sitemap is untrusted input: fail the audit before ANY network request if
// it tries to introduce another host, unexpected paths, duplicate URLs, or
// a suddenly truncated/expanded set of pages.
export function sitemapProbes(xml=fs.readFileSync('site/sitemap.xml','utf8')){
  if(typeof xml!=='string'||!/^\s*<\?xml\s/.test(xml)||
     !/<urlset\b[^>]*>[\s\S]*<\/urlset>\s*$/.test(xml))
    throw Error('Invalid canonical sitemap document');
  const urls=[...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m=>m[1]);
  if(urls.length<40||urls.length>80)throw Error('Unexpected canonical sitemap URL count');
  const seen=new Set();
  return urls.map((entry,index)=>{
    const parsed=checkedUrl(entry);
    if(parsed.origin!=='https://voy-pro.com'||
       !/^\/(?:[a-z0-9-]+\/)*$/.test(parsed.pathname)||
       parsed.href!==entry||seen.has(parsed.href))
      throw Error('Unapproved, malformed or repeated sitemap URL at index '+index);
    seen.add(parsed.href);
    return [parsed.href,'Canonical sitemap page '+(index+1)];
  });
}
export const CANONICAL_PAGES=sitemapProbes();
export const LIVE_PROBES=[...PROBES,...CANONICAL_PAGES.filter(([url])=>
  !PROBES.some(([existing])=>existing===url))];

const hasDirective=(header,directive)=>
  String(header||'').split(',').some(part=>part.trim().toLowerCase()===directive);

async function fetchPublic(url,fetcher){
  let current=checkedUrl(url);
  const seen=new Set();
  for(let redirects=0;redirects<=4;redirects++){
    if(seen.has(current.href))throw Error('Redirect loop');
    seen.add(current.href);
    const response=await fetcher(current.href,{
      method:'GET',credentials:'omit',redirect:'manual',
      headers:{'accept':'text/html, text/plain;q=0.8'},
      signal:AbortSignal.timeout(12000),
    });
    if([301,302,303,307,308].includes(response.status)){
      const redirect=response.headers.get('location');
      await response.body?.cancel();
      if(!redirect)throw Error('Redirect without Location');
      current=checkedUrl(new URL(redirect,current));
      continue;
    }
    if(response.status!==200){
      await response.body?.cancel();
      throw Error('HTTP '+response.status);
    }
    const robotHeader=response.headers.get('x-robots-tag')||'';
    const content=current.pathname==='/robots.txt'?await response.text():'';
    if(!content)await response.body?.cancel();
    return {url:current.href,header:robotHeader,robots:content};
  }
  throw Error('Too many redirects');
}

export async function audit(fetcher=fetch,probes=LIVE_PROBES){
  if(!Array.isArray(probes)||probes.length>90)
    throw Error('Refusing oversized live HTTP audit');
  const rows=[];
  // Bounded six-way GET concurrency keeps the daily Staging watch well below
  // its CI time budget, without hammering the public site or its booking API.
  for(let offset=0;offset<probes.length;offset+=6){
    const batch=await Promise.all(probes.slice(offset,offset+6).map(async([uri,label])=>{
      try{
        const r=await fetchPublic(uri,fetcher);
        const noindex=hasDirective(r.header,'noindex');
        const nofollow=hasDirective(r.header,'nofollow');
        const robots=r.url.endsWith('/robots.txt')?
          /^Disallow:\s*\/\s*$/im.test(r.robots):true;
        // A misrouted page returning the homepage must not pass indexing QA.
        const requestedPath=checkedUrl(uri).pathname;
        const finalPath=checkedUrl(r.url).pathname;
        const samePath=requestedPath===finalPath;
        const ok=noindex&&nofollow&&robots&&samePath;
        return {label,url:uri,final:r.url,header:r.header,ok,
          reason:ok?'HTTP 200, noindex, nofollow'+(r.robots?', robots blocked':''):
            'Missing crawler controls or public route redirected to a different path'};
      }catch(error){
        return {label,url:uri,ok:false,reason:String(error?.message||error).slice(0,220)};
      }
    }));
    rows.push(...batch);
  }
  return {rows,passed:rows.filter(row=>row.ok).length,failed:rows.filter(row=>!row.ok).length};
}
export function report(result){
  return [
    '# VOY PRO — live Staging HTTP indexing audit',
    '',
    '**Checked:** '+new Date().toISOString()+' (UTC). Read-only GET of public URLs; no customer data, cookies, credentials or upstream booking API calls.',
    '',
    '**Result:** '+result.passed+'/'+result.rows.length+' passed; '+result.failed+' failed.',
    '**Canonical coverage:** '+CANONICAL_PAGES.length+' sitemap pages plus required public alias, private management, and robots guards. Each sitemap entry is validated against the approved public origin before network access.',
    '',
    '| Public URL | Result | HTTP evidence |',
    '| --- | --- | --- |',
    ...result.rows.map(row=>'| '+row.url+' | '+(row.ok?'PASS':'FAIL')+' | '+
      row.reason.replace(/\|/g,'/').replace(/\n/g,' ')+' |'),
    '',
    '**Scope:** this proves observed headers only at the time of this check. It does not approve public Production, enable search indexing, or assert that every search engine has de-indexed previously discovered URLs.',
    '**Important:** robots.txt Disallow can prevent crawlers from observing a page-level noindex directive. Independent Production/SEO cutover remains owner-gated.',
    ''
  ].join('\n');
}

async function test(){
  const good='noindex, nofollow';
  // Each mock HTTP call gets a fresh body. Cloning a streamed Response
  // and then awaiting cancellation of only one tee branch can hang Node.
  const make=(header=good,body='OK')=>()=>new Response(body,{
    status:200,headers:{'x-robots-tag':header}
  });
  const fixtures=new Map([
    ['https://voy-pro.com/',make()],
    ['https://voy-pro.com/budapest/',make()],
    ['https://voy-pro.com/robots.txt',make(good,'User-agent: *\nDisallow: /\n')],
    ['https://www.voy-pro.com/',()=>new Response(null,{status:308,headers:{location:'https://voy-pro.com/'}})]
  ]);
  const fetchMock=async url=>{
    if(!fixtures.has(url))throw Error('Unexpected test URL');
    return fixtures.get(url)();
  };
  const small=[
    ['https://voy-pro.com/','Home'],['https://voy-pro.com/budapest/','Budapest'],
    ['https://www.voy-pro.com/','www alias'],['https://voy-pro.com/robots.txt','Robots']
  ];
  assert.equal(CANONICAL_PAGES.length,50,'Current public sitemap contains 50 pages');
  assert.equal(LIVE_PROBES.filter(([url])=>url==='https://voy-pro.com/').length,1,
    'No duplicate homepage requests');
  assert.throws(()=>sitemapProbes('<?xml version="1.0"?><urlset><url><loc>https://evil.example/</loc></url></urlset>'),
    'Unexpected sitemap host or truncated page count fails closed');
  const sample='<urlset>'+Array.from({length:50},(_,i)=>
    '<url><loc>https://voy-pro.com/page-'+i+'/</loc></url>').join('')+'</urlset>';
  const validSample='<?xml version="1.0"?>'+sample;
  assert.equal(sitemapProbes(validSample).length,50);
  assert.throws(()=>sitemapProbes(validSample.replace('https://voy-pro.com/page-1/',
    'https://evil.example/page-1/')),'Sitemap cannot introduce off-host requests');
  assert.throws(()=>sitemapProbes(validSample.replace('https://voy-pro.com/page-1/',
    'https://voy-pro.com/page-0/')),'Sitemap cannot reuse an existing URL');
  assert.throws(()=>sitemapProbes(validSample.replace('https://voy-pro.com/page-1/',
    'https://voy-pro.com/page-1/?token=secret')),'Sitemap cannot add query strings');
  assert.throws(()=>sitemapProbes(validSample.replace('https://voy-pro.com/page-1/',
    'https://voy-pro.com/page-1/#booking')),'Sitemap cannot add fragments');
  const pass=await audit(fetchMock,small);
  assert.equal(pass.failed,0,report(pass));
  assert.equal(pass.passed,4);
  assert.ok(report(pass).includes('4/4 passed'));
  fixtures.set('https://voy-pro.com/budapest/',make('nofollow'));
  const missingIndex=await audit(fetchMock,small);
  assert.equal(missingIndex.failed,1,'A missing live noindex header must fail closed');
  fixtures.set('https://voy-pro.com/budapest/',make('noindex'));
  assert.equal((await audit(fetchMock,small)).failed,1,'A missing nofollow must fail');
  fixtures.set('https://voy-pro.com/budapest/',make());
  fixtures.set('https://voy-pro.com/robots.txt',make(good,'User-agent: *\nAllow: /\n'));
  assert.equal((await audit(fetchMock,small)).failed,1,'Staging robots block is required');
  fixtures.set('https://voy-pro.com/robots.txt',make(good,'User-agent: *\nDisallow: /\n'));
  fixtures.set('https://www.voy-pro.com/',()=>new Response(null,{status:308,headers:{location:'https://malicious.example/'}}));
  const badHost=await audit(fetchMock,small);
  assert.equal(badHost.failed,1,'Never follow redirects to unapproved external hosts');
  assert.ok(badHost.rows[2].reason.includes('unexpected redirect target'));
  fixtures.set('https://www.voy-pro.com/',()=>new Response(null,{status:308,headers:{location:'http://voy-pro.com/'}}));
  assert.equal((await audit(fetchMock,small)).failed,1,'HTTP downgrade must fail');
  fixtures.set('https://www.voy-pro.com/',()=>new Response(null,{status:308,headers:{location:'https://voy-pro.com/'}}));
  fixtures.set('https://voy-pro.com/budapest/',()=>new Response('Nope',{status:404}));
  assert.equal((await audit(fetchMock,small)).failed,1,'Missing public page must fail');
  fixtures.set('https://voy-pro.com/budapest/',()=>new Response(null,{status:308,
    headers:{location:'https://voy-pro.com/'}}));
  assert.equal((await audit(fetchMock,small)).failed,1,'Redirect to the homepage cannot hide a missing route');
  assert.throws(()=>checkedUrl('https://voy-pro.com/?token=secret'),'Queries are not an audit target');
  console.log('Live Staging HTTP audit unit tests pass: redirects, public allowlist, headers, robots, missing pages.');
}

const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
  if(process.argv.includes('--test'))await test();
  else{
    const results=await audit();
    const markdown=report(results);
    fs.mkdirSync('staging-http-audit',{recursive:true});
    fs.writeFileSync('staging-http-audit/report.md',markdown);
    process.stdout.write(markdown+'\n');
    if(results.failed)process.exitCode=1;
  }
}

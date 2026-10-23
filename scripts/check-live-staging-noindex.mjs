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

export async function audit(fetcher=fetch,probes=PROBES){
  const rows=[];
  for(const [uri,label] of probes){
    try{
      const r=await fetchPublic(uri,fetcher);
      const noindex=hasDirective(r.header,'noindex');
      const nofollow=hasDirective(r.header,'nofollow');
      const robots=r.url.endsWith('/robots.txt')?
        /^Disallow:\s*\/\s*$/im.test(r.robots):true;
      const ok=noindex&&nofollow&&robots;
      rows.push({label,url:uri,final:r.url,header:r.header,
        ok,reason:ok?'HTTP 200, noindex, nofollow'+(r.robots?', robots blocked':''):
          'Missing noindex/nofollow HTTP header or staging robots.txt Disallow: /'});
    }catch(error){
      rows.push({label,url:uri,ok:false,reason:String(error?.message||error).slice(0,220)});
    }
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
  const make=(header=good,body='OK')=>new Response(body,{
    status:200,headers:{'x-robots-tag':header}
  });
  const fixtures=new Map([
    ['https://voy-pro.com/',make()],
    ['https://voy-pro.com/budapest/',make()],
    ['https://voy-pro.com/robots.txt',make(good,'User-agent: *\nDisallow: /\n')],
    ['https://www.voy-pro.com/',new Response(null,{status:308,headers:{location:'https://voy-pro.com/'}})]
  ]);
  const fetchMock=async url=>{
    if(!fixtures.has(url))throw Error('Unexpected test URL');
    return fixtures.get(url).clone();
  };
  const small=[
    ['https://voy-pro.com/','Home'],['https://voy-pro.com/budapest/','Budapest'],
    ['https://www.voy-pro.com/','www alias'],['https://voy-pro.com/robots.txt','Robots']
  ];
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
  fixtures.set('https://www.voy-pro.com/',new Response(null,{status:308,headers:{location:'https://malicious.example/'}}));
  const badHost=await audit(fetchMock,small);
  assert.equal(badHost.failed,1,'Never follow redirects to unapproved external hosts');
  assert.ok(badHost.rows[2].reason.includes('unexpected redirect target'));
  fixtures.set('https://www.voy-pro.com/',new Response(null,{status:308,headers:{location:'http://voy-pro.com/'}}));
  assert.equal((await audit(fetchMock,small)).failed,1,'HTTP downgrade must fail');
  fixtures.set('https://www.voy-pro.com/',new Response(null,{status:308,headers:{location:'https://voy-pro.com/'}}));
  fixtures.set('https://voy-pro.com/budapest/',new Response('Nope',{status:404}));
  assert.equal((await audit(fetchMock,small)).failed,1,'Missing public page must fail');
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

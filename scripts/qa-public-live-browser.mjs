// Read-only real-browser QA of the public VOY PRO staging aliases.
// Only GET documents on an explicit path allowlist and first-party /assets/.
// Never contact FBM, payments, analytics, WhatsApp, maps or booking APIs.
// This is NOT a Production release or an SEO-indexing approval.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

const ORIGIN='https://voy-pro.com';
const HOSTS=new Set(['voy-pro.com','www.voy-pro.com']);
const OUTPUT=resolve('visual-qa-output/public-live');
const xml=await readFile('site/sitemap.xml','utf8');
const urls=[...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match=>match[1]);
assert.ok(urls.length>=40&&urls.length<=80,'Unexpected sitemap URL count');
const sitemapPaths=urls.map(raw=>{
  const parsed=new URL(raw);
  assert.equal(parsed.origin,ORIGIN,'Unexpected external sitemap origin');
  assert.ok(/^\/(?:[a-z0-9-]+\/)*$/.test(parsed.pathname),'Unsafe sitemap path');
  assert.equal(parsed.href,raw,'Unexpected sitemap URL fields');
  return parsed.pathname;
});
assert.equal(new Set(sitemapPaths).size,sitemapPaths.length,'Duplicate sitemap URLs');
const extraPaths=['/manage/'];
const allPaths=new Set([...sitemapPaths,...extraPaths]);
const highlights=[
  '/', '/budapest/', '/he/budapest/', '/hu/budapest/',
  '/portugal/', '/pt/portugal/', '/ezraider/',
  '/budapest/tours/buda-castle-ezraider-tour/', '/manage/'
];
assert.ok(highlights.every(path=>allPaths.has(path)),'Missing approved highlight path');
const targets=[
  ...sitemapPaths.map(path=>({path,width:390,height:844})),
  ...highlights.map(path=>({path,width:320,height:700})),
  ...highlights.map(path=>({path,width:1440,height:900})),
  {path:'/',width:1440,height:900,alias:true}
];
const browser=await chromium.launch({
  headless:true,
  ...(process.env.CI?{channel:'chrome'}:{})
});
await mkdir(OUTPUT,{recursive:true});
const rows=[],failures=[];
let blockedRequests=0,assetFailures=0;

function safeURL(raw){
  try{
    const url=new URL(raw);
    return url.protocol==='https:'&&HOSTS.has(url.hostname)&&
      !url.username&&!url.password&&!url.port;
  }catch{return false;}
}
function allowedRequest(request){
  if(request.method()!=='GET'||!safeURL(request.url()))return false;
  const url=new URL(request.url());
  if(request.resourceType()==='document'){
    return !url.search&&!url.hash&&allPaths.has(url.pathname);
  }
  return url.pathname.startsWith('/assets/')&&
    /^(image|font|stylesheet|script|other)$/.test(request.resourceType());
}
function diagnostic(error){
  return String(error?.message||error).slice(0,220).replace(/[\r\n|]/g,' ');
}
function slug(path){
  return (path==='/'?'home':path.replace(/^\/|\/$/g,'').replace(/\//g,'-')).slice(0,95);
}
const contexts=new Map();
async function context(width,height){
  const id=width+'x'+height;
  if(!contexts.has(id)){
    const ctx=await browser.newContext({
      viewport:{width,height},
      deviceScaleFactor:1,
      reducedMotion:'reduce',
      serviceWorkers:'block',
      acceptDownloads:false,
      javaScriptEnabled:true
    });
    await ctx.route('**/*',async route=>{
      if(allowedRequest(route.request()))return route.continue();
      blockedRequests++;
      return route.abort('blockedbyclient');
    });
    contexts.set(id,ctx);
  }
  return contexts.get(id);
}
async function inspect(target){
  const url=(target.alias?'https://www.voy-pro.com':ORIGIN)+target.path;
  const name=target.path+' @ '+target.width+(target.alias?' www':'');
  const page=await (await context(target.width,target.height)).newPage();
  const row={name,url,ok:false,status:null,finalUrl:null,
    heading:'',horizontalOverflow:0,sectionsGapPx:null,
    pageErrors:[],assetErrors:[],issues:[],advisories:[],
    screenshot:null};
  page.on('pageerror',error=>{
    if(row.pageErrors.length<4)row.pageErrors.push(diagnostic(error));
  });
  page.on('response',response=>{
    if(response.request().resourceType()==='document')return;
    const uri=response.url();
    if(safeURL(uri)&&new URL(uri).pathname.startsWith('/assets/')&&response.status()>=400){
      assetFailures++;
      if(row.assetErrors.length<6)row.assetErrors.push(response.status()+' '+new URL(uri).pathname);
    }
  });
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});
    row.status=response?.status()||null;
    row.finalUrl=page.url();
    if(row.status!==200)row.issues.push('HTTP status '+row.status);
    const final=new URL(page.url());
    if(!safeURL(page.url())||final.pathname!==target.path)
      row.issues.push('Unexpected redirect or final page path');
    if(!String(response?.headers()['content-type']||'').toLowerCase().includes('text/html'))
      row.issues.push('Missing HTML content type');
    const robots=String(response?.headers()['x-robots-tag']||'').toLowerCase();
    if(!robots.split(',').some(value=>value.trim()==='noindex'))
      row.issues.push('Missing staging noindex HTTP header');
    await page.waitForTimeout(250);
    const metrics=await page.evaluate(()=>{
      const root=document.documentElement,body=document.body;
      const heading=document.querySelector('h1');
      const rect=heading?.getBoundingClientRect();
      const sections=[...document.querySelectorAll('main section')].
        map(el=>el.getBoundingClientRect()).filter(r=>r.height>0&&r.width>0);
      let maxGap=0;
      for(let i=1;i<sections.length;i++)
        maxGap=Math.max(maxGap,Math.round(sections[i].top-sections[i-1].bottom));
      const brokenVisibleImages=[...document.images].filter(img=>{
        const r=img.getBoundingClientRect();
        return r.width>0&&r.height>0&&r.top<innerHeight&&
          img.complete&&img.naturalWidth===0;
      }).length;
      return {
        heading:heading?.textContent?.trim()||'',
        headingVisible:!!rect&&rect.width>0&&rect.height>0,
        mainCount:document.querySelectorAll('main').length,
        footerCount:document.querySelectorAll('footer').length,
        width:innerWidth,
        overflow:Math.max(root.scrollWidth,body.scrollWidth)-innerWidth,
        direction:getComputedStyle(root).direction,
        maxGap,brokenVisibleImages
      };
    });
    row.heading=metrics.heading.slice(0,120);
    row.horizontalOverflow=Math.max(0,metrics.overflow);
    row.sectionsGapPx=metrics.maxGap;
    if(!metrics.headingVisible||!metrics.heading)row.issues.push('Missing visible H1');
    if(metrics.mainCount!==1)row.issues.push('Expected one main landmark');
    if(metrics.footerCount!==1)row.issues.push('Expected one footer');
    if(metrics.overflow>2)row.issues.push('Horizontal overflow '+metrics.overflow+'px');
    if(target.path.startsWith('/he/')&&metrics.direction!=='rtl')
      row.issues.push('Hebrew page lost RTL direction');
    if(metrics.maxGap>260)row.advisories.push('Unusually wide section gap '+metrics.maxGap+'px');
    if(metrics.brokenVisibleImages)row.advisories.push('Visible broken images '+metrics.brokenVisibleImages);
    if(row.assetErrors.length)row.issues.push('First-party asset HTTP errors');
    if(row.pageErrors.length)row.advisories.push('Browser JS errors: '+row.pageErrors.join(' / '));
    const isHighlight=highlights.includes(target.path)||target.alias;
    if(isHighlight){
      const namePart=slug(target.path)+'-'+target.width+(target.alias?'-www':'')+'.png';
      await page.screenshot({path:join(OUTPUT,namePart),fullPage:true,animations:'disabled',timeout:12000});
      row.screenshot=namePart;
    }
    // Test one genuine on-site click. No checkout, form submission or external link.
    if(target.path==='/'&&target.width===390&&!target.alias){
      const link=page.locator('.parent-hero-destination[href="/budapest/"]').first();
      if(await link.count()){
        await link.click({timeout:5000});
        if(new URL(page.url()).pathname!=='/budapest/')
          row.issues.push('Budapest hero link navigated to unexpected path');
      }else row.issues.push('Budapest hero navigation link is missing');
    }
    row.ok=row.issues.length===0;
  }catch(error){
    row.issues.push('Browser navigation or screenshot failed: '+diagnostic(error));
  }finally{
    await page.close().catch(()=>{});
  }
  if(!row.ok)failures.push(name+': '+row.issues.join('; '));
  rows.push(row);
  console.log((row.ok?'PASS ':'FAIL ')+name+
    (row.issues.length?' — '+row.issues.join('; '):''));
}
try{
  for(const target of targets)await inspect(target);
}finally{
  for(const ctx of contexts.values())await ctx.close().catch(()=>{});
  await browser.close();
}
const summary={
  checked:new Date().toISOString(),
  mode:'public read-only staging browser QA; no live booking, FBM, payment or third-party requests',
  sitemapPages:sitemapPaths.length,
  totalViews:rows.length,
  passed:rows.filter(row=>row.ok).length,
  failed:failures.length,blockedRequests,assetFailures,
  rows
};
await writeFile(join(OUTPUT,'results.json'),JSON.stringify(summary,null,2));
const markdown=[
  '# VOY PRO — public alias live browser QA',
  '',
  '**Time:** '+summary.checked,
  '**Coverage:** '+summary.totalViews+' views; '+summary.sitemapPages+' canonical pages, 390px mobile plus highlight 320px and 1440px; one www alias and one safe destination click.',
  '**Passed:** '+summary.passed+'/'+summary.totalViews,
  '**Blocked requests:** '+blockedRequests+' (external services, all writes, and non-allowlisted paths intentionally denied).',
  '**First-party asset HTTP failures:** '+assetFailures,
  '',
  '## Failed checks',
  ...(failures.length?failures.map(f=>'- '+f):['- None']),
  '',
  '## Visual advisories',
  ...rows.filter(r=>r.advisories.length).slice(0,45).
    map(r=>'- '+r.name+': '+r.advisories.join('; ')),
  '',
  '## Artifacts',
  'Selected highlight screenshots are included in this artifact folder, as is results.json.',
  '',
  '## Limitations',
  'This is an anonymous read-only browser snapshot, not proof that maps, Stripe, FBM availability or authenticated customer journeys work. Third-party scripts and APIs are deliberately blocked.',
  'No production cutover, DNS, booking, payment, or search-indexing change is authorized by a passing test.',
  ''
].join('\n');
await writeFile(join(OUTPUT,'report.md'),markdown);
if(failures.length)process.exitCode=1;

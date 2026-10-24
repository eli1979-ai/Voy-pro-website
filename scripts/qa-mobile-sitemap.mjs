// Comprehensive, no-cost 320px + 390px mobile layout check for every sitemap URL.
// Uses built static dist, local assets and mocked/offline external services only.
// This suite NEVER calls FBM, Stripe, Google APIs or any real customer backend.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,stat,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('dist');
const out=resolve('visual-qa-output/mobile-sitewide');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
  '.woff2':'font/woff2','.woff':'font/woff'};
const source=await readFile('site/sitemap.xml','utf8');
const urls=[...source.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>new URL(match[1]));
assert.ok(urls.length>=40,'Sitemap should contain the full multilingual public site');
assert.equal(new Set(urls.map(u=>u.pathname)).size,urls.length,'Duplicate sitemap paths');
assert.ok(urls.every(url=>url.origin==='https://voy-pro.com'),'Unexpected sitemap host');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const path=decodeURIComponent(url.pathname);
    const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
    if(!file.startsWith(root+sep)||(await stat(file)).isDirectory())throw Error('Not a file');
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
const rows=[];
const widths=[320,390];
const namedScreens=new Set(['/', '/budapest/', '/portugal/', '/ezraider/']);
let screenshots=0;
const errors=[];

async function makePage(width){
  const page=await browser.newPage({viewport:{width,height:790},deviceScaleFactor:1,reducedMotion:'reduce'});
  // All external network calls are blocked. Media served from our own dist is safe.
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin)return route.continue();
    if(['voy-pro.com','www.voy-pro.com'].includes(url.hostname)&&
       url.protocol==='https:'&&url.pathname.startsWith('/assets/')){
      try{
        const response=await fetch(origin+url.pathname+url.search);
        const body=Buffer.from(await response.arrayBuffer());
        return route.fulfill({status:response.status,body,
          contentType:response.headers.get('content-type')||'application/octet-stream'});
      }catch{return route.abort();}
    }
    return route.abort();
  });
  return page;
}
try{
  for(const width of widths){
    const page=await makePage(width);
    try{
      for(const [index,url] of urls.entries()){
        const pathname=url.pathname;
        let status=0,metrics=null,issue='';
        try{
          const response=await page.goto(origin+pathname,{waitUntil:'domcontentloaded',timeout:15000});
          status=response?.status()||0;
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForTimeout(80);
          // Test actual visible content, not a cookie overlay.
          const consent=page.locator('[data-consent-essential]');
          if(await consent.isVisible().catch(()=>false))await consent.click({timeout:1000}).catch(()=>{});
          metrics=await page.evaluate(()=>{
            const root=document.documentElement;
            const body=document.body;
            const heading=document.querySelector('h1');
            const header=document.querySelector('header');
            const footer=document.querySelector('footer');
            const menu=document.querySelector('.nav-menu-toggle');
            const h=heading?.getBoundingClientRect();
            const m=menu?.getBoundingClientRect();
            const hb=header?.getBoundingClientRect();
            const vw=innerWidth;
            const sectionGaps=[];
            const sections=[...document.querySelectorAll('main > section, main > .section')];
            for(let j=1;j<sections.length;j++){
              const prev=sections[j-1].getBoundingClientRect();
              const next=sections[j].getBoundingClientRect();
              const gap=Math.round(next.top-prev.bottom);
              if(gap>110)sectionGaps.push(gap);
            }
            return {
              width:vw,scrollWidth:root.scrollWidth,bodyWidth:body.scrollWidth,
              h1:heading?.textContent.trim()||'',
              h1Position:h?{left:Math.round(h.left),right:Math.round(h.right),width:Math.round(h.width)}:null,
              headerExists:!!header,footerExists:!!footer,
              headerHorizontal:hb?{left:Math.round(hb.left),right:Math.round(hb.right)}:null,
              menu:menu&&getComputedStyle(menu).display!=='none'?{left:Math.round(m.left),right:Math.round(m.right),height:Math.round(m.height)}:null,
              overflowCandidates:root.scrollWidth>vw+2?[...body.querySelectorAll('*')].filter(el=>{
                const style=getComputedStyle(el);
                if(style.display==='none'||style.visibility==='hidden')return false;
                const rect=el.getBoundingClientRect();
                return rect.width>0&&(rect.left< -2||rect.right>vw+2);
              }).slice(0,12).map(el=>{
                const r=el.getBoundingClientRect();
                return {tag:el.tagName.toLowerCase(),className:String(el.className||'').slice(0,75),
                  left:Math.round(r.left),right:Math.round(r.right),text:(el.textContent||'').trim().slice(0,35)};
              }):[],
              gaps:sectionGaps.slice(0,5)
            };
          });
          const issues=[];
          if(status!==200)issues.push('HTTP '+status);
          if(!metrics.headerExists||!metrics.footerExists||!metrics.h1)issues.push('Missing header/footer/H1');
          if(metrics.scrollWidth>width+2||metrics.bodyWidth>width+2)
            issues.push('Horizontal overflow '+metrics.scrollWidth+'/'+metrics.bodyWidth+'/'+width);
          if(metrics.h1Position&&(metrics.h1Position.left< -2||metrics.h1Position.right>width+2))
            issues.push('H1 clipped horizontally');
          if(metrics.menu&&(metrics.menu.left< -2||metrics.menu.right>width+2||metrics.menu.height<44))
            issues.push('Mobile menu clipped or too small');
          if(metrics.headerHorizontal&&(metrics.headerHorizontal.left< -2||metrics.headerHorizontal.right>width+2))
            issues.push('Header outside viewport');
          issue=issues.join('; ');
          if(issue&&screenshots<10){
            const name='failure-'+String(screenshots+1).padStart(2,'0')+'-'+width+'.png';
            await page.screenshot({path:join(out,name),fullPage:false}).catch(()=>{});
            screenshots++;
          }
          if(!issue&&width===390&&namedScreens.has(pathname)){
            await page.screenshot({path:join(out,'sample-'+(pathname==='/'?'home':pathname.split('/')[1])+'.png'),fullPage:false}).catch(()=>{});
          }
        }catch(e){issue='Page evaluation failed: '+String(e).slice(0,180);}
        const row={path:pathname,width,http:status,issue,...metrics};
        rows.push(row);
        if(issue)errors.push({path:pathname,width,reason:issue});
        // Reuse one page per width so network and font caching remain cheap.
        if(index%20===0)process.stdout.write('Checked '+(index+1)+'/'+urls.length+' at '+width+'px\n');
      }
    }finally{await page.close();}
  }
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
const summary=[
  '# VOY PRO — full multilingual mobile layout sweep',
  '',
  '**Mode:** local built website, Playwright Chrome, no external services or real bookings',
  '',
  'Pages: '+urls.length+'; viewport widths: '+widths.join(', ')+' px; scenarios: '+rows.length,
  '',
  'Failed: '+errors.length,
  '',
  '| Width | Path | Result | Max section gap (>110px, advisory) |',
  '| ---: | --- | --- | --- |',
  ...rows.map(r=>'| '+r.width+' | `'+r.path+'` | '+(r.issue||'PASS')+' | '+(r.gaps?.join(', ')||'—')+' |'),
  '',
  '## Failures',
  ...(errors.length?errors.map(e=>'- '+e.width+'px '+e.path+': '+e.reason):['- None']),
  '',
  'Large section gaps are advisory only; design choices are not automatically failures.',
  'All sample and failure images are saved in this artifact for human inspection.',
  ''
].join('\n');
await writeFile(join(out,'report.md'),summary);
await writeFile(join(out,'results.json'),JSON.stringify({pages:urls.length,widths,errors,rows},null,2));
process.stdout.write('Mobile sweep: '+rows.length+' page-width cases, '+errors.length+' failures\n');
if(errors.length)process.exitCode=1;

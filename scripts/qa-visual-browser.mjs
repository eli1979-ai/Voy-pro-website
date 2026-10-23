// Real Chromium layout/navigation smoke test against the *built local dist*.
// This never talks to the FBM backend, external analytics, or live websites.
// Screenshots + browser assertions complement (not replace) human design QA.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, stat} from 'node:fs/promises';
import {resolve, sep, extname, join} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('dist');
const out=resolve('visual-qa-output');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
  '.woff2':'font/woff2','.woff':'font/woff'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    let path=decodeURIComponent(url.pathname);
    if(path.endsWith('/'))path+='index.html';
    const full=resolve(root,'.'+path);
    if(!full.startsWith(root+sep))throw Error('Outside build directory');
    if(!(await stat(full)).isFile())throw Error('Not a file');
    const data=await readFile(full);
    res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
await mkdir(out,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const results=[];
let failures=0;
function check(condition,label){
  if(!condition){failures++;results.push('FAIL: '+label);}
  else results.push('PASS: '+label);
}
async function visit(name,path,viewport,{fullPage=false,guide=false}={}){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
  // Avoid contact with actual vendors, FBM, Google/Meta tracking, or YouTube.
  await page.route('**/*',route=>{
    try{
      if(new URL(route.request().url()).origin===base)return route.continue();
    }catch{}
    return route.abort();
  });
  try{
    const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:20000});
    check(response?.status()===200,name+' HTTP 200');
    await page.waitForTimeout(300);
    const metrics=await page.evaluate(()=>({
      width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth,
      heading:(document.querySelector('h1')?.textContent||'').trim(),
      hasNav:!!document.querySelector('.navlinks'),
      lang:document.documentElement.lang,
      ready:document.readyState
    }));
    check(metrics.heading.length>0,name+' visible semantic H1');
    check(metrics.scrollWidth<=metrics.width+2,name+' no horizontal page overflow ('+metrics.scrollWidth+'/'+metrics.width+')');
    check(metrics.hasNav,name+' has navigation');
    await page.screenshot({path:join(out,name+'.png'),fullPage,animations:'disabled',timeout:20000});
    results.push('SCREENSHOT: '+name+'.png | '+viewport.width+'x'+viewport.height+' | '+metrics.lang+' | '+metrics.heading.slice(0,70));
    if(viewport.width<=800){
      const menu=page.locator('.nav-menu-toggle');
      check(await menu.isVisible(),name+' mobile navigation control visible');
      if(await menu.isVisible()){
        await menu.click();
        check(await page.locator('#mobile-nav-sheet').isVisible(),name+' mobile sheet opens');
        check(await menu.getAttribute('aria-expanded')==='true',name+' menu reports expanded state');
        await page.keyboard.press('Escape');
        check(!(await page.locator('#mobile-nav-sheet').isVisible()),name+' Escape closes menu');
        check(await menu.getAttribute('aria-expanded')==='false',name+' menu resets aria-expanded');
      }
    }
    if(guide){
      check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').count()===1,name+' has source-aware return link');
      check(await page.locator('.ez-destination-chooser').count()===1,name+' has destination chooser');
    }
    return page;
  }catch(e){
    failures++;results.push('FAIL: '+name+' browser error '+(e.stack||String(e)).slice(0,600));
    await page.close();
    return null;
  }
}
try{
  const desktop={width:1365,height:900},mobile={width:390,height:844},narrow={width:320,height:700};
  const scenarios=[
    ['home-desktop','/',desktop,{fullPage:true}],
    ['home-mobile','/',mobile,{}],
    ['budapest-he-mobile','/he/budapest/',mobile,{fullPage:true}],
    ['budapest-hu-narrow','/hu/budapest/',narrow,{}],
    ['marvao-pt-mobile','/pt/portugal/',mobile,{fullPage:true}],
    ['marvao-en-desktop','/portugal/',desktop,{}],
    ['guide-pt-mobile','/pt/ezraider/?from=marvao-pt&return_to=%2Fpt%2Fportugal%2F',mobile,{fullPage:true,guide:true}],
    ['guide-he-mobile','/he/ezraider/?from=budapest&return_to=%2Fhe%2Fbudapest%2Ftours%2Fbuda-castle-ezraider-tour%2F',mobile,{guide:true}],
    ['guide-hu-desktop','/hu/ezraider/?from=budapest',desktop,{guide:true}]
  ];
  for(const [name,path,viewport,opts] of scenarios){
    const page=await visit(name,path,viewport,opts);
    if(!page)continue;
    try{
      if(name==='guide-pt-mobile'){
        const expected='/pt/portugal/';
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===expected,'PT Marvão guide back returns to PT branch');
        check(await page.locator('.ez-hero [data-ez-context="booking"]').getAttribute('href')==='/pt/portugal/#request','PT Marvão booking links to local availability');
        await page.locator('.nav-menu-toggle').click();
        const sheet=page.locator('#mobile-nav-sheet');
        check(await sheet.locator('[data-mobile-language-row] [data-ez-language]').count()===4,'PT guide mobile offers four language links');
        check(await sheet.locator('[data-ez-context="back"]').getAttribute('href')===expected,'PT guide mobile back returns locally');
        check((await sheet.locator('[data-mobile-nav-wa]').getAttribute('href')||'').startsWith('https://wa.me/351935695004'),'PT guide mobile WhatsApp uses Portugal');
        const heHref=await sheet.locator('[data-ez-language][hreflang="he"]').getAttribute('href');
        check(heHref?.includes('from=marvao-pt')&&heHref?.includes('return_to=%2Fpt%2Fportugal%2F'),'PT mobile language switch retains source + exact return');
        await sheet.locator('[data-ez-language][hreflang="he"]').click();
        await page.waitForURL(url=>url.pathname==='/he/ezraider/',{timeout:10000});
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===expected,'Switching PT to HE retains original PT return page');
      }
      if(name==='guide-he-mobile'){
        const original='/he/budapest/tours/buda-castle-ezraider-tour/';
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===original,'HE tour guide desktop back retains exact tour page');
        await page.locator('.nav-menu-toggle').click();
        check(await page.locator('#mobile-nav-sheet [data-ez-context="back"]').getAttribute('href')===original,'HE tour guide mobile back retains exact tour page');
        check(await page.locator('#mobile-nav-sheet [data-ez-context="booking"]').getAttribute('href')==='/he/budapest/#booking','HE mobile booking stays in Budapest');
      }
    }catch(e){failures++;results.push('FAIL: '+name+' interaction error '+(e.stack||String(e)).slice(0,900));}
    finally{await page.close();}
  }
}finally{
  await browser.close();await new Promise(done=>server.close(done));
  const report=['# VOY PRO browser visual smoke report','','Local Chromium + built static dist. External API, WhatsApp, video and analytics calls intentionally blocked.','','','- Total failed checks: '+failures,'','',...results,''].join('\n');
  await writeFile(join(out,'report.md'),report);
  process.stdout.write(report+'\n');
}
if(failures>0)process.exitCode=1;

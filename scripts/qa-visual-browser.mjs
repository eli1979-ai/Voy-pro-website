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
// GitHub's hosted Ubuntu runner already includes Google Chrome; use the
// system browser in CI instead of downloading a large Playwright Chromium.
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
const results=[];
let failures=0;
function check(condition,label){
  if(!condition){failures++;results.push('FAIL: '+label);}
  else results.push('PASS: '+label);
}
async function visit(name,path,viewport,{fullPage=false,guide=false,booking=false,request=false,b2b=null,localWhatsApp=null,tourFloat=false,heroImage=false}={}){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  // Avoid contact with actual vendors, FBM, Google/Meta tracking, or YouTube.
  await page.route('**/*',async route=>{
    try{
      const requested=new URL(route.request().url());
      if(requested.origin===base)return route.continue();
      // Absolute, first-party media URLs are part of the website snapshot:
      // replay only /assets from local dist for truthful screenshot QA.
      // Never fetch the public domain, payment/FBM APIs or external resources.
      if(['voy-pro.com','www.voy-pro.com'].includes(requested.hostname)&&
        requested.protocol==='https:'&&requested.pathname.startsWith('/assets/')){
        // Playwright route.continue forbids changing HTTPS to HTTP. Fulfill
        // the request with bytes read only from the local static test server.
        const local=await fetch(base+requested.pathname+requested.search);
        const body=Buffer.from(await local.arrayBuffer());
        return route.fulfill({
          status:local.status,
          body,
          contentType:local.headers.get('content-type')||'application/octet-stream'
        });
      }
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
      direction:document.documentElement.dir||getComputedStyle(document.documentElement).direction,
      ready:document.readyState
    }));
    check(metrics.heading.length>0,name+' visible semantic H1');
    check(metrics.scrollWidth<=metrics.width+2,name+' no horizontal page overflow ('+metrics.scrollWidth+'/'+metrics.width+')');
    check(metrics.hasNav,name+' has navigation');
    check(await page.locator('footer').count()===1,name+' has exactly one footer');
    if(path.startsWith('/he/'))check(metrics.direction==='rtl',name+' preserves Hebrew RTL direction');
    if(booking){
      check(await page.locator('#booking #availability-form').count()===1,name+' has one Budapest booking form');
      for(const key of ['experience','date','adults','children','babies']){
        check(await page.locator('#availability-form [name="'+key+'"]').count()===1,
          name+' booking form includes '+key);
      }
    }
    if(request){
      check(await page.locator('#request [data-portugal-request-form]').count()===1,
        name+' has local Marvão request form');
      check(await page.locator('[data-portugal-tour]').count()===3,
        name+' offers three local route request links');
    }
    if(b2b){
      check(await page.locator('[data-b2b-planner="'+b2b+'"]').count()===1,
        name+' displays dedicated '+b2b+' B2B planner');
      check(await page.locator('[data-b2b-planner] [name="guide_language"]').count()===1,
        name+' B2B planner asks for guide language');
    }
    if(localWhatsApp){
      const links=await page.locator('a[href^="https://wa.me/"]').evaluateAll(anchors=>
        anchors.map(a=>a.href));
      check(links.length>0&&links.some(url=>url.startsWith('https://wa.me/'+localWhatsApp)),
        name+' has local '+localWhatsApp+' WhatsApp link');
      if(tourFloat){
        check(await page.locator('a.tour-floating-whatsapp[href^="https://wa.me/'+localWhatsApp+'"]').count()===1,
          name+' has destination-specific floating WhatsApp for request-only tour');
      }
    }
    if(heroImage){
      const hero=page.locator('.hero-photo-frame img').first();
      check(await hero.count()===1,name+' has a dedicated tour hero photo');
      if(await hero.count()){
        const loaded=await hero.evaluate(async img=>{
          try{await img.decode();return img.naturalWidth>0&&img.naturalHeight>0;}
          catch{return false;}
        });
        check(loaded,name+' tour hero photo decodes from the local built assets');
      }
    }
    await page.screenshot({path:join(out,name+'.png'),fullPage,animations:'disabled',timeout:20000});
    results.push('SCREENSHOT: '+name+'.png | '+viewport.width+'x'+viewport.height+' | '+metrics.lang+' | '+metrics.heading.slice(0,70));
    if(viewport.width<=800){
      const menu=page.locator('.nav-menu-toggle');
      check(await menu.isVisible(),name+' mobile navigation control visible');
      if(await menu.isVisible()){
        await menu.click();
        const sheetOpened=await page.locator('#mobile-nav-sheet').isVisible();
        const expanded=await menu.getAttribute('aria-expanded');
        check(sheetOpened,name+' mobile sheet opens');
        check(expanded==='true',name+' menu reports expanded state');
        if(!sheetOpened||expanded!=='true'){
          const diagnostic=await page.evaluate(()=>({
            menu:document.querySelector('.nav-menu-toggle')?.outerHTML,
            sheet:document.querySelector('#mobile-nav-sheet')?.outerHTML.slice(0,320),
            cssDisplay:getComputedStyle(document.querySelector('#mobile-nav-sheet')).display,
            bodyClass:document.body.className,
            onClick:typeof document.querySelector('.nav-menu-toggle')?.onclick,
            innerWidth:window.innerWidth,
            activeElement:document.activeElement?.outerHTML.slice(0,200)
          }));
          results.push('DIAGNOSTIC '+name+': '+JSON.stringify({diagnostic,runtimeErrors}).slice(0,2200));
        }
        await page.keyboard.press('Escape');
        check(!(await page.locator('#mobile-nav-sheet').isVisible()),name+' Escape closes menu');
        check(await menu.getAttribute('aria-expanded')==='false',name+' menu resets aria-expanded');
      }
    }
    if(guide){
      check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').count()===1,name+' has source-aware return link');
      check(await page.locator('.ez-destination-chooser').count()===1,name+' has destination chooser');
    }
    // Silent JS failures can leave a page visually attractive but unusable.
    // All third-party requests are blocked, so only local page script errors
    // are counted; HTTP/network failures are intentionally not treated as JS errors.
    if(runtimeErrors.length){
      check(false,name+' has no uncaught JavaScript errors: '+runtimeErrors.join(' | ').slice(0,350));
      results.push('BROWSER ERRORS '+name+': '+runtimeErrors.join(' | ').slice(0,1200));
    }else check(true,name+' has no uncaught JavaScript errors');
    return page;
  }catch(e){
    failures++;results.push('FAIL: '+name+' browser error '+(e.stack||String(e)).slice(0,600));
    await page.close();
    return null;
  }
}
try{
  const desktop={width:1365,height:900},mobile={width:390,height:844},narrow={width:320,height:700};
  const budapest='36300993099',marvao='351935695004';
  // Sample the customer-facing funnel across source/destination, locale,
  // RTL, 320px narrow screens, classic booking, RTB and B2B enquiry.
  // These are smoke checks, not real payment/availability/API integrations.
  const scenarios=[
    ['home-desktop','/',desktop,{fullPage:true}],
    ['home-mobile','/',mobile,{}],
    ['budapest-en-desktop','/budapest/',desktop,{booking:true,localWhatsApp:budapest}],
    ['budapest-en-mobile','/budapest/',mobile,{booking:true,localWhatsApp:budapest}],
    ['budapest-he-mobile','/he/budapest/',mobile,{fullPage:true,booking:true,localWhatsApp:budapest}],
    ['budapest-hu-narrow','/hu/budapest/',narrow,{booking:true,localWhatsApp:budapest}],
    ['marvao-pt-mobile','/pt/portugal/',mobile,{fullPage:true,request:true,localWhatsApp:marvao}],
    ['marvao-pt-narrow','/pt/portugal/',narrow,{request:true,localWhatsApp:marvao}],
    ['marvao-he-mobile','/he/portugal/',mobile,{request:true,localWhatsApp:marvao}],
    ['marvao-en-desktop','/portugal/',desktop,{request:true,localWhatsApp:marvao}],
    ['budapest-he-family-mobile','/he/budapest/with-kids/',mobile,{booking:true,localWhatsApp:budapest}],
    ['budapest-hu-family-narrow','/hu/budapest/with-kids/',narrow,{booking:true,localWhatsApp:budapest}],
    ['budapest-en-private-mobile','/budapest/private-tours/',mobile,{booking:true,localWhatsApp:budapest}],
    ['budapest-en-groups-mobile','/budapest/group-tours/',mobile,{booking:true,b2b:'group',localWhatsApp:budapest}],
    ['budapest-en-corporate-desktop','/budapest/corporate-events/',desktop,{booking:true,b2b:'corporate',localWhatsApp:budapest}],
    ['heroes-en-mobile','/budapest/tours/heroes-square-city-ezraider-tour/',mobile,{localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['heroes-hu-narrow','/hu/budapest/tours/heroes-square-city-ezraider-tour/',narrow,{localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['heroes-he-mobile','/he/budapest/tours/heroes-square-city-ezraider-tour/',mobile,{localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['citadella-en-mobile','/budapest/tours/citadella-advanced-ezraider-tour/',mobile,{localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['citadella-he-narrow','/he/budapest/tours/citadella-advanced-ezraider-tour/',narrow,{localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['citadella-hu-desktop','/hu/budapest/tours/citadella-advanced-ezraider-tour/',desktop,{localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['extended-en-mobile','/budapest/tours/buda-margaret-extended-tour/',mobile,{localWhatsApp:budapest,heroImage:true}],
    ['extended-he-mobile','/he/budapest/tours/buda-margaret-extended-tour/',mobile,{localWhatsApp:budapest,heroImage:true}],
    ['extended-hu-desktop','/hu/budapest/tours/buda-margaret-extended-tour/',desktop,{localWhatsApp:budapest,heroImage:true}],
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

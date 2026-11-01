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
const MARVAO_POSTER='/assets/media/marvao/marvao-countryside-poster.webp';
const MARVAO_VIDEO='/assets/media/marvao/marvao-countryside-ride-15s.mp4';

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
// Explicit, public, synthetic paths only. Never permit arbitrary query strings.
const recoveryCases=[
  {path:'/qa-not-found-717-20261030/',lang:'en',heading:'That page isn’t here.',direction:'ltr',
    budapest:'/budapest/',portugal:'/portugal/',manage:'/manage/'},
  {path:'/he/qa-not-found-visual-20261030/',lang:'he',heading:'העמוד לא נמצא.',direction:'rtl',
    budapest:'/he/budapest/',portugal:'/he/portugal/',manage:'/manage/?lang=he'},
  {path:'/hu/qa-not-found-visual-20261030/',lang:'hu',heading:'Ez az oldal nem található.',direction:'ltr',
    budapest:'/hu/budapest/',portugal:'/portugal/',manage:'/manage/?lang=hu'},
  {path:'/pt/qa-not-found-visual-20261030/',lang:'pt',heading:'Esta página não existe.',direction:'ltr',
    budapest:'/budapest/',portugal:'/pt/portugal/',manage:'/manage/?lang=pt'}
];
const tokenlessManageCases=[
  {path:'/manage/',search:'',lang:'en',copy:'Booking details cannot be opened from this link.',direction:'ltr'},
  {path:'/manage/',search:'?lang=he',lang:'he',copy:'לא ניתן לפתוח את פרטי ההזמנה מהקישור הזה.',direction:'rtl'},
  {path:'/manage/',search:'?lang=hu',lang:'hu',copy:'Ebből a linkből nem nyithatók meg a foglalási adatok.',direction:'ltr'}
];
const allowedManageQueries=new Set(['?lang=he','?lang=hu']);
const extraPaths=['/manage/',...recoveryCases.map(item=>item.path)];
const allPaths=new Set([...sitemapPaths,...extraPaths]);
const highlights=[
  '/', '/budapest/', '/he/budapest/', '/hu/budapest/',
  '/portugal/', '/pt/portugal/', '/ezraider/',
  '/budapest/tours/buda-castle-ezraider-tour/', '/manage/'
];
assert.ok(highlights.every(path=>allPaths.has(path)),'Missing approved highlight path');
const partialPR=process.env.GITHUB_EVENT_NAME==='pull_request';
// PRs exercise high-value routes and every supported locale quickly.
// The existing weekly/manual schedule still audits every canonical page.
const canonicalChecked=partialPR?sitemapPaths.filter(path=>highlights.includes(path)):sitemapPaths;
const targets=[
  ...canonicalChecked.map(path=>({path,width:390,height:844})),
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
    return !url.hash&&(
      (!url.search&&allPaths.has(url.pathname))||
      (url.pathname==='/manage/'&&allowedManageQueries.has(url.search))
    );
  }
  // The one approved first-party H.264 is the only media request
  // permitted by this anonymous, GET-only public browser test.
  if(request.resourceType()==='media')
    return url.pathname===MARVAO_VIDEO&&!url.search;
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
// A full-page screenshot does not guarantee lazy off-screen media has loaded.
// Traverse only screenshot targets with the browser viewport, then inspect the
// first-party images before capturing; all remote APIs remain blocked.
async function prepareScreenshot(page){
  const dimensions=await page.evaluate(()=>({
    height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),
    view:innerHeight
  }));
  const step=Math.max(450,Math.round(dimensions.view*0.85));
  const stops=Math.min(65,Math.ceil(dimensions.height/step));
  for(let i=0;i<stops;i++){
    await page.evaluate(y=>scrollTo(0,y),Math.min(i*step,dimensions.height));
    await page.waitForTimeout(35);
  }
  await page.evaluate(()=>scrollTo(0,0));
  // Sources may be slow: a bounded delay + decode attempt records truthful
  // failures instead of treating not-yet-loaded lazy media as fine.
  await Promise.race([
    page.evaluate(async()=>{
      const own=[...document.images].filter(img=>{
        try{
          const url=new URL(img.currentSrc||img.src,location.href);
          return (url.hostname==='voy-pro.com'||url.hostname==='www.voy-pro.com')&&
            url.pathname.startsWith('/assets/');
        }catch{return false;}
      });
      await Promise.all(own.map(img=>img.decode().catch(()=>{})));
    }),
    page.waitForTimeout(5000)
  ]);
  return page.evaluate(()=>{
    const imgs=[...document.images].filter(img=>{
      try{
        const url=new URL(img.currentSrc||img.src,location.href);
        return (url.hostname==='voy-pro.com'||url.hostname==='www.voy-pro.com')&&
          url.pathname.startsWith('/assets/');
      }catch{return false;}
    });
    return {
      firstPartyImages:imgs.length,
      loaded:imgs.filter(img=>img.complete&&img.naturalWidth>0).length,
      failed:imgs.filter(img=>img.complete&&img.naturalWidth===0).
        map(img=>new URL(img.currentSrc||img.src,location.href).pathname).slice(0,8),
      pending:imgs.filter(img=>!img.complete).length
    };
  });
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
    // Clear the public consent overlay for meaningful screenshots. This is
    // essential-only local browser consent, never analytics consent.
    const consent=page.locator('[data-consent-essential]');
    if(await consent.isVisible().catch(()=>false)){
      await consent.click({timeout:2500});
      await page.waitForTimeout(120);
    }
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
      const media=await prepareScreenshot(page);
      row.screenshotMedia=media;
      if(media.failed.length)row.issues.push('Failed first-party images: '+media.failed.join(', '));
      if(media.pending)row.advisories.push('First-party images still loading: '+media.pending);
      const namePart=slug(target.path)+'-'+target.width+(target.alias?'-www':'')+'.png';
      await page.screenshot({path:join(OUTPUT,namePart),fullPage:true,animations:'disabled',timeout:15000});
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

// Independent public-domain media verification, separate from the already-green
// local MP4 playback fixture. No YouTube, payment, FBM or third-party request.
// This checks server MIME, actual decoding and a manual play() action; it cannot
// establish iOS Safari compatibility.
async function inspectPublicMarvaoVideo(spec){
  const name='marvao-public-video-'+spec.lang+' @ '+spec.width;
  const page=await (await context(spec.width,spec.height)).newPage();
  const row={name,url:ORIGIN+spec.path,ok:false,status:null,issues:[],
    advisories:[],pageErrors:[],videoRequests:0,videoResponses:[],posterStatus:null,
    playback:null,screenshot:null};
  page.on('pageerror',error=>{
    if(row.pageErrors.length<4)row.pageErrors.push(diagnostic(error));
  });
  page.on('request',req=>{
    if(safeURL(req.url())&&new URL(req.url()).pathname===MARVAO_VIDEO)
      row.videoRequests++;
  });
  page.on('response',response=>{
    if(safeURL(response.url())&&new URL(response.url()).pathname===MARVAO_VIDEO)
      row.videoResponses.push({
        status:response.status(),
        type:response.headers()['content-type']||''
      });
  });
  try{
    const response=await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:18000});
    row.status=response?.status()??null;
    if(row.status!==200)row.issues.push('Public Marvão page must return HTTP 200');
    const videos=page.locator('.portugal-owner-video video');
    if(await videos.count()!==1){
      row.issues.push('Expected one first-party Marvão video');
    }else{
      const video=videos.first();
      const state=await video.evaluate(el=>({
        preload:el.preload,autoplay:el.autoplay,paused:el.paused,
        controls:el.controls,playsInline:el.playsInline,
        src:el.querySelector('source')?.getAttribute('src'),
        type:el.querySelector('source')?.getAttribute('type'),
        poster:el.getAttribute('poster'),
        describedBy:el.getAttribute('aria-describedby'),
        description:document.getElementById(el.getAttribute('aria-describedby')||'')?.textContent||'',
        dir:getComputedStyle(document.documentElement).direction,
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth
      }));
      if(state.preload!=='none'||state.autoplay||!state.paused||!state.controls||!state.playsInline)
        row.issues.push('Video must have controls and stay paused/unloaded before gesture');
      if(state.src!==MARVAO_VIDEO||state.type!=='video/mp4'||state.poster!==MARVAO_POSTER)
        row.issues.push('Video/poster source differs from approved first-party assets');
      if(!state.describedBy||!state.description.trim())
        row.issues.push('Video missing accessible localized description');
      if(state.dir!==(spec.lang==='he'?'rtl':'ltr'))
        row.issues.push('Wrong Marvão page direction');
      if(state.overflow>2)row.issues.push('Horizontal overflow '+state.overflow+'px');
      // Media request listener is installed before page navigation: preload=none
      // must not download the MP4 before a visitor initiates playback.
      if(row.videoRequests!==0)
        row.issues.push('MP4 requested before explicit Play');
      const poster=await page.request.get(ORIGIN+MARVAO_POSTER,{timeout:18000});
      row.posterStatus=poster.status();
      if(row.posterStatus!==200||
        !String(poster.headers()['content-type']||'').toLowerCase().includes('image/webp'))
        row.issues.push('Public WebP poster HTTP/MIME mismatch');
      const playStarted=await video.evaluate(async el=>{
        try{await el.play();return true;}catch{return false;}
      });
      if(!playStarted){
        row.issues.push('Chrome cannot begin public H.264 playback by explicit play()');
      }else{
        await page.waitForFunction(()=>{
          const el=document.querySelector('.portugal-owner-video video');
          return !!el&&el.currentTime>0.05&&!el.paused&&!el.error;
        },undefined,{timeout:15000});
        row.playback=await video.evaluate(el=>({
          currentTime:el.currentTime,duration:el.duration,
          width:el.videoWidth,height:el.videoHeight,
          error:el.error?.message||''
        }));
        if(!(row.playback.currentTime>0.05&&row.playback.duration>14&&
          row.playback.duration<16&&row.playback.width===540&&
          row.playback.height===960&&!row.playback.error))
          row.issues.push('Unexpected MP4 frame advancement/duration/dimensions');
        await video.evaluate(el=>el.pause());
        const shot='marvao-public-video-'+spec.lang+'-'+spec.width+'.png';
        await video.screenshot({path:join(OUTPUT,shot),timeout:10000});
        row.screenshot=shot;
      }
      if(row.videoRequests===0||!row.videoResponses.some(r=>
        (r.status===200||r.status===206)&&
        r.type.toLowerCase().includes('video/mp4')))
        row.issues.push('Public MP4 HTTP 200/206 and video/mp4 MIME not confirmed');
    }
    if(row.pageErrors.length)row.advisories.push('Page errors: '+row.pageErrors.join(' / '));
  }catch(error){
    row.issues.push('Public Marvão playback failed: '+diagnostic(error));
  }finally{
    await page.close().catch(()=>{});
  }
  row.ok=row.issues.length===0;
  rows.push(row);
  if(!row.ok)failures.push(name+': '+row.issues.join('; '));
  console.log((row.ok?'PASS ':'FAIL ')+name+
    ' | first-party MP4 GETs '+row.videoRequests+
    ' | poster HTTP '+row.posterStatus+
    (row.issues.length?' | '+row.issues.join('; '):''));
}

// Existing weekly Chrome harness additionally verifies public HTTP evidence
// missing from Work #718; no local 404 simulation or customer booking access.
async function inspectPublicRecovery(spec){
  const url=ORIGIN+spec.path+(spec.search||'');
  const name=(spec.managePage?'manage-tokenless-':'404-edge-')+spec.lang+' @ 390';
  const page=await (await context(390,844)).newPage();
  const row={
    name,url,ok:false,status:null,finalUrl:null,redirectPaths:[],
    responseHeaders:{},lang:null,direction:null,heading:'',
    horizontalOverflow:null,issues:[],advisories:[],pageErrors:[],screenshot:null
  };
  page.on('pageerror',error=>{
    if(row.pageErrors.length<4)row.pageErrors.push(diagnostic(error));
  });
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});
    row.status=response?.status()??null;
    row.finalUrl=page.url();
    const h=response?.headers()||{};
    row.responseHeaders={
      'content-type':h['content-type']||null,
      'x-robots-tag':h['x-robots-tag']||null,
      'cache-control':h['cache-control']||null,
      'x-content-type-options':h['x-content-type-options']||null,
      'x-frame-options':h['x-frame-options']||null
    };
    let previous=response?.request()?.redirectedFrom();
    while(previous&&row.redirectPaths.length<5){
      const previousUrl=new URL(previous.url());
      row.redirectPaths.unshift(previousUrl.pathname);
      previous=previous.redirectedFrom();
    }
    const expectedStatus=spec.managePage?200:404;
    if(row.status!==expectedStatus)
      row.issues.push('Real Vercel HTTP status '+row.status+' instead of '+expectedStatus);
    if(row.redirectPaths.length)row.issues.push('Unexpected redirect chain '+row.redirectPaths.join(' → '));
    if(page.url()!==url)row.issues.push('Unexpected public document final URL');
    if(!String(h['content-type']||'').toLowerCase().includes('text/html'))
      row.issues.push('Missing public text/html Content-Type');
    const httpRobots=String(h['x-robots-tag']||'').toLowerCase().replace(/\s/g,'');
    if(!httpRobots.includes('noindex')||!httpRobots.includes('nofollow'))
      row.issues.push('Missing public HTTP noindex/nofollow header');
    if(String(h['x-content-type-options']||'').toLowerCase()!=='nosniff')
      row.issues.push('Missing public nosniff header');
    if(spec.managePage&&!String(h['cache-control']||'').toLowerCase().includes('no-store'))
      row.issues.push('Manage public HTTP cache policy missing no-store');

    await page.waitForTimeout(250);
    const consent=page.locator('[data-consent-essential]');
    if(await consent.isVisible().catch(()=>false))await consent.click({timeout:2500});
    if(spec.managePage){
      await page.waitForFunction(
        copy=>document.querySelector('#manage-box')?.textContent?.includes(copy),
        spec.copy,{timeout:5000}).catch(()=>{});
    }
    const metrics=await page.evaluate(managePage=>{
      const doc=document.documentElement,main=document.querySelector('main');
      const link=key=>document.querySelector(managePage?'#manage-box a[href="mailto:support@voy-pro.com"]':'[data-404-'+key+']');
      return {
        lang:doc.lang,direction:getComputedStyle(doc).direction,
        heading:document.querySelector('h1')?.textContent?.trim()||'',
        copy:managePage?document.querySelector('#manage-box')?.textContent||'':'',
        robots:document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        mainCount:document.querySelectorAll('main').length,
        overflow:Math.max(doc.scrollWidth,document.body.scrollWidth)-innerWidth,
        links:managePage?{support:link('support')?.getAttribute('href')}:
          Object.fromEntries(['budapest','portugal','manage','support'].
            map(key=>[key,link(key)?.getAttribute('href')])),
        formFields:managePage?main?.querySelectorAll('form,input,select,textarea').length:null
      };
    },Boolean(spec.managePage));
    row.lang=metrics.lang;
    row.direction=metrics.direction;
    row.heading=metrics.heading;
    row.horizontalOverflow=Math.max(0,metrics.overflow);
    if(metrics.lang!==spec.lang)row.issues.push('Wrong document lang');
    if(metrics.direction!==spec.direction)row.issues.push('Wrong document direction');
    if(metrics.mainCount!==1)row.issues.push('Expected one main landmark');
    if(metrics.robots!=='noindex,nofollow')row.issues.push('Missing HTML robots noindex,nofollow');
    if(metrics.overflow>2)row.issues.push('Horizontal overflow '+metrics.overflow+'px at 390px');
    if(spec.managePage){
      if(!metrics.copy.includes(spec.copy))row.issues.push('Missing localized private-link fallback instructions');
      if(metrics.formFields!==0)row.issues.push('Tokenless Manage unexpectedly exposes an input/form');
    }else{
      if(metrics.heading!==spec.heading)row.issues.push('Wrong localized recovery heading');
      for(const key of ['budapest','portugal','manage']){
        if(metrics.links[key]!==spec[key])row.issues.push('Wrong recovery '+key+' href');
      }
    }
    if(metrics.links.support!=='mailto:support@voy-pro.com')
      row.issues.push('Support mailto href missing or incorrect');
    for(const key of spec.managePage?['support']:['budapest','portugal','manage','support']){
      const link=page.locator(spec.managePage?
        '#manage-box a[href="mailto:support@voy-pro.com"]':'[data-404-'+key+']');
      if(await link.count()!==1){row.issues.push(key+' recovery link absent/duplicate');continue;}
      await link.scrollIntoViewIfNeeded();
      const hittable=await link.evaluate(element=>{
        const pieces=[...element.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
        return pieces.length>0&&pieces.every(rect=>{
          const x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;
          const above=document.elementFromPoint(x,y);
          return x>=0&&x<=innerWidth&&y>=0&&y<=innerHeight&&
            Boolean(above&&(above===element||element.contains(above)));
        });
      });
      if(!hittable)row.issues.push(key+' recovery link not hit-testable at 390px');
    }
    if(row.pageErrors.length)row.issues.push('Uncaught page errors: '+row.pageErrors.join(' / '));
    const filename=(spec.managePage?'manage-live-':'404-live-')+spec.lang+'-390.png';
    await page.screenshot({path:join(OUTPUT,filename),fullPage:true,animations:'disabled',timeout:15000});
    row.screenshot=filename;
    row.ok=row.issues.length===0;
  }catch(error){
    row.issues.push('Public recovery browser or HTTP audit failed: '+diagnostic(error));
  }finally{
    await page.close().catch(()=>{});
  }
  if(!row.ok)failures.push(name+': '+row.issues.join('; '));
  rows.push(row);
  console.log((row.ok?'PASS ':'FAIL ')+name+
    ' | real HTTP '+row.status+
    ' | X-Robots-Tag '+String(row.responseHeaders['x-robots-tag']||'unknown')+
    ' | Cache-Control '+String(row.responseHeaders['cache-control']||'unknown')+
    (row.issues.length?' | '+row.issues.join('; '):''));
}

try{
  for(const target of targets)await inspect(target);
  // Three locales/viewport shapes, with real public MP4 decoding.
  for(const spec of [
    {lang:'en',path:'/portugal/',width:1440,height:900},
    {lang:'pt',path:'/pt/portugal/',width:390,height:844},
    {lang:'he',path:'/he/portugal/',width:320,height:700}
  ])await inspectPublicMarvaoVideo(spec);
  for(const item of recoveryCases)await inspectPublicRecovery(item);
  for(const item of tokenlessManageCases)await inspectPublicRecovery({...item,managePage:true});
}finally{
  for(const ctx of contexts.values())await ctx.close().catch(()=>{});
  await browser.close();
}
const summary={
  checked:new Date().toISOString(),
  mode:'public read-only staging browser QA; no live booking, FBM, payment or third-party requests',
  sitemapPages:sitemapPaths.length,
  canonicalChecked:canonicalChecked.length,
  coverage:partialPR?'PR representative pages':'Full canonical sitemap',
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
  '**Coverage:** '+summary.coverage+'; '+summary.totalViews+' views; '+summary.canonicalChecked+' of '+summary.sitemapPages+' canonical pages at 390px, plus highlight 320px and 1440px; one www alias and one safe destination click.',
  '**Passed:** '+summary.passed+'/'+summary.totalViews,
  '**Blocked requests:** '+blockedRequests+' (external services, all writes, and non-allowlisted paths intentionally denied).',
  '**First-party asset HTTP failures:** '+assetFailures,
  '**Public recovery HTTP/mobile cases:** '+(recoveryCases.length+tokenlessManageCases.length)+' real 390px views with status, headers, locale, link hit-tests and screenshots; synthetic URLs contain no customer data.',
  '**Public Marvão video:** EN 1440px / PT 390px / HE RTL 320px; real first-party WebP HTTP 200, video/mp4 HTTP 200/206 and native Chrome decoding after explicit play; no pre-play MP4 GET.',
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
  'Marvão native MP4 playback is verified only in the Chrome environment running this test, not iPhone/iOS Safari or every device.',
  'No production cutover, DNS, booking, payment, or search-indexing change is authorized by a passing test.',
  ''
].join('\n');
await writeFile(join(OUTPUT,'report.md'),markdown);
if(failures.length)process.exitCode=1;

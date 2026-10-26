// Browser behavior checks on public Staging HTML, with outbound writes blocked.
// Uses real Chrome and local browser-only destination fixtures; no FBM requests.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';

const ORIGIN='https://voy-pro.com';
const API='https://ezraider-os-staging.vercel.app';
const OUT=resolve('visual-qa-output/public-live-interactions');
const EXPECTED_MAP='https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac';
const EXPECTED_PORTUGAL_MAP='https://maps.app.goo.gl/tfkNvDZNgaq3vN9LA?g_st=ac';
const REVIEW_HOSTS=['google.com','tripadvisor.com','tripadvisor.co.uk',
  'tripadvisor.co.il','tripadvisor.ie','getyourguide.com'];
const sitemap=await readFile('site/sitemap.xml','utf8');
const canonical=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]));
assert.ok(canonical.length>=40&&canonical.length<=80,'Unexpected canonical sitemap count');
assert.ok(canonical.every(u=>u.origin===ORIGIN&&
  /^\/(?:[a-z0-9-]+\/)*$/.test(u.pathname)&&!u.search&&!u.hash),
  'Canonical sitemap contains an unsafe URL');
const allowedDocuments=new Set([...canonical.map(u=>u.pathname),'/manage/']);
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
await mkdir(OUT,{recursive:true});
const rows=[],violations=[];
let blocked=0,simulatedDestinationCalls=0;
const mapFixture={
  id:'budapest',configuration_version:2,booking_horizon_days:21,
  rider_policy:{
    standard_min_age:16,assessment_min_age:15,
    child_passenger_min_age:3,child_passenger_max_age:15,
    baby_passenger_min_age:1,baby_passenger_max_age:2
  },
  meeting_point:{
    address:'Városház utca 14, 1052 Budapest, Hungary',
    maps_url:EXPECTED_MAP
  }
};
function check(value,message){assert.ok(value,message);}
function failText(error){return String(error?.message||error).replace(/[\r\n]/g,' ').slice(0,330);}
function firstPartyAsset(req,u){
  return req.method()==='GET'&&!u.username&&!u.password&&!u.port&&(
    (/^(image|font|script|stylesheet|other)$/.test(req.resourceType())&&
      u.pathname.startsWith('/assets/'))||
    (req.resourceType()==='fetch'&&
      u.pathname==='/assets/budapest-approved-reviews.json')
  );
}
async function launch(path,{width=390,fixture=false,reducedMotion='reduce'}={}){
  check(allowedDocuments.has(path),'Test attempted unapproved public route: '+path);
  const context=await browser.newContext({
    viewport:{width,height:844},deviceScaleFactor:1,reducedMotion,
    serviceWorkers:'block',acceptDownloads:false
  });
  const outbounds=[];
  await context.route('**/*',async route=>{
    const req=route.request();
    let url;
    try{url=new URL(req.url());}catch{return route.abort('blockedbyclient');}
    // No network ever reaches the backend: only this exact GET returns a fixture.
    if(fixture&&req.method()==='GET'&&url.origin===API&&
       url.pathname==='/api/v1/destinations/budapest'&&!url.search){
      simulatedDestinationCalls++;
      return route.fulfill({
        status:200,
        headers:{'content-type':'application/json','access-control-allow-origin':ORIGIN},
        body:JSON.stringify(mapFixture)
      });
    }
    if(url.protocol==='https:'&&['voy-pro.com','www.voy-pro.com'].includes(url.hostname)&&
       !url.username&&!url.password&&!url.port){
      if(req.method()==='GET'&&req.resourceType()==='document'&&
         allowedDocuments.has(url.pathname)&&!url.search)return route.continue();
      if(firstPartyAsset(req,url))return route.continue();
    }
    blocked++;
    outbounds.push({method:req.method(),host:url.hostname,path:url.pathname});
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:20000});
  check(response?.status()===200,'Live '+path+' HTTP status != 200');
  const consent=page.locator('[data-consent-essential]');
  if(await consent.isVisible().catch(()=>false))await consent.click({timeout:2200});
  return {page,context,outbounds};
}
async function scenario(name,path,opts,verify){
  let session;
  const result={name,path,status:'fail',notes:[]};
  try{
    session=await launch(path,opts);
    const assertCase=(condition,message)=>{
      check(condition,message);result.notes.push(message);
    };
    await verify(session.page,assertCase,result,session.outbounds);
    check(!session.outbounds.some(r=>r.method!=='GET'),
      'App attempted an outbound write (blocked): '+JSON.stringify(session.outbounds.filter(x=>x.method!=='GET')));
    result.status='pass';
    console.log('PASS '+name);
  }catch(error){
    result.error=failText(error);
    violations.push(name+': '+result.error);
    console.error('FAIL '+name+' — '+result.error);
  }finally{
    rows.push(result);
    await session?.context.close().catch(()=>{});
  }
}
// Live mobile nav: real pointer and keyboard behavior in 3 locales.
// Existing offline QA covers more pages; this catches deployed runtime regressions.
for(const [locale,path] of [
  ['EN','/budapest/'],['HE','/he/budapest/'],['PT','/pt/portugal/']
]){
  await scenario('mobile menu '+locale,path,{width:390},async(page,ok)=>{
    const button=page.locator('.nav-menu-toggle');
    const modal=page.locator('#mobile-nav-sheet');
    ok(await button.isVisible(),'menu opener visible');
    await button.click();
    ok(await modal.isVisible(),'mobile menu opens');
    await modal.screenshot({path:join(OUT,'mobile-menu-'+locale.toLowerCase()+'.png'),animations:'disabled'});
    ok(await button.getAttribute('aria-expanded')==='true','accessible expanded state');
    ok(await page.evaluate(()=>document.activeElement?.classList.contains('mobile-nav-close')),
      'initial focus in modal');
    const links=await modal.locator('a[href]').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
    ok(links.some(h=>h.startsWith('/budapest/')||h.startsWith('/he/budapest/')),
      'Budapest destination reachable');
    ok(links.some(h=>h.startsWith('/portugal/')||h.startsWith('/pt/portugal/')||
      h.startsWith('/he/portugal/')),'Portugal destination reachable');
    await page.keyboard.press('Escape');
    ok(!(await modal.isVisible()),'Escape closes menu');
    ok(await button.getAttribute('aria-expanded')==='false','expanded state reset');
    ok(await page.evaluate(()=>document.activeElement?.classList.contains('nav-menu-toggle')),
      'focus returned to opener');
    await button.click();
    await page.locator('#mobile-nav-sheet .mobile-nav-close').click();
    ok(!(await modal.isVisible()),'close button works');
  });
}
// Real approved review ticker: verify approved material, URLs, and user controls.
// reducedMotion=no-preference exposes pause/resume; nothing opens vendor URLs.
for(const [locale,path] of [
  ['EN','/budapest/'],['HE','/he/budapest/'],['HU','/hu/budapest/']
]){
  await scenario('reviews '+locale,path,{width:390,reducedMotion:'no-preference'},async(page,ok,result)=>{
    const root=page.locator('[data-vp-reviews-root]');
    await page.waitForFunction(()=>document.querySelectorAll('[data-vp-reviews-root] .vp-review-card').length===60,
      null,{timeout:6500});
    ok(await root.isVisible(),'approved ticker visible');
    await root.screenshot({path:join(OUT,'approved-reviews-'+locale.toLowerCase()+'.png'),animations:'disabled'});
    const cards=page.locator('[data-vp-reviews-root] .vp-review-card');
    ok(await cards.count()===60,'exactly 20 reviews, three seamless copies');
    const links=await root.locator('.vp-review-card a[href]').evaluateAll(nodes=>
      nodes.map(a=>a.getAttribute('href')));
    ok(links.length===60&&links.every(value=>{
      try{const u=new URL(value);return u.protocol==='https:'&&REVIEW_HOSTS.some(host=>
        u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}
    }),'all 60 review source links use trusted platforms');
    const quotes=await cards.locator('.vp-review-text').allTextContents();
    ok(quotes.slice(0,20).every(q=>q.trim().length>=35),'full-length review text');
    // PR #529 is now deployed on the public Staging alias; this must also
    // pass for every future PR (not merely the weekly/manual run).
      // The entire approved review must be readable without scrolling a
      // tiny inner text pane. No external original-review URL is opened.
      const original=root.locator('.vp-review-group').nth(1).
        locator('.vp-review-card').first();
      const full=await original.locator('.vp-review-text').innerText();
      const originalHref=await original.locator('.vp-review-bottom a[href]').getAttribute('href');
      const expand=original.locator('.vp-review-expand');
      ok(await expand.count()===1,'explicit full-review reading control exists');
      const pauseBeforeRead=root.locator('[data-vp-reviews-pause]');
      if(await pauseBeforeRead.getAttribute('aria-pressed')!=='true')await pauseBeforeRead.click();
      ok(await pauseBeforeRead.getAttribute('aria-pressed')==='true','reader can pause the moving reviews before selecting one');
      await expand.scrollIntoViewIfNeeded({timeout:4000});
      await expand.click({timeout:5500});
      const dialog=page.locator('dialog.vp-review-dialog');
      await dialog.waitFor({state:'visible',timeout:3500});
      ok((await dialog.locator('.vp-review-dialog-text').innerText()).trim()===full.trim(),
        'modal displays full approved review without truncation');
      ok(await dialog.locator('.vp-review-dialog-link').getAttribute('href')===originalHref,
        'modal retains authentic source URL');
      await dialog.screenshot({path:join(OUT,'full-review-dialog-'+locale.toLowerCase()+'.png'),
        animations:'disabled'});
      await page.keyboard.press('Escape');
      ok(!(await dialog.isVisible()),'Escape closes complete-review dialog');
      ok(await expand.evaluate(el=>document.activeElement===el),'modal restores opener focus');

    const pause=root.locator('[data-vp-reviews-pause]');
    ok(await pause.isVisible(),'pause control accessible');
    if(await pause.getAttribute('aria-pressed')==='true')await pause.click();
    await pause.click();
    ok(await pause.getAttribute('aria-pressed')==='true','pause updates aria state');
    const before=await root.locator('[data-vp-reviews-viewport]').evaluate(el=>el.scrollLeft);
    await root.locator('[data-vp-reviews-right]').click();
    const after=await root.locator('[data-vp-reviews-viewport]').evaluate(el=>el.scrollLeft);
    ok(Math.abs(after-before)>5,'manual arrow scroll changes position');
    await pause.click();
    ok(await pause.getAttribute('aria-pressed')==='false','resume updates aria state');
  });
}
// Map verification uses the public deployed site.js, with an in-browser FBM
// fixture for the destination config. No third-party map iframe is loaded.
await scenario('Budapest exact business map rendered using API fixture',
  '/budapest/',{width:390,fixture:true},async(page,ok,result)=>{
    await page.waitForSelector('[data-branch-meeting-point] .meeting-point-button',
      {timeout:6500,state:'attached'});
    const link=page.locator('[data-branch-meeting-point] .meeting-point-button');
    ok(await link.getAttribute('href')===EXPECTED_MAP,'official business link exact');
    const frame=page.locator('[data-branch-meeting-point] iframe.meeting-map-frame');
    const raw=await frame.getAttribute('src');
    const src=new URL(raw);
    ok(src.origin==='https://www.google.com'&&src.pathname==='/maps/embed',
      'Google embed is a business-specific map');
    const pb=src.searchParams.get('pb')||'';
    ok(pb.includes('0x0:0xbfcd8e3fb5a649b5')&&pb.includes('47.4944')&&pb.includes('19.0552'),
      'correct Google business CID and coordinates');
    ok(await page.locator('[data-branch-meeting-point] .meeting-map-label').innerText()
      .then(x=>x.includes('EZRaider Budapest by Voy PRO')),
      'correct business label on displayed map');
    await page.locator('[data-branch-meeting-point] .meeting-point-copy').screenshot({path:join(OUT,'budapest-meeting-details.png'),animations:'disabled'});
    result.notes.push('FBM destination GET was fulfilled from a local fixture; no live FBM integration asserted.');
  });
await scenario('Marvao public meeting map markup',
  '/pt/portugal/',{width:390},async(page,ok)=>{
    await page.waitForSelector('[data-branch-meeting-point] .meeting-point-button',
      {timeout:6500,state:'attached'});
    ok(await page.locator('[data-branch-meeting-point] .meeting-point-button').getAttribute('href')===
      EXPECTED_PORTUGAL_MAP,'Marvao direct business Maps link unchanged');
    const map=page.locator('[data-branch-meeting-point] iframe.meeting-map-frame');
    ok(await map.count()===1,'meeting map iframe created');
    const raw=await map.getAttribute('src');
    ok(Boolean(raw)&&/^https:\/\//.test(raw),'map iframe has HTTPS source (remote iframe deliberately blocked)');
  });
// Booking preflight only: change group composition, never submit or create a hold.
// All remote API requests remain blocked. Full mocked booking flow has its own CI suite.
await scenario('Budapest booking composition preflight',
  '/budapest/',{width:390},async(page,ok,result)=>{
    const form=page.locator('#availability-form');
    ok(await form.count()===1,'booking form present');
    for(const key of ['experience','date','adults','children','babies']){
      ok(await form.locator('[name="'+key+'"]').count()===1,key+' field present');
    }
    const submit=form.locator('button[type="submit"]');
    ok(await submit.count()===1,'availability search control available');
    ok(await page.locator('#slotlist').innerText()==='','no invented live slots before search');
    const riders=form.locator('select[name="adults"]');
    const children=form.locator('select[name="children"]');
    await riders.selectOption('2');
    await children.selectOption('1');
    const preview=form.locator('[data-group-composition-preview]');
    await preview.waitFor({timeout:4000,state:'visible'});
    ok((await preview.innerText()).includes('3'),'group summary updates after quantity change');
    ok(await page.locator('#slotlist').innerText()==='','no hold or times manufactured without backend');
    await form.screenshot({path:join(OUT,'booking-group-preflight.png'),animations:'disabled'});
    result.notes.push('No form submission, no live price, no Stripe action, no customer record.');
  });
await browser.close();
const summary={
  time:new Date().toISOString(),
  mode:'live public website UI; all third-party service requests blocked; Budapest map uses in-browser fixture',
  scenarios:rows.length,passed:rows.filter(x=>x.status==='pass').length,
  failed:violations.length,blockedRequests:blocked,simulatedDestinationCalls,rows
};
await writeFile(join(OUT,'results.json'),JSON.stringify(summary,null,2));
await writeFile(join(OUT,'report.md'),[
  '# VOY PRO — public live interactions',
  '',
  '**Checked:** '+summary.time,
  '**Outcome:** '+summary.passed+'/'+summary.scenarios+' passed, '+summary.failed+' failed.',
  '**Safety:** anonymous browser, no real FBM, Stripe, external Maps requests, form submissions or payments.',
  '**Blocked outbound requests:** '+blocked,
  '**Mocked Budapest destination responses:** '+simulatedDestinationCalls,
  '',
  '## Scenarios',
  ...rows.map(r=>'- **'+r.status.toUpperCase()+'** '+r.name+(r.error?' — '+r.error:'')),
  '',
  '## Limitations',
  'External map imagery, partner sites, real availability, card payments and a complete paid booking are deliberately outside this test.',
  'Map markup is checked with a FBM destination fixture; it is not evidence that the actual backend currently responds.',
  'Eight safe local-browser screenshots capture menu, approved reviews, the map business label and booking composition without PII.',
  'This test does not authorize public Production separation, indexing or any DNS/alias changes.',
  ''
].join('\n'));
if(violations.length)process.exitCode=1;

// Exercise the PUBLICLY DEPLOYED site against an in-browser fake FBM transport.
// Tests real web assets after Vercel deploy, but makes ZERO calls to FBM,
// Stripe, analytics, WhatsApp, external map servers or other outside services.
// POST requests are fulfilled only by a local browser route (sessions fixture);
// holds/quotes/bookings/payments are denied even inside the fixture.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';

const ORIGIN='https://voy-pro.com';
const FAKE_API='https://booking-browser-fixture.invalid/api/v1';
const OUT=resolve('visual-qa-output/public-live-booking-fixture');
const allowedPaths=new Set([...((await readFile('site/sitemap.xml','utf8'))
  .matchAll(/<loc>([^<]*)<\/loc>/g))].map(m=>new URL(m[1]).pathname));
const paths=[
  ['en','/budapest/tours/buda-castle-ezraider-tour/'],
  ['he','/he/budapest/tours/buda-castle-ezraider-tour/'],
  ['hu','/hu/budapest/tours/buda-castle-ezraider-tour/']
];
assert.ok(paths.every(([,p])=>allowedPaths.has(p)),'Unexpected canonical tour URL');
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
await mkdir(OUT,{recursive:true});
const productList=[
  {id:'exp_bud_buda',slug:'buda-highlights',title:'Buda Highlights',
    bookingEnabled:true,priceFrom:70,currency:'EUR',durationMinutes:120,
    guideLanguages:['en','he','hu'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12},
  {id:'exp_bud_margaret',slug:'margaret-island',title:'Margaret Island',
    bookingEnabled:true,priceFrom:70,currency:'EUR',durationMinutes:120,
    guideLanguages:['en','hu'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12}
];
const policy={
  standard_min_age:16,assessment_min_age:15,
  child_passenger_min_age:3,child_passenger_max_age:15,
  baby_passenger_min_age:1,baby_passenger_max_age:2
};
const results=[];
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function scenario(locale,path){
  const row={locale,path,passed:false,checks:[],backendCalls:[],blocked:0};
  const context=await browser.newContext({
    viewport:{width:390,height:844},reducedMotion:'reduce',
    serviceWorkers:'block',acceptDownloads:false
  });
  let phase='empty';
  let unauthorizedCalls=0;
  const pendingAvailabilityReplies=[];
  const waitForDelayedAvailability=async()=>{
    const deadline=Date.now()+5000;
    while(!pendingAvailabilityReplies.length&&Date.now()<deadline)await pause(25);
    assert.ok(pendingAvailabilityReplies.length,'Browser did not initiate delayed availability request');
    return pendingAvailabilityReplies.shift();
  };
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Route ALL outgoing requests. There must be no fallback network path.
  await context.route('**/*',async route=>{
    const request=route.request();
    const u=new URL(request.url());
    if(u.origin===ORIGIN||u.origin==='https://www.voy-pro.com'){
      if(request.method()==='GET'&&u.pathname==='/assets/runtime-config.js'&&!u.search){
        return route.fulfill({
          status:200,contentType:'text/javascript',
          body:'window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'+JSON.stringify(FAKE_API)+',clientKey:"browser_fixture_only"};'
        });
      }
      if(request.method()==='GET'&&!u.search&&
         request.resourceType()==='document'&&allowedPaths.has(u.pathname))
        return route.continue();
      if(request.method()==='GET'&&u.pathname.startsWith('/assets/')&&
         ['image','font','script','stylesheet','other','fetch'].includes(request.resourceType()))
        return route.continue();
      row.blocked++;return route.abort('blockedbyclient');
    }
    if(u.origin!==new URL(FAKE_API).origin||!u.pathname.startsWith('/api/v1/')){
      row.blocked++;return route.abort('blockedbyclient');
    }
    const endpoint=u.pathname.slice('/api/v1'.length);
    const headers={'content-type':'application/json',
      'access-control-allow-origin':ORIGIN,
      'access-control-allow-headers':'x-voy-client-key,x-voy-client,content-type',
      'access-control-allow-methods':'GET,POST,OPTIONS'};
    if(request.method()==='OPTIONS')
      return route.fulfill({status:204,headers,body:''});
    row.backendCalls.push({method:request.method(),endpoint,query:u.search});
    let status=200,data={ok:true};
    if(endpoint==='/marketing/experiments'&&request.method()==='GET')
      data={experiments:[]};
    else if(endpoint==='/destinations/budapest'&&request.method()==='GET')
      data={id:'budapest',configuration_version:2,rider_policy:policy,booking_horizon_days:21,
        meeting_point:{address:'Városház utca 14, 1052 Budapest, Hungary',
          maps_url:'https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac'}};
    else if(endpoint==='/experiences'&&request.method()==='GET')
      data=productList;
    else if(endpoint==='/payments/capabilities'&&request.method()==='GET')
      data={online_card:false};
    else if(endpoint==='/sessions'&&request.method()==='POST')
      data={id:'browser-fixture-session'};
    else if(endpoint==='/sessions/browser-fixture-session'&&
      ['POST','PATCH'].includes(request.method()))
      data={ok:true};
    else if(/^\/experiences\/[^/]+\/availability$/.test(endpoint)&&request.method()==='GET'){
      // Capture the reply mode before waiting. The guest may change a choice
      // while this exact HTTP response is pending, but the response must
      // retain the *old* request's outcome to simulate a real late server.
      const requestedPhase=phase;
      if(requestedPhase==='delayed-slots'||requestedPhase==='delayed-error'){
        await new Promise(resolve=>{pendingAvailabilityReplies.push(resolve);});
      }
      if(requestedPhase==='error'||requestedPhase==='delayed-error'){
        status=503;data={error:'fixture unavailable',code:'AVAILABILITY_UNAVAILABLE'};
      }else if(requestedPhase==='slots'||requestedPhase==='delayed-slots')data={slots:[
        {id:'11111111-1111-4111-8111-111111111111',time:'10:00',sellable:false,requestable:false},
        {id:'22222222-2222-4222-8222-222222222222',time:'10:30',sellable:true,requestable:false}
      ]};
      else data={slots:[]};
    }else {
      // Even a regression that accidentally initiates checkout cannot make a
      // customer record or payment; document any such attempt as CI failure.
      unauthorizedCalls++;
      status=403;data={error:'forbidden in browser QA fixture'};
    }
    return route.fulfill({status,headers,body:JSON.stringify(data)});
  });
  function ok(condition,message){assert.ok(condition,message);row.checks.push(message);}
  try{
    const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:25000});
    ok(response?.status()===200,'public tour HTML returned HTTP 200');
    const essential=page.locator('[data-consent-essential]');
    if(await essential.isVisible().catch(()=>false))await essential.click();
    const form=page.locator('#availability-form');
    const message=page.locator('#availability-status');
    ok(await message.getAttribute('role')==='status'&&
      await message.getAttribute('aria-live')==='polite'&&
      await message.getAttribute('aria-atomic')==='true',
      'deployed availability messages are announced by assistive technologies');
    const experience=form.locator('[name="experience"]');
    await experience.locator('option[value="exp_bud_buda"]').waitFor({state:'attached',timeout:9500});
    ok(await experience.inputValue()==='exp_bud_buda','public build hydrates mocked authorized Buda catalog');
    const guide=form.locator('[name="guide_language"]');
    await guide.locator('option[value="en"]').waitFor({state:'attached',timeout:8000});
    ok(await guide.inputValue()==='','guiding language never inferred from site locale');
    const submit=form.locator('button[type="submit"]');
    const date=form.locator('input[name="date"]');
    await date.evaluate(el=>{el.value=el.min;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    ok(Boolean(await date.inputValue()),'bookable date chosen from public Budapest policy');
    await submit.click();
    await pause(200);
    ok(row.backendCalls.every(c=>!c.endpoint.endsWith('/availability')),
       'missing guiding language blocks availability without backend query');
    await guide.selectOption('he');
    await experience.selectOption('exp_bud_margaret');
    ok(await guide.inputValue()==='','tour change clears unsupported Hebrew');
    await guide.selectOption('hu');
    await experience.selectOption('exp_bud_buda');
    ok(await guide.inputValue()==='hu','supported explicit language survives product switching');
    await guide.selectOption(locale);
    await form.locator('select[name="adults"]').selectOption('2');
    await form.locator('select[name="children"]').selectOption('1');
    const preview=form.locator('[data-group-composition-preview]');
    await preview.waitFor({state:'visible',timeout:2500});
    ok((await preview.innerText()).includes('3'),'composition preview reflects riders plus child');
    await submit.click();
    await page.waitForFunction(()=>document.querySelector('#availability-status')?.textContent
      ?.match(/No departures|לא נמצאו|nincs elérhető/i),null,{timeout:7000});
    ok(await page.locator('#slotlist button').count()===0,'empty mocked availability cannot invent a slot');
    ok(row.backendCalls.some(c=>c.endpoint.endsWith('/availability')&&c.query.includes('guide_language='+locale)
      &&c.query.includes('riders_16_plus=2')),'live public form serializes exact guide language and rider counts');
    phase='error';
    await submit.click();
    await page.waitForFunction(()=>document.querySelector('#availability-status')?.textContent
      ?.match(/could not be loaded|לא הצלחנו|nem sikerült/i),null,{timeout:7000});
    ok(await page.locator('#slotlist button').count()===0,'fixture backend error leaves no slots');
    phase='slots';
    await submit.click();
    await page.locator('#slotlist button').first().waitFor({state:'attached',timeout:7000});
    ok(await page.locator('#slotlist button').count()===2,'sellable fixture slots display');
    ok(await page.locator('#slotlist button').first().isDisabled(),
      'non-sellable non-requestable slot cannot be chosen');
    ok(await page.locator('#slotlist button').nth(1).isEnabled(),
      'sellable availability visibly enabled');
    await guide.selectOption(locale==='en'?'he':'en');
    ok(await page.locator('#slotlist button').count()===0,
      'changing requested language invalidates displayed slots');

    // Regression guard: a slow SUCCESS for an earlier requested guide
    // language must never restore bookable buttons after the guest changes it.
    const changedLabel=locale==='he'?'הבחירה השתנתה'
      :locale==='hu'?'A kiválasztás megváltozott':'Selection changed';
    await guide.selectOption(locale);
    phase='delayed-slots';
    await submit.click();
    const finishOldSuccess=await waitForDelayedAvailability();
    ok(await page.locator('#slotlist').getAttribute('aria-busy')==='true',
      'deployed UI shows a busy results region while availability is pending');
    await guide.selectOption(locale==='en'?'hu':'en');
    ok(await page.locator('#slotlist').getAttribute('aria-busy')===null,
      'changing guide language clears stale search progress immediately');
    ok((await page.locator('#availability-status').innerText()).includes(changedLabel),
      'changing guide language announces invalidation while previous response is pending');
    finishOldSuccess();
    await pause(220);
    ok(await page.locator('#slotlist button').count()===0,
      'late sellable availability cannot restore slots for an obsolete language');
    ok(await page.locator('#slotlist').getAttribute('aria-busy')===null,
      'late availability success cannot reactivate stale progress indicator');
    ok((await page.locator('#availability-status').innerText()).includes(changedLabel),
      'late success cannot overwrite the current-language selection notice');

    // Same race with an upstream ERROR: a failed, outdated search must not
    // replace the new selection's notice with a misleading server failure.
    await guide.selectOption(locale);
    phase='delayed-error';
    await submit.click();
    const finishOldError=await waitForDelayedAvailability();
    ok(await page.locator('#slotlist').getAttribute('aria-busy')==='true',
      'second availability request has independent live progress state');
    await form.locator('select[name="adults"]').selectOption('3');
    ok(await page.locator('#slotlist').getAttribute('aria-busy')===null,
      'changing group size clears prior pending search indicator');
    ok((await page.locator('#availability-status').innerText()).includes(changedLabel),
      'changing group size invalidates an in-flight departure search');
    finishOldError();
    await pause(220);
    ok(await page.locator('#slotlist button').count()===0,
      'late availability error cannot reveal stale bookable slots');
    ok(await page.locator('#slotlist').getAttribute('aria-busy')===null,
      'late availability error cannot restore the obsolete search indicator');
    ok((await page.locator('#availability-status').innerText()).includes(changedLabel),
      'late backend error cannot replace the current group-selection notice');

    ok(unauthorizedCalls===0,'no unexpected backend operations attempted');
    ok(errors.length===0,'no uncaught public browser JS errors');
    await form.screenshot({path:join(OUT,'public-booking-'+locale+'.png'),animations:'disabled'});
    row.passed=true;
  }catch(e){
    row.error=String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,550);
    console.error('FAIL '+locale+' '+row.error);
    await page.screenshot({path:join(OUT,'failed-'+locale+'.png'),timeout:6000}).catch(()=>{});
  }finally{
    // If a scenario fails before its fake upstream is released, unblock every
    // pending in-browser response so Playwright closes cleanly (no live API).
    pendingAvailabilityReplies.splice(0).forEach(release=>release());
    await context.close();
    results.push(row);
    if(row.passed)console.log('PASS public deployed booking with fixture '+locale+' ('+row.checks.length+' checks)');
  }
}
try{
  for(const [locale,path] of paths)await scenario(locale,path);
}finally{
  await browser.close();
}
const report={checked:new Date().toISOString(),total:results.length,
  passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,
  mode:'Publicly deployed HTML/JS/CSS plus fully mocked browser transport. No real FBM, customer, booking or payment requests.',
  results};
await writeFile(join(OUT,'results.json'),JSON.stringify(report,null,2));
await writeFile(join(OUT,'report.md'),[
  '# VOY PRO public booking with isolated browser fixture',
  '**Scope:** Three guiding locales EN/HE/HU, real public assets, fake FBM entirely in Chrome.',
  '**Results:** '+report.passed+'/'+report.total+' passed.',
  'No real FBM, payment, WhatsApp, Maps or analytics requests are made.',
  ...results.map(r=>'- '+(r.passed?'PASS':'FAIL')+' '+r.locale+' '+(r.error||r.checks.length+' assertions')),
  '',
  'Do not use these results as proof of authenticated FBM inventory/payment operations.',
  ''
].join('\n'));
if(report.failed)process.exitCode=1;

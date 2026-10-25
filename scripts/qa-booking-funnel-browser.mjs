// Real Chrome booking form tests against the built local site, with a fully
// mocked FBM transport. There are NO actual customer, booking, or payment calls.
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('dist'),out=resolve('visual-qa-output/booking-funnel');
const fakeApi='https://booking-browser-fixture.invalid/api/v1';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
  '.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const name=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
    if(!name.startsWith(root+sep)||(await stat(name)).isDirectory())throw Error('invalid');
    const body=await readFile(name);
    res.writeHead(200,{'Content-Type':mime[extname(name)]||'application/octet-stream'});
    res.end(body);
  }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const local='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
const results=[],failures=[];
function check(ok,name){
  results.push((ok?'PASS: ':'FAIL: ')+name);
  if(!ok)failures.push(name);
}
const products=[
  {id:'exp_bud_buda',slug:'buda-highlights',title:'Buda Highlights',bookingEnabled:true,
    priceFrom:70,currency:'EUR',durationMinutes:120,
    guideLanguages:['en','he','hu'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12},
  {id:'exp_bud_margaret',slug:'margaret-island',title:'Margaret Island',
    bookingEnabled:true,priceFrom:70,currency:'EUR',durationMinutes:120,
    guideLanguages:['en','hu'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12}
];
const fixturePolicy={standard_min_age:16,child_passenger_min_age:3,child_passenger_max_age:15,
  baby_passenger_min_age:1,baby_passenger_max_age:2};
const paths=[
  ['en','/budapest/tours/buda-castle-ezraider-tour/'],
  ['he','/he/budapest/tours/buda-castle-ezraider-tour/'],
  ['hu','/hu/budapest/tours/buda-castle-ezraider-tour/']
];
const wait=ms=>new Promise(done=>setTimeout(done,ms));
async function scenario(lang,path,{catalogDown=false,overnightRollover=false}={}){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  // The tab is opened at 23:59 Budapest local time after the DST change.
  // Move only its simulated clock forward; FBM routes remain mocked.
  if(overnightRollover)await page.clock.install({time:new Date('2026-10-25T22:59:30.000Z')});
  const calls=[],pageErrors=[];
  let phase='empty';
  page.on('pageerror',err=>pageErrors.push(err.message));
  await page.route('**/*',async route=>{
    const req=route.request();
    const url=new URL(req.url());
    if(url.origin===local){
      if(url.pathname==='/assets/runtime-config.js'){
        return route.fulfill({status:200,contentType:'text/javascript',
          body:'window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:'+JSON.stringify(fakeApi)+',clientKey:"test_public_fixture"};'});
      }
      return route.continue();
    }
    if(url.origin!==new URL(fakeApi).origin)return route.abort();
    const prefix='/api/v1';
    if(!url.pathname.startsWith(prefix+'/'))return route.abort();
    const routePath=url.pathname.slice(prefix.length);
    const headers={'content-type':'application/json','access-control-allow-origin':local,
      'access-control-allow-headers':'x-voy-client-key,x-voy-client,content-type',
      'access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    calls.push({method:req.method(),path:routePath+url.search});
    let status=200,data={};
    if(routePath==='/marketing/experiments')data={experiments:[]};
    else if(routePath==='/destinations/budapest')data={
      rider_policy:fixturePolicy,booking_horizon_days:21,
      meeting_point:{address:'Városház utca 14, 1052 Budapest, Hungary',
        maps_url:'https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac'}
    };
    else if(routePath==='/experiences'){
      if(catalogDown){status=503;data={error:'fixture catalog offline',code:'CATALOG_OFFLINE'};}
      else data=products;
    }else if(routePath==='/sessions')data={id:'browser-fixture-session'};
    else if(routePath.startsWith('/sessions/'))data={ok:true};
    else if(/\/experiences\/[^/]+\/availability$/.test(routePath)){
      if(phase==='slow')await wait(600);
      if(phase==='error'){status=503;data={error:'fixture unavailable',code:'AVAILABILITY_UNAVAILABLE'};}
      else if(phase==='slots'||phase==='slow')data={slots:[
        {id:'11111111-1111-4111-8111-111111111111',time:'10:00',sellable:false,requestable:false},
        {id:'22222222-2222-4222-8222-222222222222',time:'10:30',sellable:true,requestable:false}
      ]};
      else data={slots:[]};
    }else if(routePath==='/payments/capabilities'&&req.method()==='GET'){
      // The real customer page checks payment capabilities on load. This is
      // read-only; it must never initiate a payment.
      data={online_card:false};
    }else if(routePath.startsWith('/payments/')||routePath.startsWith('/holds')||
      routePath.startsWith('/bookings')||routePath.startsWith('/quotes')){
      // A browser QA regression must never progress to checkout or payment.
      failures.push(lang+' unexpected sensitive backend route '+routePath);
      return route.fulfill({status:403,headers,body:'{"error":"forbidden in browser fixture"}'});
    }else data={ok:true};
    return route.fulfill({status,headers,body:JSON.stringify(data)});
  });
  try{
    const response=await page.goto(local+path,{waitUntil:'domcontentloaded',timeout:25000});
    check(response?.status()===200,lang+' local tour route works');
    const consent=page.locator('[data-consent-essential]');
    if(await consent.isVisible().catch(()=>false))await consent.click({timeout:3000});
    await page.waitForFunction(()=>!document.body.classList.contains('consent-open'),
      null,{timeout:5000});
    const form=page.locator('#availability-form');
    const experience=form.locator('[name="experience"]');
    if(catalogDown){
      await page.locator('.mobilebook.is-price-unavailable [data-runtime-price]').waitFor({state:'visible',timeout:9000});
      await experience.locator('option').first().waitFor({state:'attached',timeout:9000});
      check(await experience.isDisabled(),lang+' failed catalog disables experience choice');
      check(await form.locator('button[type="submit"]').isDisabled(),
        lang+' failed catalog disables availability submission');
      check(!(await page.locator('[data-runtime-price]').first().innerText()).includes('€70'),
        lang+' failed catalog never displays an unverified live price');
      check(calls.filter(c=>c.path.includes('/availability')).length===0,
        lang+' catalog failure does not request availability');
      const state=await page.locator('.mobilebook').evaluate(bar=>{
        const price=bar.querySelector('[data-runtime-price]');
        const cta=bar.querySelector('a.btn');
        const p=price.getBoundingClientRect(),b=bar.getBoundingClientRect(),a=cta.getBoundingClientRect();
        return {text:price.textContent,description:price.getAttribute('aria-label'),
          barHeight:b.height,priceLeft:p.left,priceRight:p.right,ctaLeft:a.left,ctaRight:a.right,viewport:innerWidth,
          scrollWidth:document.documentElement.scrollWidth};
      });
      const expected=lang==='he'?'מחיר לא זמין':lang==='hu'?'Ár nem elérhető':'Price unavailable';
      check(state.text===expected,lang+' sticky bar keeps concise localized unverified-price message');
      check(state.description.length>state.text.length,lang+' longer diagnostic remains accessible');
      check(state.barHeight<=105&&
        (state.priceRight<=state.ctaLeft+3||state.ctaRight<=state.priceLeft+3)&&
        state.ctaLeft>=-2&&state.ctaRight<=state.viewport+2&&
        state.priceLeft>=-2&&state.priceRight<=state.viewport+2&&
        state.scrollWidth<=state.viewport+2,
        lang+' sticky price and booking action do not collide or overflow');
      await page.screenshot({path:join(out,'booking-'+lang+'-offline.png'),fullPage:false});
      return;
    }
    await experience.locator('option[value="exp_bud_buda"]').waitFor({state:'attached',timeout:12000});
    await page.waitForFunction(()=>{
      const bar=document.querySelector('.mobilebook');
      return bar&&!bar.classList.contains('is-price-loading')&&
        /70/.test(bar.querySelector('[data-runtime-price]')?.textContent||'');
    },null,{timeout:10000});
    check(!(await page.locator('.mobilebook').getAttribute('class')).includes('is-price-unavailable')&&
      (await page.locator('.mobilebook [data-runtime-price]').innerText()).includes('70'),
      lang+' successful catalog restores verified live amount in mobile bar');
    const guide=form.locator('[name="guide_language"]');
    await guide.locator('option[value="en"]').waitFor({state:'attached',timeout:9000});
    check(await guide.inputValue()==='',lang+' guide language is never silently chosen');
    if(overnightRollover){
      const date=form.locator('input[name="date"]');
      await date.fill('2026-10-25');
      await guide.selectOption('en');
      check(await date.evaluate(el=>el.min==='2026-10-25'),
        lang+' date starts at Budapest October 25, not the browser timezone');
      await page.clock.setFixedTime(new Date('2026-10-25T23:01:30.000Z'));
      await form.locator('button[type="submit"]').click();
      const actual=await date.evaluate(el=>({min:el.min,max:el.max,value:el.value}));
      check(actual.min==='2026-10-26'&&actual.max==='2026-11-16'&&
        actual.value==='2026-10-25',
        lang+' overnight recalculates 21-day FBM booking window without changing guest date');
      check((await page.locator('#availability-status').innerText()).includes(
        lang==='he'?'כבר חלף':lang==='hu'?'már elmúlt':'now in the past'),
        lang+' invalid previous-day date is explained in the page language');
      check(!calls.some(c=>c.path.includes('/availability?')),
        lang+' overnight stale date does not reach availability API');
      await date.fill('2026-10-26');
      await form.locator('button[type="submit"]').click();
      for(let i=0;i<50&&!calls.some(c=>c.path.includes('/availability?'));i++)await wait(30);
      check(calls.some(c=>c.path.includes('/availability?')&&c.path.includes('date=2026-10-26')),
        lang+' corrected Budapest date searches canonical mocked availability');
      check(!calls.some(c=>/\/(?:holds|quotes|bookings|payments)\b/.test(c.path)),
        lang+' midnight test never attempts hold, booking or payment');
      check(pageErrors.length===0,lang+' overnight validation creates no JS exceptions');
      return;
    }
    // Changing products must not silently reinterpret a previously chosen
    // guiding language as consent to another one. Availability remains server-
    // owned; these are UI-only transitions with the mocked public catalog.
    await guide.selectOption('he');
    await experience.selectOption('exp_bud_margaret');
    check(!(await guide.locator('option').evaluateAll(opts=>opts.some(o=>o.value==='he'))),
      lang+' switching to a tour without Hebrew removes unsupported language');
    check(await guide.inputValue()==='',
      lang+' unsupported guiding language is cleared instead of defaulting to English');
    const beforeMissingGuide=calls.filter(c=>c.path.includes('/availability')).length;
    await form.locator('button[type="submit"]').click();
    check(calls.filter(c=>c.path.includes('/availability')).length===beforeMissingGuide,
      lang+' switching tours without new guide choice cannot search availability');
    await guide.selectOption('hu');
    await experience.selectOption('exp_bud_buda');
    check(await guide.inputValue()==='hu',
      lang+' explicitly chosen language survives switch when both tours support it');
    // Restore an empty required field for the original missing-language
    // submission test. It must not inherit the choice from the switch tests.
    await guide.selectOption('');
    check(await form.locator('button[type="submit"]').isEnabled(),lang+' search available with live catalog');
    const submit=form.locator('button[type="submit"]');
    await submit.click();
    await wait(150);
    check(!calls.some(c=>c.path.includes('/availability')),
      lang+' required guide language blocks premature availability search');
    await guide.selectOption(lang);
    // The server remains authoritative for the rider/child seat limit and live price.
    await form.locator('[name="adults"]').selectOption('2');
    await form.locator('[name="children"]').selectOption('1');
    await submit.click();
    await page.waitForFunction(()=>document.querySelector('#availability-status')?.textContent
      ?.match(/No departures|לא נמצאו|nincs elérhető/i),null,{timeout:10000});
    check(await page.locator('#slotlist button').count()===0,lang+' empty availability leaves no slot');
    check(calls.some(c=>c.path.includes('/availability')&&c.path.includes('riders_16_plus')),
      lang+' group composition sent to mocked availability API');

    phase='error';
    await submit.click();
    await page.waitForFunction(()=>document.querySelector('#availability-status')?.textContent
      ?.match(/could not be loaded|לא הצלחנו|nem sikerült/i),null,{timeout:10000});
    check(await page.locator('#slotlist button').count()===0,lang+' backend error never exposes stale slots');

    phase='slots';
    await submit.click();
    await page.locator('#slotlist button').first().waitFor({state:'attached',timeout:10000});
    check(await page.locator('#slotlist button').count()===2,lang+' live departures rendered');
    check(await page.locator('#slotlist button').first().isDisabled(),
      lang+' unsellable and non-requestable slot is disabled');
    check(await page.locator('#slotlist button').nth(1).isEnabled(),
      lang+' sellable slot remains selectable');
    // Guide language is part of the availability request. A changed language
    // must invalidate sellable slots immediately; never reuse a former guide-
    // specific result or proceed to a hold with an obsolete request.
    await guide.selectOption(lang==='en'?'he':'en');
    check(await page.locator('#slotlist button').count()===0,
      lang+' changing guide language immediately clears previous sellable slots');
    check((await page.locator('#availability-status').innerText()).length>10,
      lang+' language change announces that a new availability search is needed');
    await guide.selectOption(lang);
    // Do not click sellable departure: that could trigger a hold or checkout.
    await form.locator('[name="adults"]').selectOption('3');
    check(await page.locator('#slotlist button').count()===0,
      lang+' group changes immediately clear obsolete departures');
    check((await page.locator('#availability-status').innerText()).length>10,
      lang+' selection change has an explanatory status message');

    phase='slow';
    await submit.click();
    // Wait for the delayed request itself, rather than translated loading copy.
    // All locales must issue a search for the new group composition.
    await page.waitForFunction(()=>document.querySelector('#availability-status')?.textContent?.length>0,
      null,{timeout:10000});
    for(let i=0;i<40&&!calls.some(c=>c.path.includes('/availability')&&c.path.includes('riders_16_plus=3'));i++)
      await wait(30);
    check(calls.some(c=>c.path.includes('/availability')&&c.path.includes('riders_16_plus=3')),
      lang+' delayed availability request actually started before selection change');
    await form.locator('[name="children"]').selectOption('2');
    await wait(800);
    check(await page.locator('#slotlist button').count()===0,
      lang+' delayed response cannot restore stale availability after a change');

    // Also challenge the in-flight guide-language boundary, not just changes
    // in rider/passenger counts. An old-language response must never restore
    // any sellable departure or unlock checkout after the customer switches.
    const previousRequestCount=calls.filter(c=>c.path.includes('/availability')).length;
    const slowGuideLanguage=lang==='en'?'he':'en';
    await guide.selectOption(slowGuideLanguage);
    await submit.click();
    for(let i=0;i<50&&calls.filter(c=>c.path.includes('/availability')).length<=previousRequestCount;i++)
      await wait(25);
    const languageRequest=calls.filter(c=>c.path.includes('/availability')).at(-1);
    check(calls.filter(c=>c.path.includes('/availability')).length>previousRequestCount&&
      languageRequest?.path.includes('guide_language='+slowGuideLanguage),
      lang+' delayed availability started with explicitly selected guide language');
    await guide.selectOption(lang);
    await wait(800);
    check(await page.locator('#slotlist button').count()===0,
      lang+' old-language delayed availability cannot restore sellable or requestable slots');
    check((await page.locator('#availability-status').innerText()).length>10,
      lang+' language switch retains a visible recheck explanation after delayed response');
    check(!await page.locator('#live-checkout-shell').isVisible().catch(()=>false),
      lang+' no checkout shown by these availability tests');
    check(pageErrors.length===0,lang+' no JavaScript errors'+(pageErrors.length?' '+pageErrors.join('; '):''));
    await page.screenshot({path:join(out,'booking-'+lang+'.png'),fullPage:false});
  }catch(e){
    failures.push(lang+' flow failed: '+String(e).slice(0,450));
    await page.screenshot({path:join(out,'booking-'+lang+'-failed.png')}).catch(()=>{});
  }finally{await page.close();}
}
try{
  await scenario('en',paths[0][1]);
  await scenario('en',paths[0][1],{overnightRollover:true});
  await scenario('he',paths[1][1],{overnightRollover:true});
  await scenario('hu',paths[2][1],{overnightRollover:true});
  await scenario('he',paths[1][1]);
  await scenario('hu',paths[2][1]);
  await scenario('en',paths[0][1],{catalogDown:true});
  await scenario('he',paths[1][1],{catalogDown:true});
  await scenario('hu',paths[2][1],{catalogDown:true});
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
const report=['# Real Chrome booking usability — fully mocked',
  '',
  'No real FBM/Stripe/network requests. No bookings, holds or payments created.',
  '- Failures: '+failures.length,
  ...results, ...failures.map(e=>'FAIL: '+e),''].join('\n');
await writeFile(join(out,'report.md'),report);
console.log(report);
if(failures.length)process.exitCode=1;

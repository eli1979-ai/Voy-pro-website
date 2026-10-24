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
async function scenario(lang,path,{catalogDown=false}={}){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
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
    calls.push({method:req.method(),path:routePath});
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
    const form=page.locator('#availability-form');
    const experience=form.locator('[name="experience"]');
    if(catalogDown){
      await experience.locator('option').first().waitFor({state:'attached',timeout:9000});
      await page.waitForFunction(()=>document.querySelector('#availability-form [name="experience"]')?.disabled &&
        document.querySelector('#availability-status')?.textContent?.includes(''),null,{timeout:9000});
      check(await experience.isDisabled(),lang+' failed catalog disables experience choice');
      check(await form.locator('button[type="submit"]').isDisabled(),
        lang+' failed catalog disables availability submission');
      check(!(await page.locator('[data-runtime-price]').first().innerText()).includes('€70'),
        lang+' failed catalog never displays an unverified live price');
      check(calls.filter(c=>c.path.includes('/availability')).length===0,
        lang+' catalog failure does not request availability');
      return;
    }
    await experience.locator('option[value="exp_bud_buda"]').waitFor({state:'attached',timeout:12000});
    const guide=form.locator('[name="guide_language"]');
    await guide.locator('option[value="en"]').waitFor({state:'attached',timeout:9000});
    check(await guide.inputValue()==='',lang+' guide language is never silently chosen');
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
    // Do not click sellable departure: that could trigger a hold or checkout.
    await form.locator('[name="adults"]').selectOption('3');
    check(await page.locator('#slotlist button').count()===0,
      lang+' group changes immediately clear obsolete departures');
    check((await page.locator('#availability-status').innerText()).length>10,
      lang+' selection change has an explanatory status message');

    phase='slow';
    await submit.click();
    await page.waitForFunction(()=>document.querySelector('#availability-status')?.textContent
      ?.match(/Checking|בודקים|ellenőrzi/i),null,{timeout:10000});
    // Wait until the delayed fetch has started, then invalidate the search.
    for(let i=0;i<30&&!calls.some(c=>c.path.includes('/availability')&&c.path.includes('riders_16_plus=3'));i++)
      await wait(25);
    await form.locator('[name="children"]').selectOption('2');
    await wait(800);
    check(await page.locator('#slotlist button').count()===0,
      lang+' delayed response cannot restore stale availability after a change');
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
  await scenario('he',paths[1][1]);
  await scenario('hu',paths[2][1]);
  await scenario('en',paths[0][1],{catalogDown:true});
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

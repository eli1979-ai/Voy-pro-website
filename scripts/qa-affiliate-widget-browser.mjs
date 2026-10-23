// Real Chrome coverage of affiliate embedding, fully isolated from live FBM.
// Closed shadow root is opened ONLY in this test context for inspection.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';

const out=resolve('visual-qa-output');
const widget=await readFile('dist/assets/affiliate-booking-widget.js');
const originAPI='https://fbm-widget-fixture.invalid';
const pageHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulated Partner</title></head><body><main><h1>Partner-only demo</h1><div id="affiliate-target"></div></main><script src="/assets/affiliate-booking-widget.js" data-voy-affiliate-widget data-target="affiliate-target" data-affiliate="TESTPARTNER" data-client-key="public_fixture_key" data-api-root="'+originAPI+'"></script></body></html>';
const server=createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(pageHTML);}
  else if(req.url==='/assets/affiliate-booking-widget.js'){
    res.writeHead(200,{'content-type':'text/javascript'});res.end(widget);
  }else{res.writeHead(404);res.end('not found');}
});
await mkdir(out,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const host='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
let failures=0;
const lines=[];
const check=(value,label)=>{
  if(value)lines.push('PASS: '+label);
  else{failures++;lines.push('FAIL: '+label);}
};
const tourId='exp_bud_buda',slotId='22222222-2222-4222-8222-222222222222';
async function run(name,{mobile=false,staffRequest=false}={}){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},reducedMotion:'reduce'});
  const calls=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const shadow=Element.prototype.attachShadow;
    Element.prototype.attachShadow=function(settings){
      return shadow.call(this,{...settings,mode:'open'});
    };
  });
  await page.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===host)return route.continue();
    if(url.origin!==originAPI||!url.pathname.startsWith('/api/v1/'))return route.abort();
    const method=req.method(),path=url.pathname+url.search;
    const h={'access-control-allow-origin':host,
      'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers':'x-voy-client-key,content-type,idempotency-key'};
    if(method==='OPTIONS')return route.fulfill({status:204,headers:h,body:''});
    if(!['GET','POST','DELETE'].includes(method))return route.abort();
    const payload=method==='POST'?req.postDataJSON():null;
    calls.push({path,method,payload});
    let data;
    if(path==='/api/v1/experiences?destination=budapest')
      data=[{id:tourId,title:'Buda Tour',priceFrom:70,currency:'EUR',bookingEnabled:true,
        guideLanguages:['en','he'],privateAllowed:true,privateMinRiders:2,maxIndependentRiders:12}];
    else if(path==='/api/v1/payments/capabilities')data={online_card:false};
    else if(path.includes('/availability?'))data={slots:[{
      id:slotId,time:'10:00',sellable:!staffRequest,requestable:staffRequest
    }]};
    else if(path==='/api/v1/promotions/validate')
      data={valid:payload?.code==='TESTPARTNER',code:'TESTPARTNER'};
    else if(path==='/api/v1/quotes')data={promo_code_applied:payload?.promo_code,total:120,
      discount:20,currency:'EUR',lines:[{label:'Partner discount',line_total_minor:-2000}]};
    else if(path==='/api/v1/holds')data={id:'33333333-3333-4333-8333-333333333333',
      departure_id:slotId,expires_at:new Date(Date.now()+600000).toISOString(),
      requires_staff_confirmation:false};
    else if(path==='/api/v1/ancillary/offers')data=[];
    else if(path==='/api/v1/bookings')
      data={reference:'VOY-FAKE-CONFIRMED',status:'confirmed',manage_token:null};
    else if(path==='/api/v1/booking-capacity-requests')
      data={type:'booking_capacity_request',status:'pending',reference:'VP-CAP-FAKE'};
    else if(method==='DELETE'&&path.startsWith('/api/v1/holds/'))
      return route.fulfill({status:204,headers:h,body:''});
    else return route.fulfill({status:500,headers:{...h,'content-type':'application/json'},
      body:JSON.stringify({error:'Unmocked API route'})});
    return route.fulfill({status:200,headers:{...h,'content-type':'application/json'},
      body:JSON.stringify(data)});
  });
  try{
    const response=await page.goto(host+'/',{waitUntil:'domcontentloaded',timeout:20000});
    check(response?.status()===200,name+' local partner host loads');
    const root=page.locator('#affiliate-target');
    const experience=root.locator('select[name="experience"]');
    await experience.locator('option[value="'+tourId+'"]').waitFor({timeout:10000});
    check(await root.locator('h2').innerText()==='Book your Budapest EZRaider tour',
      name+' actual embedded widget renders');
    const language=root.locator('select[name="language"]');
    check(await language.isDisabled(),name+' guide choice is disabled before tour');
    await experience.selectOption(tourId);
    check(await language.locator('option[value="he"]').innerText()==='Hebrew',
      name+' catalog language label is readable');
    check(await language.inputValue()==='',name+' no language default');
    await root.locator('#searchButton').click();
    check(!calls.some(c=>c.path.includes('/availability?')),
      name+' native required validation blocks missing guide language');
    await language.selectOption('he');
    await root.locator('#searchButton').click();
    const departure=root.locator('#slots button').first();
    await departure.waitFor({timeout:10000});
    check(calls.some(c=>c.path.includes('/availability?')),name+' catalog-valid request reaches mocked availability');
    await departure.click();
    await root.locator('#checkout:not(.hidden)').waitFor({timeout:10000});
    check(staffRequest?!calls.some(c=>c.path==='/api/v1/holds'):
      calls.some(c=>c.path==='/api/v1/holds'&&c.payload?.guide_language==='he'),
      name+' hold uses requested language; staff request does not reserve');
    await root.locator('#customer [name="name"]').fill('Browser Fixture');
    await root.locator('#customer [name="email"]').fill('fixture@example.invalid');
    await root.locator('#customer [name="phone"]').fill('+15551234567');
    await root.locator('#customer [name="terms"]').check();
    await root.locator('#confirmButton').click();
    await root.locator('#success:not(.hidden)').waitFor({timeout:10000});
    const receipt=await root.locator('#success').innerText();
    check(receipt.includes('Requested guiding language: Hebrew'),
      name+' receipt preserves requested language');
    check(staffRequest?receipt.includes('This is not a confirmed booking'):
      receipt.includes('Language coverage will be confirmed with the assigned guide'),
      name+' receipt never guarantees unverified staffing');
    check(!receipt.includes('English fallback accepted'),name+' no presumed English alternate');
    check(staffRequest?
      calls.some(c=>c.path==='/api/v1/booking-capacity-requests'&&
        c.payload?.guide_language==='he'&&c.payload?.promo_code==='TESTPARTNER')&&
        !calls.some(c=>c.path==='/api/v1/bookings'):
      calls.some(c=>c.path==='/api/v1/bookings'&&c.payload?.promo_code==='TESTPARTNER'),
      name+' affiliate attribution preserved in correct request/booking flow');
    check(!calls.some(c=>c.path==='/api/v1/payments/intents'),
      name+' no online payment attempts');
    check(errors.length===0,name+' no JavaScript exceptions'+
      (errors.length?' ('+errors.join('; ')+')':''));
    await page.screenshot({path:join(out,'affiliate-'+name+'.png'),fullPage:true});
  }catch(e){
    failures++;lines.push('FAIL: '+name+' unexpected error '+String(e.stack||e).slice(0,750));
    await page.screenshot({path:join(out,'affiliate-'+name+'-failed.png')}).catch(()=>{});
  }finally{await page.close();}
}
try{
  await run('desktop-booking');
  await run('mobile-pending-request',{mobile:true,staffRequest:true});
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
  const report=['# Affiliate embed real-Chrome report','','All data simulated locally, network to real FBM/vendors blocked; shadow opened ONLY in test context.','','- Failed checks: '+failures,'',...lines,''].join('\n');
  await writeFile(join(out,'affiliate-browser-report.md'),report);
  process.stdout.write(report+'\n');
}
if(failures)process.exitCode=1;
